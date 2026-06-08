import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00635';
  
  console.log('============================================================');
  console.log(`SIA00635 - Commissions AFTER Withdrawal`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, name: true },
  });

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  // Get withdrawal approval date
  const withdrawal = await prisma.withdraw_requests.findFirst({
    where: { 
      user_id: user.id, 
      status: { in: ['APPROVED', 'COMPLETED'] } 
    },
    orderBy: { updated_at: 'desc' },
    select: { amount: true, status: true, created_at: true, updated_at: true }
  });

  if (!withdrawal) {
    console.log('❌ No approved withdrawal found!');
    await prisma.$disconnect();
    return;
  }

  const withdrawalDate = withdrawal.updated_at || withdrawal.created_at;

  console.log('💸 Withdrawal Details:');
  console.log(`   Amount: ₹${Number(withdrawal.amount).toFixed(2)}`);
  console.log(`   Status: ${withdrawal.status}`);
  console.log(`   Created: ${withdrawal.created_at.toISOString().split('T')[0]}`);
  console.log(`   Approved/Updated: ${withdrawalDate.toISOString().split('T')[0]}`);
  console.log('\n📅 Checking commissions AFTER withdrawal date...\n');

  // Get SELF commissions AFTER withdrawal
  const selfAfter = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SELF',
      credited_at: { gt: withdrawalDate }
    },
    select: { amount: true, credited_at: true },
    orderBy: { credited_at: 'asc' }
  });
  const selfAfterTotal = selfAfter.reduce((sum, e) => sum + Number(e.amount), 0);

  // Get GLOBAL_HELPING commissions AFTER withdrawal
  const globalAfter = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'GLOBAL_HELPING',
      credited_at: { gt: withdrawalDate }
    },
    select: { amount: true, credited_at: true },
    orderBy: { credited_at: 'asc' }
  });
  const globalAfterTotal = globalAfter.reduce((sum, e) => sum + Number(e.amount), 0);

  // Get ALL SELF and GLOBAL (for comparison)
  const selfAll = await prisma.ledger_entries.aggregate({
    where: { receiver_user_id: user.id, commission_type: 'SELF' },
    _sum: { amount: true },
    _count: true
  });
  const globalAll = await prisma.ledger_entries.aggregate({
    where: { receiver_user_id: user.id, commission_type: 'GLOBAL_HELPING' },
    _sum: { amount: true },
    _count: true
  });

  // Get SELF and GLOBAL BEFORE withdrawal
  const selfBefore = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SELF',
      credited_at: { lte: withdrawalDate }
    },
    _sum: { amount: true },
    _count: true
  });
  const globalBefore = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: user.id,
      commission_type: 'GLOBAL_HELPING',
      credited_at: { lte: withdrawalDate }
    },
    _sum: { amount: true },
    _count: true
  });

  console.log('💰 SELF Commissions:');
  console.log(`   Total (All Time): ₹${Number(selfAll._sum.amount || 0).toFixed(2)} (${selfAll._count} entries)`);
  console.log(`   BEFORE Withdrawal: ₹${Number(selfBefore._sum.amount || 0).toFixed(2)} (${selfBefore._count} entries)`);
  console.log(`   AFTER Withdrawal: ₹${selfAfterTotal.toFixed(2)} (${selfAfter.length} entries)`);
  if (selfAfter.length > 0) {
    console.log(`   First After: ${selfAfter[0].credited_at.toISOString().split('T')[0]}`);
    console.log(`   Last After: ${selfAfter[selfAfter.length - 1].credited_at.toISOString().split('T')[0]}`);
  }

  console.log('\n🌍 GLOBAL_HELPING Commissions:');
  console.log(`   Total (All Time): ₹${Number(globalAll._sum.amount || 0).toFixed(2)} (${globalAll._count} entries)`);
  console.log(`   BEFORE Withdrawal: ₹${Number(globalBefore._sum.amount || 0).toFixed(2)} (${globalBefore._count} entries)`);
  console.log(`   AFTER Withdrawal: ₹${globalAfterTotal.toFixed(2)} (${globalAfter.length} entries)`);
  if (globalAfter.length > 0) {
    console.log(`   First After: ${globalAfter[0].credited_at.toISOString().split('T')[0]}`);
    console.log(`   Last After: ${globalAfter[globalAfter.length - 1].credited_at.toISOString().split('T')[0]}`);
  }

  console.log('\n📊 Summary:');
  const beforeTotal = Number(selfBefore._sum.amount || 0) + Number(globalBefore._sum.amount || 0);
  const afterTotal = selfAfterTotal + globalAfterTotal;
  console.log(`   SELF + GLOBAL (BEFORE Withdrawal): ₹${beforeTotal.toFixed(2)}`);
  console.log(`   SELF + GLOBAL (AFTER Withdrawal): ₹${afterTotal.toFixed(2)}`);
  console.log(`   Withdrawal Amount: ₹${Number(withdrawal.amount).toFixed(2)}`);
  console.log(`   Net (After - Withdrawal): ₹${(afterTotal - Number(withdrawal.amount)).toFixed(2)}`);

  // Check current balance
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, spot_balance: true, other_balance: true }
  });

  console.log('\n💳 Current Balance:');
  console.log(`   Total: ₹${Number(balance?.balance || 0).toFixed(2)}`);
  console.log(`   Spot: ₹${Number(balance?.spot_balance || 0).toFixed(2)}`);
  console.log(`   Other: ₹${Number(balance?.other_balance || 0).toFixed(2)}`);

  console.log('\n✅ Analysis:');
  console.log(`   User received ₹${afterTotal.toFixed(2)} in SELF+GLOBAL AFTER withdrawal`);
  console.log(`   This should be reflected in other_balance`);
  console.log(`   Current other_balance: ₹${Number(balance?.other_balance || 0).toFixed(2)}`);
  
  const expectedOtherBalance = afterTotal - Number(withdrawal.amount);
  console.log(`   Expected other_balance (after commissions - withdrawal): ₹${expectedOtherBalance.toFixed(2)}`);
  
  if (Math.abs(Number(balance?.other_balance || 0) - expectedOtherBalance) > 1) {
    console.log(`   ⚠️  MISMATCH! Balance should be ₹${expectedOtherBalance.toFixed(2)} but is ₹${Number(balance?.other_balance || 0).toFixed(2)}`);
  } else {
    console.log(`   ✅ Balance matches expected amount`);
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
