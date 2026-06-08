import { prisma } from '../config/prisma.js';

// Fees that must ALWAYS be deducted from SPOT wallet only
const SPOT_ONLY_FEE_CODES = new Set<string>([
  'KYC_SUBMISSION',
]);

// Fees that must ALWAYS be deducted from MAIN/OTHER wallet only
// IMPORTANT: These fees should NEVER touch spot_balance. If main wallet
// does not have enough balance and negative is not allowed for this
// operation, the fee should fail with INSUFFICIENT_BALANCE.
const MAIN_ONLY_FEE_CODES = new Set<string>([
  'NAME_CHANGE',
  'NUMBER_CHANGE',
  'EMAIL_CHANGE',
  'SUPPORT_TICKET',
  'GENERAL_PROBLEM',
  'COMMISSION_ISSUE',
  'COMMISSION_ANALYSIS',
  'NAME_CORRECTION_MINOR',
  'EMAIL_CORRECTION',
  'MOBILE_CORRECTION_MINOR',
  'FULL_NAME_CHANGE',
  'FULL_MOBILE_CHANGE',
  'INFORMATION_PROBLEM',
  'CHEQUE_RETURN_ISSUE',
  'REPORT_DOWNLOAD',
  'BOND_DOWNLOAD',
  'ACCOUNT_CHANGE',
  'KYC_APPLY',
  'FUND_WITHDRAW',
  'ID_TRANSFER',
  'OTP_SEND',
  'TRANSACTION_PIN_FORGOT',
]);

/** Spot commission hold: 10 days from credit date before withdrawable */
const SPOT_HOLD_DAYS = 10;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format date as YYYY-MM-DD for hold_until comparison */
function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type AddLedgerAndWalletParams = {
  receiverId: bigint;
  sourceId: bigint;
  purchaseId?: bigint | null;
  amount: number;
  type: 'SELF' | 'GLOBAL_HELPING' | 'SPOT' | 'MONTHLY' | 'ADMIN_OPS';
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  creditedAt?: Date; // Optional: set credited_at explicitly (defaults to current time)
};

export async function addLedgerAndWallet(params: AddLedgerAndWalletParams) {
  const { receiverId, sourceId, purchaseId, amount, type, metadata, idempotencyKey, creditedAt } = params;

  return prisma.$transaction(async (tx) => {
    // Per-user advisory lock for wallet concurrency safety
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      `user:${receiverId.toString()}`
    );

    // Idempotency check - BOTH ledger entry AND wallet transaction
    const existing = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
    
    if (existing) {
      // Check if wallet transaction also exists
      const existingWalletTxn = await tx.wallet_transactions.findFirst({
        where: { idempotency_key: idempotencyKey }
      });
      
      if (existingWalletTxn) {
        // Both exist, return early - no balance update needed
        return existing;
      }
      
      // Ledger exists but wallet transaction missing - create wallet transaction
      // AND UPDATE BALANCE (it was never updated if wallet_transaction was missing!)
      await tx.wallet_transactions.create({
        data: {
          receiver_user_id: receiverId,
          ledger_entry_id: existing.id,
          amount,
          idempotency_key: idempotencyKey,
        },
      });
      
      // FIX: Update balance since it was never updated when ledger was created
      // Check if user_balances record exists
      const existingBalance = await tx.user_balances.findUnique({
        where: { user_id: receiverId },
      });
      if (!existingBalance) {
        await tx.user_balances.create({
          data: { user_id: receiverId, balance: 0, spot_balance: 0, other_balance: 0, team_royalty_balance: 0 },
        });
      } else {
        await tx.user_balances.update({
          where: { user_id: receiverId },
          data: { updated_at: new Date() },
        });
      }
      
      // Update balance based on commission type
      if (type === 'SPOT') {
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      } else if (type === 'ADMIN_OPS') {
        const adminWalletType = metadata?.wallet_type as string;
        if (adminWalletType === 'spot_balance') {
          await tx.$executeRawUnsafe(
            'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
            amount,
            receiverId
          );
        } else if (adminWalletType === 'team_royalty_balance') {
          await tx.$executeRawUnsafe(
            'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
            amount,
            receiverId
          );
        } else {
          await tx.$executeRawUnsafe(
            'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
            amount,
            receiverId
          );
        }
      } else if (type === 'MONTHLY') {
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      } else {
        // SELF, GLOBAL_HELPING go to other_balance
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      }
      
      return existing;
    }

    // Determine which wallet this commission goes to
    const walletType = type === 'SPOT'
      ? 'spot_balance'
      : type === 'MONTHLY'
        ? 'team_royalty_balance'
        : type === 'ADMIN_OPS' && metadata?.wallet_type
          ? metadata.wallet_type as string
          : 'other_balance';

    // SPOT hold: from credit date, spot is withdrawable only after SPOT_HOLD_DAYS
    // SELF / GLOBAL_HELPING: reinvestment lock hold_until comes from metadata (set in commission.service)
    let holdUntil: string | undefined;
    if (type === 'SPOT') {
      const creditDate = creditedAt || new Date();
      holdUntil = formatDateOnly(addDays(creditDate, SPOT_HOLD_DAYS));
    } else if ((type === 'SELF' || type === 'GLOBAL_HELPING') && metadata?.hold_until) {
      holdUntil = metadata.hold_until as string;
    }

    let ledger;
    try {
      ledger = await tx.ledger_entries.create({
        data: {
          receiver_user_id: receiverId,
          source_user_id: sourceId,
          purchase_id: purchaseId ?? null,
          commission_type: type as any,
          amount,
          metadata: {
            ...(metadata || {}),
            wallet_type: walletType, // Track which wallet was credited
            ...(holdUntil !== undefined && { hold_until: holdUntil }),
          } as any,
          idempotency_key: idempotencyKey,
          credited_at: creditedAt || new Date(), // Use provided date or current time
        },
      });
    } catch (e: any) {
      // If another retry already created this entry, return the existing one gracefully
      if (e?.code === 'P2002') {
        const existingAfter = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
        if (existingAfter) {
          // Check if wallet transaction exists
          const existingWalletTxn = await tx.wallet_transactions.findFirst({
            where: { idempotency_key: idempotencyKey }
          });
          
          if (!existingWalletTxn) {
            // Create missing wallet transaction
            await tx.wallet_transactions.create({
              data: {
                receiver_user_id: receiverId,
                ledger_entry_id: existingAfter.id,
                amount,
                idempotency_key: idempotencyKey,
              },
            });
            
            // FIX: Update balance since it was never updated when ledger was created
            // Check if user_balances record exists
            const existingBalance = await tx.user_balances.findUnique({
              where: { user_id: receiverId },
            });
            if (!existingBalance) {
              await tx.user_balances.create({
                data: { user_id: receiverId, balance: 0, spot_balance: 0, other_balance: 0, team_royalty_balance: 0 },
              });
            } else {
              await tx.user_balances.update({
                where: { user_id: receiverId },
                data: { updated_at: new Date() },
              });
            }
            
            if (type === 'SPOT') {
              await tx.$executeRawUnsafe(
                'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
                amount,
                receiverId
              );
            } else if (type === 'ADMIN_OPS') {
              const adminWalletType = metadata?.wallet_type as string;
              if (adminWalletType === 'spot_balance') {
                await tx.$executeRawUnsafe(
                  'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
                  amount,
                  receiverId
                );
              } else if (adminWalletType === 'team_royalty_balance') {
                await tx.$executeRawUnsafe(
                  'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
                  amount,
                  receiverId
                );
              } else {
                await tx.$executeRawUnsafe(
                  'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
                  amount,
                  receiverId
                );
              }
            } else if (type === 'MONTHLY') {
              await tx.$executeRawUnsafe(
                'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
                amount,
                receiverId
              );
            } else {
              await tx.$executeRawUnsafe(
                'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
                amount,
                receiverId
              );
            }
          }
          
          return existingAfter;
        }
      }
      throw e;
    }

    // Create wallet transaction FIRST (before balance update)
    // If this fails, entire transaction will rollback
    try {
      await tx.wallet_transactions.create({
        data: {
          receiver_user_id: receiverId,
          ledger_entry_id: ledger.id,
          amount,
          idempotency_key: idempotencyKey,
        },
      });
    } catch (e: any) {
      // If wallet transaction creation fails, rollback entire transaction
      // This ensures balance is only updated if wallet transaction is created
      throw new Error(`Failed to create wallet transaction: ${e.message}`);
    }

    // Check if user_balances record exists, if not create it
    // Using raw SQL because production DB may not have primary key constraint
    const existingBalance = await tx.user_balances.findUnique({
      where: { user_id: receiverId },
    });
    if (!existingBalance) {
      await tx.user_balances.create({
        data: {
          user_id: receiverId,
          balance: 0,
          spot_balance: 0,
          other_balance: 0,
          team_royalty_balance: 0,
          spot_team_withdraw_used: 0,
          spot_team_limit_reached_at: null,
          spot_team_flush_active: false,
        },
      });
    } else {
      await tx.user_balances.update({
        where: { user_id: receiverId },
        data: { updated_at: new Date() },
      });
    }

    // Determine if Spot/Team Royalty incomes should be flushed (10x limit used + 15 days passed, no upgrade yet)
    let flushSpotTeamIncome = false;
    if (
      (type === 'SPOT' || type === 'MONTHLY') &&
      existingBalance?.spot_team_limit_reached_at
    ) {
      const reachedAt = new Date(existingBalance.spot_team_limit_reached_at as any);
      const now = new Date();
      const diffMs = now.getTime() - reachedAt.getTime();
      const daysSinceLimitReached = diffMs / (1000 * 60 * 60 * 24);
      if (daysSinceLimitReached >= 15 || existingBalance.spot_team_flush_active) {
        flushSpotTeamIncome = true;
        // New behaviour: after 15 days we only stop adding NEW Spot/Team Royalty income.
        // Existing Spot/Team Royalty balances remain as-is; we just mark flush_active.
        if (!existingBalance.spot_team_flush_active) {
          await tx.user_balances.update({
            where: { user_id: receiverId },
            data: {
              spot_team_flush_active: true,
              updated_at: new Date(),
            },
          });
        }
      }
    }

    if (type === 'SPOT') {
      if (!flushSpotTeamIncome) {
      await tx.$executeRawUnsafe(
        'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
        amount,
        receiverId
      );
      }
    } else if (type === 'ADMIN_OPS') {
      const adminWalletType = metadata?.wallet_type as string;
      if (adminWalletType === 'spot_balance') {
        if (!flushSpotTeamIncome) {
          await tx.$executeRawUnsafe(
            'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
            amount,
            receiverId
          );
        }
      } else if (adminWalletType === 'team_royalty_balance') {
        if (!flushSpotTeamIncome) {
          await tx.$executeRawUnsafe(
            'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
            amount,
            receiverId
          );
        }
      } else {
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      }
    } else if (type === 'MONTHLY') {
      if (!flushSpotTeamIncome) {
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, team_royalty_balance = team_royalty_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      }
    } else {
      // SELF, GLOBAL_HELPING go to other_balance
      await tx.$executeRawUnsafe(
        'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
        amount,
        receiverId
      );
    }

    return ledger;
  });
}

type DeductFromWalletParams = {
  userId: bigint;
  amount: number;
  reason: string;
  referenceId?: bigint | null;
  referenceType?: string;
  idempotencyKey: string;
  allowNegative?: boolean; // Allow wallet to go negative (for KYC fee, etc.)
};

/**
 * Deduct amount from user wallet (for fees, charges, etc.)
 * Throws error if insufficient balance
 */
export async function deductFromWallet(params: DeductFromWalletParams) {
  const { userId, amount, reason, referenceId, referenceType, idempotencyKey, allowNegative = false } = params;

  return prisma.$transaction(async (tx) => {
    // Per-user advisory lock for wallet concurrency safety
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      `user:${userId.toString()}`
    );

    // Check balance (unless negative balance is allowed)
    const balance = await tx.user_balances.findUnique({
      where: { user_id: userId },
      select: { spot_balance: true, other_balance: true, balance: true },
    });

    const spotBalance = Number(balance?.spot_balance || 0);
    const otherBalance = Number(balance?.other_balance || 0);
    
    // Only enforce balance check if negative balance is not allowed.
    // Rule:
    // - SPOT_ONLY_FEE_CODES  -> check SPOT wallet only
    // - All other fees       -> check MAIN/OTHER wallet only
    if (!allowNegative) {
      if (SPOT_ONLY_FEE_CODES.has(reason)) {
        if (spotBalance < amount) {
          const error: any = new Error('INSUFFICIENT_BALANCE');
          error.code = 'INSUFFICIENT_BALANCE';
          error.required = amount;
          error.available = spotBalance;
          throw error;
        }
      } else {
        if (otherBalance < amount) {
          const error: any = new Error('INSUFFICIENT_BALANCE');
          error.code = 'INSUFFICIENT_BALANCE';
          error.required = amount;
          error.available = otherBalance;
          throw error;
        }
      }
    }

    // Idempotency check
    const existing = await tx.fee_transactions.findFirst({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) return existing;

    // Calculate which wallet(s) to deduct from BEFORE creating ledger entry
    let spotDeducted = 0;
    let otherDeducted = 0;
    let walletType = 'other_balance'; // Default

    // Decide which wallet(s) to deduct from BEFORE creating ledger entry
    // IMPORTANT:
    // - SPOT_ONLY_FEE_CODES -> always spot_balance only (never touch main)
    // - All other fees      -> always other_balance only (never touch spot)
    if (SPOT_ONLY_FEE_CODES.has(reason)) {
      // Always and only SPOT wallet
      spotDeducted = amount;
      walletType = 'spot_balance';
    } else {
      // Default: MAIN/OTHER wallet only
      otherDeducted = amount;
      walletType = 'other_balance';
    }

    // Create ledger entry for fee deduction (for complete audit trail)
    let ledger;
    try {
      ledger = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId, // Self-initiated (fee deduction)
          purchase_id: null,
          commission_type: 'FEE_DEDUCTION' as any,
          amount: -amount, // Negative for debit
          metadata: {
            rule_code: reason,
            reference_id: referenceId?.toString(),
            reference_type: referenceType,
            wallet_type: walletType, // Track which wallet(s) were deducted from
            spot_deducted: spotDeducted,
            other_deducted: otherDeducted,
          } as any,
          idempotency_key: idempotencyKey,
        },
      });
    } catch (e: any) {
      // If another retry already created this entry, return the existing one gracefully
      if (e?.code === 'P2002') {
        const existingLedger = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
        if (existingLedger) {
          // Get existing fee transaction
          const existingFee = await tx.fee_transactions.findFirst({ where: { idempotency_key: idempotencyKey } });
          if (existingFee) return existingFee;
        }
      }
      throw e;
    }

    // Create fee transaction
    const feeTransaction = await tx.fee_transactions.create({
      data: {
        user_id: userId,
        rule_code: reason,
        amount: -amount, // Negative for debit
        transaction_type: 'FEE_DEDUCTION',
        reference_id: referenceId ?? null,
        reference_type: referenceType ?? null,
        description: reason,
        idempotency_key: idempotencyKey,
      },
    });

    // Create wallet transaction (negative amount) linked to ledger entry
    await tx.wallet_transactions.create({
      data: {
        receiver_user_id: userId,
        ledger_entry_id: ledger.id,
        amount: -amount,
        idempotency_key: idempotencyKey,
      },
    });

    // Update balance (decrement)
    // Check if user_balances record exists, create if not
    const existingBalance = await tx.user_balances.findUnique({
      where: { user_id: userId },
    });
    if (!existingBalance) {
      await tx.user_balances.create({
        data: { user_id: userId, balance: 0, spot_balance: 0, other_balance: 0, team_royalty_balance: 0 },
      });
    }

    // Use raw SQL to decrement balance to avoid decimal math issues in Prisma
    await tx.$executeRawUnsafe(
      `UPDATE user_balances 
       SET balance = balance - $1, 
           spot_balance = spot_balance - $2, 
           other_balance = other_balance - $3, 
           updated_at = now() 
       WHERE user_id = $4`,
      amount,
      spotDeducted,
      otherDeducted,
      userId
    );

    return feeTransaction;
  });
}

/**
 * Sum of SELF + GLOBAL_HELPING commission amounts that are still under reinvestment lock (hold_until > today).
 * Used to compute available main balance = other_balance - getLockedMainBalance(userId).
 */
export async function getLockedMainBalance(userId: bigint): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ sum: string | null }>>`
    SELECT COALESCE(SUM(le.amount), 0)::text AS sum
    FROM ledger_entries le
    WHERE le.receiver_user_id = ${userId}
      AND le.commission_type IN ('SELF', 'GLOBAL_HELPING')
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date > CURRENT_DATE
  `;
  const sum = result[0]?.sum;
  return sum != null ? Number(sum) : 0;
}

/**
 * Sum of SPOT commission amounts that are still under 14-day hold (hold_until > today).
 * Used to compute withdrawable spot = spot_balance - lockedSpotBalance.
 */
export async function getLockedSpotBalance(userId: bigint): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ sum: string | null }>>`
    SELECT COALESCE(SUM(le.amount), 0)::text AS sum
    FROM ledger_entries le
    WHERE le.receiver_user_id = ${userId}
      AND le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date > CURRENT_DATE
  `;
  const sum = result[0]?.sum;
  return sum != null ? Number(sum) : 0;
}

export type SpotHoldDetail = {
  ledger_id: string;
  amount: number;
  source_user_id: string;
  source_display_id: string;
  source_name: string | null;
  credited_at: string;
  hold_until: string;
  level: number | null;
  depth: number | null;
};

/**
 * List of SPOT entries still under 14-day hold, with source and hold_until for user clarity.
 */
export async function getSpotHoldDetails(userId: bigint): Promise<SpotHoldDetail[]> {
  const entries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'SPOT',
    },
    select: {
      id: true,
      amount: true,
      source_user_id: true,
      credited_at: true,
      metadata: true,
    },
    orderBy: { credited_at: 'desc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateOnly(today);

  const out: SpotHoldDetail[] = [];
  for (const e of entries) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const holdUntil = meta.hold_until as string | undefined;
    if (!holdUntil || holdUntil <= todayStr) continue; // only include locked ones (hold_until > today)
    const level = meta.level as number | undefined;
    const depth = meta.depth as number | undefined;
    const sourceUser = await prisma.users.findUnique({
      where: { id: e.source_user_id },
      select: { display_id: true, name: true },
    });
    out.push({
      ledger_id: e.id.toString(),
      amount: Number(e.amount),
      source_user_id: e.source_user_id.toString(),
      source_display_id: sourceUser?.display_id ?? '',
      source_name: sourceUser?.name ?? null,
      credited_at: e.credited_at.toISOString(),
      hold_until: holdUntil,
      level: level ?? null,
      depth: depth ?? null,
    });
  }
  return out;
}
