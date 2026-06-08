import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if production is allowed
  if (process.env.ALLOW_PRODUCTION !== 'true') {
    console.error('❌ PRODUCTION mode not enabled!');
    console.error('   Set ALLOW_PRODUCTION=true to run on production');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('Fixing Post-Withdrawal Balance Mismatches (PRODUCTION)');
  console.log('============================================================\n');

  // Get all users with approved withdrawals
  const usersWithWithdrawals = await prisma.withdraw_requests.findMany({
    where: { status: 'approved' },
    select: { user_id: true, amount: true, updated_at: true, created_at: true },
    distinct: ['user_id'],
  });

  console.log(`Found ${usersWithWithdrawals.length} users with approved withdrawals\n`);

  const fixes: Array<{
    userId: bigint;
    displayId: string;
    name: string;
    currentOtherBalance: number;
    expectedOtherBalance: number;
    adjustment: number;
    newOtherBalance: number;
    newTotalBalance: number;
  }> = [];

  for (const withdrawal of usersWithWithdrawals) {
    const userId = withdrawal.user_id;
    const withdrawalDate = withdrawal.updated_at || withdrawal.created_at;

    // Get user details
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, display_id: true, name: true },
    });

    if (!user) continue;

    // Get active purchases (not reached 2x)
    const activePurchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        status: 'completed',
      },
      select: { id: true, amount: true, income: true },
    });

    // Filter active purchases (income < 2x amount)
    const trulyActivePurchases = activePurchases.filter(
      (p) => Number(p.income || 0) < Number(p.amount) * 2
    );

    if (trulyActivePurchases.length === 0) continue;

    const activePurchaseIds = trulyActivePurchases.map((p) => p.id);

    // Get SELF commissions AFTER withdrawal from active packages
    const selfAfter = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: userId,
        commission_type: 'SELF',
        credited_at: { gt: withdrawalDate },
        purchase_id: { in: activePurchaseIds },
      },
      select: { amount: true },
    });

    // Get GLOBAL_HELPING commissions AFTER withdrawal from active packages
    const globalAfter = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: userId,
        commission_type: 'GLOBAL_HELPING',
        credited_at: { gt: withdrawalDate },
        purchase_id: { in: activePurchaseIds },
      },
      select: { amount: true },
    });

    const selfTotal = selfAfter.reduce((sum, e) => sum + Number(e.amount), 0);
    const globalTotal = globalAfter.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalAfter = selfTotal + globalTotal;

    // Get current balance
    const balance = await prisma.user_balances.findUnique({
      where: { user_id: userId },
      select: { other_balance: true, spot_balance: true, balance: true },
    });

    if (!balance) continue;

    const currentOtherBalance = Number(balance.other_balance || 0);
    const currentSpotBalance = Number(balance.spot_balance || 0);
    const currentTotalBalance = Number(balance.balance || 0);

    // Expected other_balance = SELF + GLOBAL commissions after withdrawal
    const expectedOtherBalance = totalAfter;
    const adjustment = expectedOtherBalance - currentOtherBalance;

    // Only fix if there's a significant mismatch (more than ₹1)
    if (Math.abs(adjustment) < 1) continue;

    const newOtherBalance = expectedOtherBalance;
    const newTotalBalance = currentSpotBalance + newOtherBalance;

    fixes.push({
      userId,
      displayId: user.display_id,
      name: user.name || 'N/A',
      currentOtherBalance,
      expectedOtherBalance,
      adjustment,
      newOtherBalance,
      newTotalBalance,
    });
  }

  console.log(`Found ${fixes.length} users needing balance fixes\n`);

  if (fixes.length === 0) {
    console.log('✅ No fixes needed!');
    await prisma.$disconnect();
    return;
  }

  // Show what will be fixed
  console.log('📋 Users to be Fixed (Top 20):\n');
  console.log(
    'User ID'.padEnd(12) +
      'Name'.padEnd(25) +
      'Current Other'.padEnd(15) +
      'Expected'.padEnd(15) +
      'Adjustment'.padEnd(15) +
      'New Other'.padEnd(15)
  );
  console.log('-'.repeat(100));

  for (const fix of fixes.slice(0, 20)) {
    console.log(
      `${fix.displayId.padEnd(10)} ` +
        `${(fix.name || 'N/A').substring(0, 23).padEnd(23)} ` +
        `₹${fix.currentOtherBalance.toFixed(2).padStart(12)} ` +
        `₹${fix.expectedOtherBalance.toFixed(2).padStart(12)} ` +
        `₹${fix.adjustment.toFixed(2).padStart(12)} ` +
        `₹${fix.newOtherBalance.toFixed(2).padStart(12)}`
    );
  }

  if (fixes.length > 20) {
    console.log(`\n... and ${fixes.length - 20} more users`);
  }

  console.log('\n⚠️  PRODUCTION DATABASE - About to update balances!');
  console.log(`   Total users to fix: ${fixes.length}`);
  console.log('\n   Waiting 3 seconds before proceeding...\n');

  // Wait 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('\n🔧 Applying fixes to PRODUCTION...\n');

  let fixedCount = 0;
  let errorCount = 0;

  for (const fix of fixes) {
    try {
      await prisma.user_balances.update({
        where: { user_id: fix.userId },
        data: {
          other_balance: fix.newOtherBalance,
          balance: fix.newTotalBalance,
          updated_at: new Date(),
        },
      });

      fixedCount++;
      if (fixedCount % 50 === 0) {
        console.log(`   Fixed ${fixedCount}/${fixes.length} users...`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error fixing ${fix.displayId}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n✅ Fix Complete!');
  console.log(`   ✅ Successfully fixed: ${fixedCount} users`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount} users`);
  }

  // Verify fixes
  console.log('\n🔍 Verifying fixes (sample of 10 users)...\n');
  let verifiedCount = 0;
  let stillMismatchedCount = 0;

  for (const fix of fixes.slice(0, 10)) {
    const balance = await prisma.user_balances.findUnique({
      where: { user_id: fix.userId },
      select: { other_balance: true },
    });

    const actualOtherBalance = Number(balance?.other_balance || 0);
    const diff = Math.abs(actualOtherBalance - fix.expectedOtherBalance);

    if (diff < 1) {
      verifiedCount++;
    } else {
      stillMismatchedCount++;
      console.log(
        `   ⚠️  ${fix.displayId}: Expected ₹${fix.expectedOtherBalance.toFixed(2)}, Got ₹${actualOtherBalance.toFixed(2)}, Diff: ₹${diff.toFixed(2)}`
      );
    }
  }

  console.log(`\n   ✅ Verified: ${verifiedCount} users`);
  if (stillMismatchedCount > 0) {
    console.log(`   ⚠️  Still mismatched: ${stillMismatchedCount} users`);
  }

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
