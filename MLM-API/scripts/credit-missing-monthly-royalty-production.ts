import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { isUserActive, getUplines } from '../src/utils/business.js';
import { calculateDailyPaise, paiseToRupees } from '../src/utils/paise.js';
import { daysInMonth } from '../src/utils/dateUtils.js';

// Production database connection
// This will use PRODUCTION_DATABASE_URL from environment
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

// Custom addLedgerAndWallet function that uses production prisma instance
async function addLedgerAndWallet(params: {
  receiverId: bigint;
  sourceId: bigint;
  purchaseId?: bigint | null;
  amount: number;
  type: 'SELF' | 'GLOBAL_HELPING' | 'SPOT' | 'MONTHLY' | 'ADMIN_OPS';
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  creditedAt?: Date;
}) {
  const { receiverId, sourceId, purchaseId, amount, type, metadata, idempotencyKey, creditedAt } = params;

  return prisma.$transaction(async (tx) => {
    // Per-user advisory lock for wallet concurrency safety
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      `user:${receiverId.toString()}`
    );

    // Idempotency check
    const existing = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
    if (existing) return existing;

    // Determine which wallet this commission goes to
    const walletType = type === 'SPOT' 
      ? 'spot_balance' 
      : type === 'ADMIN_OPS' && metadata?.wallet_type
        ? metadata.wallet_type as string
        : 'other_balance';
    
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
            wallet_type: walletType,
          } as any,
          idempotency_key: idempotencyKey,
          credited_at: creditedAt || new Date(),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const existingAfter = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
        if (existingAfter) return existingAfter;
      }
      throw e;
    }

    await tx.wallet_transactions.create({
      data: {
        receiver_user_id: receiverId,
        ledger_entry_id: ledger.id,
        amount,
        idempotency_key: idempotencyKey,
      },
    });

    // Check if user_balances record exists
    const existingBalance = await tx.user_balances.findUnique({
      where: { user_id: receiverId },
    });
    if (!existingBalance) {
      await tx.user_balances.create({
        data: { user_id: receiverId, balance: 0, spot_balance: 0, other_balance: 0 },
      });
    } else {
      await tx.user_balances.update({
        where: { user_id: receiverId },
        data: { updated_at: new Date() },
      });
    }

    // Use raw SQL to increment balance
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
      } else {
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
          amount,
          receiverId
        );
      }
    } else {
      // SELF, GLOBAL_HELPING, MONTHLY go to other_balance
      await tx.$executeRawUnsafe(
        'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
        amount,
        receiverId
      );
    }

    return ledger;
  });
}

/**
 * Credit missing monthly royalties for purchases from 18-23 Dec 2025
 * This script processes past dates exactly like the daily commission job
 * Creates ledger entries and wallet transactions for each day
 * 
 * IMPORTANT: This script is for PRODUCTION database (postgres-0)
 * Set PRODUCTION_DATABASE_URL environment variable before running
 */
async function creditMissingMonthlyRoyalty() {
  console.log('🚀 Starting Missing Monthly Royalty Credit Script (PRODUCTION)...\n');
  console.log('⚠️  WARNING: This will credit royalties in PRODUCTION database!\n');
  console.log('📅 Processing purchases from 18 Dec 2025 to 23 Dec 2025\n');

  // Date range: 18 Dec 2025 to 23 Dec 2025
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`Purchase Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`Processing dates: Purchase date to ${today.toISOString().split('T')[0]}\n`);

  // Get all purchases in this date range
  const purchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      purchased_at: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      purchased_at: true,
      income: true,
    } as any,
    orderBy: {
      purchased_at: 'asc',
    },
  });

  console.log(`✅ Found ${purchases.length} purchases to process\n`);

  if (purchases.length === 0) {
    console.log('No purchases found in this date range.\n');
    return;
  }

  // Get all packages
  const packageIds = Array.from(new Set(purchases.map((p) => p.package_id)));
  const packages = await prisma.packages.findMany({
    where: {
      id: { in: packageIds },
    },
    select: {
      id: true,
      recurring_rate_percent: true,
    },
  });
  const packageMap = new Map(
    packages.map((p) => [p.id, p])
  );

  let totalCredited = 0;
  let totalSkipped = 0;
  let totalAmount = 0;

  // Process each purchase
  for (const purchase of purchases) {
    const purchaseId = purchase.id as unknown as bigint;
    const buyerId = purchase.user_id as unknown as bigint;
    const purchaseAmount = Number(purchase.amount);
    const purchaseDate = new Date(purchase.purchased_at);
    purchaseDate.setHours(0, 0, 0, 0);

    // Check if purchase reached 2x
    const isPurchase2x = await CommissionService.isPurchaseDoubleReached(purchaseId);
    if (isPurchase2x) {
      console.log(`⏭️  Purchase ${purchaseId}: Reached 2x, skipping...`);
      totalSkipped++;
      continue;
    }

    // Check if buyer is active
    const buyerActive = await isUserActive(buyerId);
    if (!buyerActive) {
      console.log(`⏭️  Purchase ${purchaseId}: Buyer not active, skipping...`);
      totalSkipped++;
      continue;
    }

    // Get package
    const pkg = packageMap.get(purchase.package_id);
    if (!pkg) {
      console.log(`⏭️  Purchase ${purchaseId}: Package not found, skipping...`);
      totalSkipped++;
      continue;
    }

    // Get all uplines (Level 0-9, depth 1-10)
    const uplines = await getUplines(buyerId, 9);

    // Process each upline
    for (const { ancestor_id, depth } of uplines) {
      const level = depth - 1; // depth 1 → level 0, depth 2 → level 1, etc.
      const uplineId = ancestor_id as unknown as bigint;

      // Check if upline is disqualified
      const upline = await prisma.users.findUnique({
        where: { id: uplineId },
        select: { is_disqualified: true },
      });
      if (upline?.is_disqualified) continue;

      // FIX: Level 0 (Direct Referrer) Eligibility Check
      // Level 0 is ALWAYS eligible - no need to check database
      const eligible = level === 0 ? true : await checkEligibility(uplineId, level);
      if (!eligible) continue;

      // Check if upline is active
      const uplineActive = await isUserActive(uplineId);
      if (!uplineActive) continue;

      // FIX: Level 0 (Direct Referrer) Monthly Royalty Percentage
      // Level 0 should use package's recurring_rate_percent (0.50% to 1% based on package)
      let monthlyPercent: number;
      if (level === 0) {
        // Level 0 (Direct Referrer): Use package's recurring_rate_percent
        monthlyPercent = pkg.recurring_rate_percent 
          ? Number(pkg.recurring_rate_percent) / 100 
          : 0.005; // Default 0.5% if not found
      } else {
        // Level 1-9 (Team Levels): Use levels table monthly_royalty_percent
        const levelData = await prisma.levels.findUnique({ where: { level } });
        monthlyPercent = levelData?.monthly_royalty_percent 
          ? Number(levelData.monthly_royalty_percent) / 100 
          : 0.005; // Default 0.5% if not found
      }

      let monthly = purchaseAmount * monthlyPercent;

      // Check if this purchase is a reinvestment (for 50% reduction on Level 1+)
      const isReinvestment = await CommissionService.isReinvestment(purchaseId, buyerId);

      // Level 0 (direct referrer) always gets 100%, Level 1+ get 50% on reinvestments
      if (isReinvestment && level >= 1) {
        monthly = monthly * 0.5; // 50% reduction
      }

      // Process each date from 18 Dec to 23 Dec (as per requirement)
      // Only credit for dates from 18 Dec onwards, not before
      const processStartDate = new Date('2025-12-18T00:00:00.000Z');
      processStartDate.setHours(0, 0, 0, 0);
      
      // Start from max(purchase date, 18 Dec) to ensure we don't credit before 18 Dec
      // Also ensure we don't credit after 23 Dec
      const startDate = purchaseDate > processStartDate ? purchaseDate : processStartDate;
      const endDate = new Date('2025-12-23T23:59:59.999Z');
      const currentDate = new Date(startDate);
      
      // Only process dates from 18 Dec to 23 Dec
      while (currentDate <= endDate && currentDate <= today) {
        // Get days in month for this date
        const daysInThisMonth = daysInMonth(currentDate);
        const isLastDayOfMonth = currentDate.getDate() === new Date(
          currentDate.getFullYear(), 
          currentDate.getMonth() + 1, 
          0
        ).getDate();

        // Calculate daily amount for this month
        const { dailyPaise, remainderPaise } = calculateDailyPaise(monthly, daysInThisMonth);
        let dailyAmount: number;
        if (isLastDayOfMonth && remainderPaise > 0n) {
          dailyAmount = paiseToRupees(dailyPaise + remainderPaise);
        } else {
          dailyAmount = paiseToRupees(dailyPaise);
        }

        if (dailyAmount > 0) {
          // Fixed idempotency key: daily:monthly:{purchaseId}:{uplineId}:{level}:{date}
          const dateStr = currentDate.toISOString().slice(0, 10);
          const monthlyIdk = `daily:monthly:${purchaseId}:${uplineId}:${level}:${dateStr}`;

          // Check if already credited (idempotency)
          const existingMonthly = await prisma.ledger_entries.findFirst({
            where: { idempotency_key: monthlyIdk },
          });

          if (!existingMonthly) {
            // Credit for this specific date
            // Set credited_at to the date we're processing (not current time)
            const creditedAt = new Date(currentDate);
            creditedAt.setHours(5, 35, 0, 0); // Set to 5:35 AM IST (00:05 UTC) like cron job

            await addLedgerAndWallet({
              receiverId: uplineId,
              sourceId: buyerId,
              purchaseId: purchaseId,
              amount: dailyAmount,
              type: 'MONTHLY',
              metadata: {
                level,
                is_reinvestment: isReinvestment,
                credited_by_daily_job: true,
                date: dateStr,
                backfilled: true, // Mark as backfilled
              },
              idempotencyKey: monthlyIdk,
              creditedAt: creditedAt,
            });

            totalCredited++;
            totalAmount += dailyAmount;
            console.log(`    ✅ MONTHLY: Purchase ${purchaseId}, Upline ${uplineId} (Level ${level}), Date: ${dateStr}, Amount: ₹${dailyAmount.toFixed(2)}`);
          } else {
            console.log(`    ⏭️  Already credited: Purchase ${purchaseId}, Upline ${uplineId} (Level ${level}), Date: ${dateStr}`);
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📊 Summary:\n');
  console.log(`   Total purchases processed: ${purchases.length}`);
  console.log(`   Total credits made: ${totalCredited}`);
  console.log(`   Total skipped: ${totalSkipped}`);
  console.log(`   Total amount credited: ₹${totalAmount.toFixed(2)}`);
  console.log('\n✅ Missing monthly royalties credited successfully in PRODUCTION!\n');
}

// Helper function for checkEligibility (same as business.ts)
async function checkEligibility(userId: bigint, level: number): Promise<boolean> {
  const row = await prisma.level_eligibility.findUnique({ where: { user_id: userId } });
  if (!row) return false;
  const key = String(level);
  const map = row.eligibility as Record<string, boolean>;
  return Boolean(map?.[key]);
}

async function main() {
  try {
    // Verify production database connection
    const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ Error: PRODUCTION_DATABASE_URL or DATABASE_URL not set!');
      console.error('   Please set PRODUCTION_DATABASE_URL environment variable');
      console.error('   Example: export PRODUCTION_DATABASE_URL="postgresql://mlm_user:password@host:port/mlm_commission"');
      process.exit(1);
    }
    
    console.log('🔗 Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
    console.log('');
    
    await creditMissingMonthlyRoyalty();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

