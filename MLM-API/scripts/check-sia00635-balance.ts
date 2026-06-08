import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00635';
  
  console.log('============================================================');
  console.log(`🔍 BALANCE CHECK: ${displayId}`);
  console.log('============================================================\n');

  // 1. Get user
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  console.log(`👤 User: ${user.name} (${user.display_id})`);
  console.log(`   User ID: ${user.id}\n`);

  // 2. Current wallet balance
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true, spot_balance: true, updated_at: true },
  });

  const totalBalance = Number(balance?.balance || 0);
  const spotBalance = Number(balance?.spot_balance || 0);
  const otherBalance = Number(balance?.other_balance || 0);
  const calculatedBalance = spotBalance + otherBalance;
  const balanceDiff = totalBalance - calculatedBalance;

  console.log('💰 Current Wallet Balance:');
  console.log(`   Total (balance field): ₹${totalBalance.toFixed(2)}`);
  console.log(`   Spot Balance: ₹${spotBalance.toFixed(2)}`);
  console.log(`   Other Balance: ₹${otherBalance.toFixed(2)}`);
  console.log(`   Calculated (spot + other): ₹${calculatedBalance.toFixed(2)}`);
  if (Math.abs(balanceDiff) > 0.01) {
    console.log(`   ⚠️  DIFFERENCE: ₹${balanceDiff.toFixed(2)} (balance field out of sync!)`);
  } else {
    console.log(`   ✅ Balance field is in sync`);
  }
  console.log(`   Last Updated: ${balance?.updated_at?.toISOString() || 'N/A'}\n`);

  // 3. Check ledger entries vs wallet transactions
  console.log('📊 Ledger Entries Analysis:');
  console.log('-'.repeat(60));
  
  const allLedgerEntries = await prisma.ledger_entries.findMany({
    where: { receiver_user_id: user.id },
    select: { id: true, amount: true, commission_type: true, idempotency_key: true },
  });

  const totalLedgerAmount = allLedgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);
  console.log(`   Total Ledger Entries: ${allLedgerEntries.length}`);
  console.log(`   Total Ledger Amount: ₹${totalLedgerAmount.toFixed(2)}\n`);

  // 4. Check missing wallet transactions
  const ledgerIds = allLedgerEntries.map(e => e.id);
  const walletTxns = await prisma.wallet_transactions.findMany({
    where: { ledger_entry_id: { in: ledgerIds as bigint[] } },
    select: { ledger_entry_id: true, amount: true },
  });

  const walletTxnMap = new Map(walletTxns.map(wt => [wt.ledger_entry_id.toString(), Number(wt.amount)]));
  const missingWalletTxns: typeof allLedgerEntries = [];
  let missingAmount = 0;

  for (const ledger of allLedgerEntries) {
    if (!walletTxnMap.has(ledger.id.toString())) {
      missingWalletTxns.push(ledger);
      missingAmount += Number(ledger.amount);
    }
  }

  console.log('💳 Wallet Transactions Check:');
  console.log(`   Total Wallet Transactions: ${walletTxns.length}`);
  console.log(`   Missing Wallet Transactions: ${missingWalletTxns.length}`);
  if (missingWalletTxns.length > 0) {
    console.log(`   ⚠️  MISSING AMOUNT: ₹${missingAmount.toFixed(2)}`);
    console.log(`   Missing entries by type:`);
    const byType = missingWalletTxns.reduce((acc, e) => {
      acc[e.commission_type] = (acc[e.commission_type] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    Object.entries(byType).forEach(([type, amount]) => {
      console.log(`      ${type}: ₹${amount.toFixed(2)}`);
    });
  } else {
    console.log(`   ✅ All ledger entries have wallet transactions`);
  }
  console.log('');

  // 5. Check by commission type
  console.log('📈 Commission Type Breakdown:');
  console.log('-'.repeat(60));
  
  const byType = allLedgerEntries.reduce((acc, e) => {
    const type = e.commission_type || 'UNKNOWN';
    if (!acc[type]) {
      acc[type] = { count: 0, total: 0, missing: 0 };
    }
    acc[type].count++;
    acc[type].total += Number(e.amount);
    if (!walletTxnMap.has(e.id.toString())) {
      acc[type].missing += Number(e.amount);
    }
    return acc;
  }, {} as Record<string, { count: number; total: number; missing: number }>);

  for (const [type, stats] of Object.entries(byType)) {
    console.log(`   ${type}:`);
    console.log(`      Entries: ${stats.count}`);
    console.log(`      Total: ₹${stats.total.toFixed(2)}`);
    if (stats.missing > 0) {
      console.log(`      ⚠️  Missing Wallet Txns: ₹${stats.missing.toFixed(2)}`);
    }
  }
  console.log('');

  // 6. Check withdrawals
  const withdrawals = await prisma.withdraw_requests.findMany({
    where: { user_id: user.id },
    select: { amount: true, status: true, created_at: true },
  });

  const totalWithdrawn = withdrawals
    .filter(w => w.status === 'approved' || w.status === 'completed')
    .reduce((sum, w) => sum + Number(w.amount), 0);

  console.log('💸 Withdrawals:');
  console.log(`   Total Withdrawals: ${withdrawals.length}`);
  console.log(`   Approved/Completed: ₹${totalWithdrawn.toFixed(2)}`);
  console.log('');

  // 7. Check fee transactions
  const fees = await prisma.fee_transactions.findMany({
    where: { user_id: user.id },
    select: { amount: true, rule_code: true, created_at: true },
  });

  const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);

  console.log('💳 Fee Transactions:');
  console.log(`   Total Fees: ${fees.length}`);
  console.log(`   Total Fee Amount: ₹${totalFees.toFixed(2)}`);
  if (fees.length > 0) {
    console.log(`   Recent fees:`);
    fees.slice(-5).forEach(f => {
      console.log(`      ₹${Number(f.amount).toFixed(2)} - ${f.rule_code || 'N/A'} - ${f.created_at.toISOString().split('T')[0]}`);
    });
  }
  console.log('');

  // 8. Calculate expected balance
  const expectedBalance = totalLedgerAmount - totalWithdrawn - totalFees;
  const actualBalance = calculatedBalance; // Use calculated balance (spot + other)
  const discrepancy = expectedBalance - actualBalance;

  console.log('🧮 Balance Calculation:');
  console.log('-'.repeat(60));
  console.log(`   Total Ledger Credits: ₹${totalLedgerAmount.toFixed(2)}`);
  console.log(`   Total Withdrawals: ₹${totalWithdrawn.toFixed(2)}`);
  console.log(`   Total Fees: ₹${totalFees.toFixed(2)}`);
  console.log(`   Expected Balance: ₹${expectedBalance.toFixed(2)}`);
  console.log(`   Actual Balance (spot + other): ₹${actualBalance.toFixed(2)}`);
  if (Math.abs(discrepancy) > 0.01) {
    console.log(`   ⚠️  DISCREPANCY: ₹${discrepancy.toFixed(2)}`);
    if (discrepancy > 0) {
      console.log(`   ⚠️  Balance is LESS than expected by ₹${discrepancy.toFixed(2)}`);
    } else {
      console.log(`   ⚠️  Balance is MORE than expected by ₹${Math.abs(discrepancy).toFixed(2)}`);
    }
  } else {
    console.log(`   ✅ Balance matches expected amount`);
  }
  console.log('');

  // 9. Summary
  console.log('============================================================');
  console.log('📋 SUMMARY:');
  console.log('============================================================\n');
  
  const issues: string[] = [];
  
  if (Math.abs(balanceDiff) > 0.01) {
    issues.push(`Balance field out of sync (diff: ₹${balanceDiff.toFixed(2)})`);
  }
  
  if (missingWalletTxns.length > 0) {
    issues.push(`Missing ${missingWalletTxns.length} wallet transactions (₹${missingAmount.toFixed(2)})`);
  }
  
  if (Math.abs(discrepancy) > 0.01) {
    issues.push(`Balance discrepancy: ₹${discrepancy.toFixed(2)}`);
  }

  if (issues.length === 0) {
    console.log('✅ No issues found! Balance looks correct.');
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('\n💡 Recommended fixes:');
    if (missingWalletTxns.length > 0) {
      console.log('   1. Create missing wallet_transactions');
      console.log('   2. Update balance: balance = spot_balance + other_balance');
    }
    if (Math.abs(discrepancy) > 0.01 && discrepancy > 0) {
      console.log('   3. Reconcile missing credits or check for missing ledger entries');
    }
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
