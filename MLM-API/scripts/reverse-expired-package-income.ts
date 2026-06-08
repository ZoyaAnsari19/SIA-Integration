import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

interface InvalidEntry {
  ledgerId: bigint;
  purchaseId: bigint;
  userId: bigint;
  commissionType: string;
  amount: number;
  creditedAt: Date;
  expiryDate: Date;
}

async function main() {
  console.log('============================================================');
  console.log('🔄 Reversing Invalid Income from Expired Packages');
  console.log('============================================================\n');

  const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run for safety
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Set DRY_RUN=false to actually reverse entries\n');
  }

  // Step 1: Find all expired purchases
  console.log('📊 Step 1: Finding expired purchases...\n');
  
  const allPurchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      income: true,
      purchased_at: true,
    } as any,
  });

  const expiredPurchases: Array<{
    purchaseId: bigint;
    userId: bigint;
    amount: number;
    income: number;
    doubleAmount: number;
    purchasedAt: Date;
  }> = [];

  for (const purchase of allPurchases) {
    const amount = Number(purchase.amount);
    const income = Number((purchase as any).income || 0);
    const doubleAmount = amount * 2;
    
    if (income >= doubleAmount) {
      expiredPurchases.push({
        purchaseId: purchase.id as unknown as bigint,
        userId: purchase.user_id as unknown as bigint,
        amount,
        income,
        doubleAmount,
        purchasedAt: purchase.purchased_at,
      });
    }
  }

  console.log(`✅ Found ${expiredPurchases.length} expired purchases\n`);

  // Step 2: Find invalid entries (income after expiry)
  console.log('📊 Step 2: Finding invalid income entries...\n');

  const invalidEntries: InvalidEntry[] = [];

  for (const expired of expiredPurchases) {
    // Find expiry date (when cumulative SELF+GLOBAL reached 2x)
    const selfGlobalEntries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: expired.purchaseId,
        receiver_user_id: expired.userId,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
      orderBy: { credited_at: 'asc' },
      select: { amount: true, credited_at: true },
    });

    let cumulative = 0;
    let expiryDate: Date | null = null;
    for (const entry of selfGlobalEntries) {
      cumulative += Number(entry.amount);
      if (cumulative >= expired.doubleAmount && !expiryDate) {
        expiryDate = entry.credited_at;
        break;
      }
    }

    if (!expiryDate) {
      expiryDate = expired.purchasedAt; // Conservative estimate
    }

    // Find entries AFTER expiry
    const entries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: expired.purchaseId,
        credited_at: { gte: expiryDate },
        commission_type: { in: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
      },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
        receiver_user_id: true,
        idempotency_key: true,
      },
    });

    for (const entry of entries) {
      // Check if already reversed
      const reversalKey = `reversal:expired:${entry.id}`;
      const existingReversal = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: reversalKey },
      });

      if (!existingReversal) {
        invalidEntries.push({
          ledgerId: entry.id as unknown as bigint,
          purchaseId: expired.purchaseId,
          userId: entry.receiver_user_id as unknown as bigint,
          commissionType: entry.commission_type,
          amount: Number(entry.amount),
          creditedAt: entry.credited_at,
          expiryDate,
        });
      }
    }
  }

  console.log(`✅ Found ${invalidEntries.length} invalid entries to reverse\n`);

  if (invalidEntries.length === 0) {
    console.log('✅ No invalid entries found. All already reversed or none exist.\n');
    return;
  }

  // Step 3: Group by user for summary
  const userTotals = new Map<bigint, { count: number; total: number }>();
  for (const entry of invalidEntries) {
    if (!userTotals.has(entry.userId)) {
      userTotals.set(entry.userId, { count: 0, total: 0 });
    }
    const userData = userTotals.get(entry.userId)!;
    userData.count++;
    userData.total += entry.amount;
  }

  console.log('============================================================');
  console.log('📋 REVERSAL SUMMARY:');
  console.log('============================================================\n');
  console.log(`Total Invalid Entries: ${invalidEntries.length}`);
  console.log(`Total Amount to Reverse: ₹${invalidEntries.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}`);
  console.log(`Affected Users: ${userTotals.size}\n`);

  // Step 4: Reverse entries
  if (!DRY_RUN) {
    console.log('🔄 Starting reversal process...\n');
  } else {
    console.log('📋 DRY RUN - Would reverse the following:\n');
  }

  let reversedCount = 0;
  let reversedAmount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Group by purchase to update income efficiently
  const purchaseIncomeUpdates = new Map<bigint, number>();

  for (const entry of invalidEntries) {
    try {
      const reversalAmount = -entry.amount; // Negative for reversal
      const reversalKey = `reversal:expired:${entry.ledgerId}`;

      // Determine wallet type based on commission type
      const walletType = entry.commissionType === 'SPOT' ? 'spot_balance' : 'other_balance';

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          // Advisory lock for user
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1));',
            `user:${entry.userId.toString()}`
          );

          // Check if already reversed (idempotency)
          const existing = await tx.ledger_entries.findFirst({
            where: { idempotency_key: reversalKey },
          });

          if (existing) {
            skippedCount++;
            return;
          }

          // Get current balance
          const balance = await tx.user_balances.findUnique({
            where: { user_id: entry.userId },
            select: { spot_balance: true, other_balance: true, balance: true },
          });

          const currentBalance = Number(balance?.balance || 0);
          const spotBalance = Number(balance?.spot_balance || 0);
          const otherBalance = Number(balance?.other_balance || 0);

          // Create reversal ledger entry
          const reversalLedger = await tx.ledger_entries.create({
            data: {
              receiver_user_id: entry.userId,
              source_user_id: entry.userId,
              purchase_id: entry.purchaseId,
              commission_type: 'ADMIN_OPS' as any,
              amount: reversalAmount, // Negative amount
              metadata: {
                reason: 'Reversal: Invalid income from expired package',
                original_ledger_id: entry.ledgerId.toString(),
                original_commission_type: entry.commissionType,
                original_amount: entry.amount,
                expiry_date: entry.expiryDate.toISOString(),
                wallet_type: walletType,
                reversal_type: 'expired_package_income',
              } as any,
              idempotency_key: reversalKey,
              credited_at: new Date(),
            },
          });

          // Create wallet transaction
          await tx.wallet_transactions.create({
            data: {
              receiver_user_id: entry.userId,
              ledger_entry_id: reversalLedger.id,
              amount: reversalAmount,
              idempotency_key: reversalKey,
            },
          });

          // Update wallet balance
          if (walletType === 'spot_balance') {
            await tx.$executeRawUnsafe(
              `UPDATE user_balances 
               SET balance = balance + $1::numeric,
                   spot_balance = spot_balance + $1::numeric,
                   updated_at = NOW()
               WHERE user_id = $2`,
              reversalAmount,
              entry.userId
            );
          } else {
            await tx.$executeRawUnsafe(
              `UPDATE user_balances 
               SET balance = balance + $1::numeric,
                   other_balance = other_balance + $1::numeric,
                   updated_at = NOW()
               WHERE user_id = $2`,
              reversalAmount,
              entry.userId
            );
          }

          // Track purchase income reduction
          if (!purchaseIncomeUpdates.has(entry.purchaseId)) {
            purchaseIncomeUpdates.set(entry.purchaseId, 0);
          }
          purchaseIncomeUpdates.set(
            entry.purchaseId,
            purchaseIncomeUpdates.get(entry.purchaseId)! + entry.amount
          );
        });

        reversedCount++;
        reversedAmount += entry.amount;
      } else {
        // Dry run - just log
        const user = await prisma.users.findUnique({
          where: { id: entry.userId },
          select: { display_id: true, name: true },
        });
        console.log(`  Would reverse: ${user?.display_id || entry.userId} - ${entry.commissionType} ₹${entry.amount.toFixed(2)}`);
        reversedCount++;
        reversedAmount += entry.amount;
      }
    } catch (error: any) {
      errorCount++;
      console.error(`  ❌ Error reversing entry ${entry.ledgerId}:`, error.message);
    }
  }

  // Step 5: Update purchase.income
  if (!DRY_RUN && purchaseIncomeUpdates.size > 0) {
    console.log('\n📊 Step 5: Updating purchase income...\n');

    for (const [purchaseId, reduction] of purchaseIncomeUpdates) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE purchases 
           SET income = income - $1::numeric
           WHERE id = $2`,
          reduction,
          purchaseId
        );
        console.log(`  ✅ Updated purchase ${purchaseId}: Reduced income by ₹${reduction.toFixed(2)}`);
      } catch (error: any) {
        console.error(`  ❌ Error updating purchase ${purchaseId}:`, error.message);
      }
    }
  }

  // Final summary
  console.log('\n============================================================');
  console.log('✅ REVERSAL COMPLETE');
  console.log('============================================================\n');
  console.log(`Reversed Entries: ${reversedCount}`);
  console.log(`Total Amount Reversed: ₹${reversedAmount.toFixed(2)}`);
  console.log(`Skipped (already reversed): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run with DRY_RUN=false to actually reverse entries.');
  }
  console.log('');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
