import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('Checking Post-Withdrawal Commissions vs Other Balance');
  console.log('============================================================\n');

  // Get all users with approved withdrawals
  const usersWithWithdrawals = await prisma.withdraw_requests.findMany({
    where: { status: 'approved' },
    select: { user_id: true, amount: true, updated_at: true, created_at: true },
    distinct: ['user_id'],
  });

  console.log(`Found ${usersWithWithdrawals.length} users with approved withdrawals\n`);

  const results: Array<{
    userId: bigint;
    displayId: string;
    name: string;
    withdrawalDate: Date;
    withdrawalAmount: number;
    selfAfter: number;
    globalAfter: number;
    totalAfter: number;
    otherBalance: number;
    difference: number;
    activePackages: number;
  }> = [];

  for (const withdrawal of usersWithWithdrawals) { // Check all users
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

    // Get current other_balance
    const balance = await prisma.user_balances.findUnique({
      where: { user_id: userId },
      select: { other_balance: true },
    });

    const otherBalance = Number(balance?.other_balance || 0);
    const difference = totalAfter - otherBalance;

    results.push({
      userId,
      displayId: user.display_id,
      name: user.name || 'N/A',
      withdrawalDate,
      withdrawalAmount: Number(withdrawal.amount),
      selfAfter: selfTotal,
      globalAfter: globalTotal,
      totalAfter,
      otherBalance,
      difference,
      activePackages: trulyActivePurchases.length,
    });
  }

  // Sort by difference (largest mismatch first)
  results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  // Separate matches and mismatches
  const matches = results.filter(r => Math.abs(r.difference) < 1);
  const mismatches = results.filter(r => Math.abs(r.difference) >= 1);

  console.log('📊 All Results:\n');
  console.log(
    'User ID'.padEnd(12) +
      'Name'.padEnd(25) +
      'Withdrawal'.padEnd(12) +
      'SELF+GLB'.padEnd(12) +
      'Other Bal'.padEnd(12) +
      'Diff'.padEnd(12) +
      'Active Pkg'
  );
  console.log('-'.repeat(100));

  // Show all mismatches first
  for (const r of mismatches) {
    const status = '⚠️';
    console.log(
      `${status} ${r.displayId.padEnd(10)} ` +
        `${(r.name || 'N/A').substring(0, 23).padEnd(23)} ` +
        `₹${r.withdrawalAmount.toFixed(0).padStart(10)} ` +
        `₹${r.totalAfter.toFixed(2).padStart(10)} ` +
        `₹${r.otherBalance.toFixed(2).padStart(10)} ` +
        `₹${r.difference.toFixed(2).padStart(10)} ` +
        `${r.activePackages}`
    );
  }

  // Show matches if any
  if (matches.length > 0) {
    console.log('\n✅ Matches:');
    for (const r of matches) {
      console.log(
        `✅ ${r.displayId.padEnd(10)} ` +
          `${(r.name || 'N/A').substring(0, 23).padEnd(23)} ` +
          `₹${r.withdrawalAmount.toFixed(0).padStart(10)} ` +
          `₹${r.totalAfter.toFixed(2).padStart(10)} ` +
          `₹${r.otherBalance.toFixed(2).padStart(10)} ` +
          `₹${r.difference.toFixed(2).padStart(10)} ` +
          `${r.activePackages}`
      );
    }
  }

  console.log('\n📈 Summary:');
  console.log(`   Total Users Checked: ${results.length}`);
  console.log(`   ✅ Matches: ${matches.length}`);
  console.log(`   ⚠️  Mismatches: ${mismatches.length}`);
  console.log(`   Match Rate: ${((matches.length / results.length) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Complete Mismatch List:');
  console.log(`   Total Mismatched Users: ${mismatches.length}`);
  console.log('\n   User IDs with Mismatches:');
  mismatches.forEach((r, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(3)}. ${r.displayId} - ${r.name || 'N/A'} (Diff: ₹${r.difference.toFixed(2)})`);
  });

  // Show detailed breakdown for top mismatches
  console.log('\n🔍 Top 5 Mismatches Details:\n');
  for (const r of results.slice(0, 5)) {
    if (Math.abs(r.difference) < 1) break;
    console.log(`User: ${r.displayId} (${r.name})`);
    console.log(`   Withdrawal: ₹${r.withdrawalAmount.toFixed(2)} on ${r.withdrawalDate.toISOString().split('T')[0]}`);
    console.log(`   SELF After: ₹${r.selfAfter.toFixed(2)}`);
    console.log(`   GLOBAL After: ₹${r.globalAfter.toFixed(2)}`);
    console.log(`   Total (SELF+GLOBAL): ₹${r.totalAfter.toFixed(2)}`);
    console.log(`   Other Balance: ₹${r.otherBalance.toFixed(2)}`);
    console.log(`   Difference: ₹${r.difference.toFixed(2)}`);
    console.log(`   Active Packages: ${r.activePackages}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
