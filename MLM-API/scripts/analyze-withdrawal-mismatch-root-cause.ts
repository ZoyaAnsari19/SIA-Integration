import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('Root Cause Analysis: Other Balance Mismatch After Withdrawal');
  console.log('============================================================\n');

  // Analyze SIA00635 as example
  const user = await prisma.users.findUnique({
    where: { display_id: 'SIA00635' },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('User not found');
    await prisma.$disconnect();
    return;
  }

  // Get withdrawal
  const withdrawal = await prisma.withdraw_requests.findFirst({
    where: { user_id: user.id, status: 'approved' },
    orderBy: { updated_at: 'desc' },
  });

  if (!withdrawal) {
    console.log('No withdrawal found');
    await prisma.$disconnect();
    return;
  }

  const withdrawalDate = withdrawal.updated_at || withdrawal.created_at;

  // Get withdrawal ledger entry
  const withdrawalLedger = await prisma.ledger_entries.findFirst({
    where: {
      receiver_user_id: user.id,
      idempotency_key: `withdraw:approve:${withdrawal.id}`,
    },
    select: { metadata: true, amount: true, credited_at: true },
  });

  const meta = withdrawalLedger?.metadata as any;
  const otherDeducted = Number(meta?.other_deducted || 0);
  const spotDeducted = Number(meta?.spot_deducted || 0);

  // Get current balance
  const currentBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { other_balance: true, spot_balance: true, balance: true },
  });

  // Get SELF+GLOBAL commissions AFTER withdrawal
  const activePurchases = await prisma.purchases.findMany({
    where: {
      user_id: user.id,
      status: 'completed',
    },
    select: { id: true, amount: true, income: true },
  });

  const activeIds = activePurchases
    .filter((p) => Number(p.income || 0) < Number(p.amount) * 2)
    .map((p) => p.id);

  const selfAfter = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SELF',
      credited_at: { gt: withdrawalDate },
      purchase_id: { in: activeIds },
    },
    select: { id: true, amount: true, credited_at: true },
  });

  const globalAfter = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'GLOBAL_HELPING',
      credited_at: { gt: withdrawalDate },
      purchase_id: { in: activeIds },
    },
    select: { id: true, amount: true, credited_at: true },
  });

  const commissionsAfter = selfAfter.reduce((s, e) => s + Number(e.amount), 0) +
    globalAfter.reduce((s, e) => s + Number(e.amount), 0);

  // Check wallet transactions for commissions after withdrawal
  const allLedgerIds = [...selfAfter.map((e) => e.id), ...globalAfter.map((e) => e.id)];
  const walletTxns = await prisma.wallet_transactions.findMany({
    where: { ledger_entry_id: { in: allLedgerIds as bigint[] } },
    select: { amount: true, ledger_entry_id: true },
  });

  const walletTxnTotal = walletTxns.reduce((s, e) => s + Number(e.amount), 0);
  const missingWalletTxns = allLedgerIds.length - walletTxns.length;

  // Check if wallet transactions exist for commissions
  const missingLedgerIds: bigint[] = [];
  for (const ledgerId of allLedgerIds) {
    const hasWalletTxn = walletTxns.some((wt) => wt.ledger_entry_id.toString() === ledgerId.toString());
    if (!hasWalletTxn) {
      missingLedgerIds.push(ledgerId);
    }
  }

  console.log('📊 Withdrawal Details:');
  console.log(`   Amount: ₹${Number(withdrawal.amount).toFixed(2)}`);
  console.log(`   Date: ${withdrawalDate.toISOString().split('T')[0]}`);
  console.log(`   Spot Deducted: ₹${spotDeducted.toFixed(2)}`);
  console.log(`   Other Deducted: ₹${otherDeducted.toFixed(2)}`);
  console.log('');

  console.log('💰 Commissions After Withdrawal:');
  console.log(`   SELF Entries: ${selfAfter.length}`);
  console.log(`   GLOBAL Entries: ${globalAfter.length}`);
  console.log(`   Total Commissions: ₹${commissionsAfter.toFixed(2)}`);
  console.log('');

  console.log('💳 Wallet Transactions Check:');
  console.log(`   Total Ledger Entries: ${allLedgerIds.length}`);
  console.log(`   Wallet Transactions Found: ${walletTxns.length}`);
  console.log(`   Missing Wallet Transactions: ${missingWalletTxns}`);
  console.log(`   Wallet Txn Total: ₹${walletTxnTotal.toFixed(2)}`);
  if (missingLedgerIds.length > 0) {
    console.log(`   ⚠️  Missing wallet_transactions for ${missingLedgerIds.length} ledger entries`);
  }
  console.log('');

  console.log('📈 Current Balance:');
  console.log(`   Other Balance: ₹${Number(currentBalance?.other_balance || 0).toFixed(2)}`);
  console.log(`   Spot Balance: ₹${Number(currentBalance?.spot_balance || 0).toFixed(2)}`);
  console.log(`   Total Balance: ₹${Number(currentBalance?.balance || 0).toFixed(2)}`);
  console.log('');

  console.log('🔍 Root Cause Analysis:');
  console.log('');

  // Expected other_balance calculation
  // After withdrawal, other_balance should be:
  // (other_balance before withdrawal - other_deducted) + (commissions after withdrawal)
  // But we don't have "before withdrawal" state, so we calculate:
  // Expected = commissions after withdrawal (because that's what should be there now)
  
  const expectedOtherBalance = commissionsAfter;
  const actualOtherBalance = Number(currentBalance?.other_balance || 0);
  const difference = expectedOtherBalance - actualOtherBalance;

  console.log(`   Expected Other Balance: ₹${expectedOtherBalance.toFixed(2)}`);
  console.log(`   Actual Other Balance: ₹${actualOtherBalance.toFixed(2)}`);
  console.log(`   Difference: ₹${difference.toFixed(2)}`);
  console.log('');

  if (missingWalletTxns > 0) {
    console.log('❌ ROOT CAUSE #1: Missing Wallet Transactions');
    console.log(`   ${missingWalletTxns} ledger entries don't have wallet_transactions`);
    console.log(`   This means balance was never updated when commissions were credited`);
    console.log(`   Ledger entries exist but wallet_transactions are missing`);
    console.log('');
  }

  if (Math.abs(walletTxnTotal - commissionsAfter) > 1) {
    console.log('❌ ROOT CAUSE #2: Wallet Transaction Amount Mismatch');
    console.log(`   Ledger Total: ₹${commissionsAfter.toFixed(2)}`);
    console.log(`   Wallet Txn Total: ₹${walletTxnTotal.toFixed(2)}`);
    console.log(`   Difference: ₹${Math.abs(walletTxnTotal - commissionsAfter).toFixed(2)}`);
    console.log('');
  }

  // Check if withdrawal was deducted but commissions weren't credited properly
  if (otherDeducted > 0 && actualOtherBalance < expectedOtherBalance) {
    console.log('❌ ROOT CAUSE #3: Withdrawal Deduction vs Commission Credit Mismatch');
    console.log(`   Withdrawal deducted ₹${otherDeducted.toFixed(2)} from other_balance`);
    console.log(`   Commissions after should add ₹${commissionsAfter.toFixed(2)}`);
    console.log(`   But other_balance is ₹${actualOtherBalance.toFixed(2)} instead of ₹${expectedOtherBalance.toFixed(2)}`);
    console.log(`   This suggests commissions were not properly credited to other_balance`);
    console.log('');
  }

  console.log('📋 Summary of Issues:');
  const issues: string[] = [];
  
  if (missingWalletTxns > 0) {
    issues.push(`Missing ${missingWalletTxns} wallet_transactions for commissions after withdrawal`);
  }
  
  if (Math.abs(walletTxnTotal - commissionsAfter) > 1) {
    issues.push(`Wallet transaction amounts don't match ledger entries`);
  }
  
  if (Math.abs(difference) > 1) {
    issues.push(`Other balance mismatch: Expected ₹${expectedOtherBalance.toFixed(2)}, Got ₹${actualOtherBalance.toFixed(2)}`);
  }

  if (issues.length === 0) {
    console.log('   ✅ No issues found (after fix)');
  } else {
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  console.log('');
  console.log('💡 Main Root Cause:');
  console.log('   When commissions are credited AFTER withdrawal:');
  console.log('   1. Ledger entries are created ✅');
  console.log('   2. But wallet_transactions might be missing ❌');
  console.log('   3. This causes other_balance to not update properly ❌');
  console.log('   4. Result: other_balance doesn\'t reflect commissions after withdrawal ❌');
  console.log('');

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
