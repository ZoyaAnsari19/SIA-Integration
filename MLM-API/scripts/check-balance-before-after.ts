import { prisma } from '../src/config/prisma.js';

async function main() {
  const displayId = 'SIA00608';
  
  console.log('============================================================');
  console.log(`💰 Balance Before/After Reversal Check: ${displayId}`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) return;

  // Current balance
  const currentBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true, spot_balance: true },
  });

  console.log('💰 Current Wallet Balance:');
  console.log(`   Total: ₹${Number(currentBalance?.balance || 0).toFixed(2)}`);
  console.log(`   Other: ₹${Number(currentBalance?.other_balance || 0).toFixed(2)}`);
  console.log(`   Spot : ₹${Number(currentBalance?.spot_balance || 0).toFixed(2)}\n`);

  // Find expired purchase 471
  const purchase = await prisma.purchases.findUnique({
    where: { id: 471 },
    select: { id: true, amount: true, income: true } as any,
  });

  if (!purchase) {
    console.log('❌ Purchase 471 not found');
    return;
  }

  // Find reversal entries for purchase 471
  const reversals = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      purchase_id: 471,
      idempotency_key: { startsWith: 'reversal:expired:' },
    },
    select: { amount: true, credited_at: true },
  });

  const totalReversed = reversals.reduce((s, e) => s + Number(e.amount), 0);

  console.log(`🔄 Reversal for Purchase 471:`);
  console.log(`   Entries: ${reversals.length}`);
  console.log(`   Total Reversed: ₹${totalReversed.toFixed(2)}`);
  console.log(`   Reversal Date: ${reversals[0]?.credited_at.toISOString().split('T')[0] || 'N/A'}\n`);

  // Calculate what balance WOULD BE if reversals didn't exist
  // Sum all ledger entries EXCEPT reversals
  const allEntries = await prisma.ledger_entries.findMany({
    where: { receiver_user_id: user.id },
    select: { amount: true, idempotency_key: true },
  });

  const entriesWithoutReversals = allEntries.filter(e => !e.idempotency_key?.startsWith('reversal:expired:'));
  const balanceWithoutReversals = entriesWithoutReversals.reduce((s, e) => s + Number(e.amount), 0);

  console.log('📊 Balance Calculation:');
  console.log(`   Balance WITHOUT reversals: ₹${balanceWithoutReversals.toFixed(2)}`);
  console.log(`   Current balance (WITH reversals): ₹${Number(currentBalance?.balance || 0).toFixed(2)}`);
  console.log(`   Difference (reversal impact): ₹${(Number(currentBalance?.balance || 0) - balanceWithoutReversals).toFixed(2)}`);
  console.log(`   Expected reversal impact: ₹${totalReversed.toFixed(2)}\n`);

  // Check if wallet transactions were created
  const walletTxns = await prisma.wallet_transactions.findMany({
    where: {
      receiver_user_id: user.id,
      ledger_entry_id: { in: reversals.map(r => r.id as unknown as bigint) },
    },
    select: { amount: true },
  });

  console.log('💳 Wallet Transactions:');
  console.log(`   Count: ${walletTxns.length}`);
  console.log(`   Total: ₹${walletTxns.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}\n`);

  console.log('============================================================');
  console.log('✅ VERIFICATION:');
  console.log('============================================================\n');
  
  if (reversals.length > 0) {
    console.log('✅ Reversal entries EXIST in ledger_entries');
  } else {
    console.log('❌ NO reversal entries found!');
  }

  if (walletTxns.length === reversals.length) {
    console.log('✅ Wallet transactions match reversal entries');
  } else {
    console.log(`❌ Wallet transactions mismatch: ${walletTxns.length} vs ${reversals.length}`);
  }

  const impactMatch = Math.abs((Number(currentBalance?.balance || 0) - balanceWithoutReversals) - totalReversed) < 1;
  if (impactMatch) {
    console.log('✅ Wallet balance reflects reversal deduction');
  } else {
    console.log('⚠️  Wallet balance impact may not match reversal amount');
    console.log(`   (This could be due to other transactions like withdrawals/transfers)`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
