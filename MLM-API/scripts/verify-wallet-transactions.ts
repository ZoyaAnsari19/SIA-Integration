import { prisma } from '../src/config/prisma.js';

async function main() {
  const displayId = 'SIA00608';
  
  console.log('============================================================');
  console.log(`💳 Wallet Transactions Verification: ${displayId}`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) return;

  // Get reversal entries for purchase 471
  const reversals = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      purchase_id: 471,
      idempotency_key: { startsWith: 'reversal:expired:' },
    },
    select: { id: true, amount: true },
    take: 5,
  });

  console.log(`🔄 Sample Reversal Entries (first 5):`);
  for (const r of reversals) {
    console.log(`   Ledger ID: ${r.id}, Amount: ₹${Number(r.amount).toFixed(2)}`);
    
    // Check wallet transaction for this ledger entry
    const walletTxn = await prisma.wallet_transactions.findFirst({
      where: { ledger_entry_id: r.id as unknown as bigint },
      select: { id: true, amount: true },
    });

    if (walletTxn) {
      console.log(`      ✅ Wallet Transaction: ID ${walletTxn.id}, Amount: ₹${Number(walletTxn.amount).toFixed(2)}`);
    } else {
      console.log(`      ❌ NO Wallet Transaction found!`);
    }
  }

  // Count all wallet transactions for reversals
  const allReversals = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      purchase_id: 471,
      idempotency_key: { startsWith: 'reversal:expired:' },
    },
    select: { id: true },
  });

  const reversalIds = allReversals.map(r => r.id).filter(id => id !== null && id !== undefined) as bigint[];
  
  if (reversalIds.length > 0) {
    const walletTxns = await prisma.wallet_transactions.findMany({
      where: {
        ledger_entry_id: { in: reversalIds },
      },
      select: { id: true, amount: true },
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Reversal Ledger Entries: ${allReversals.length}`);
    console.log(`   Wallet Transactions Found: ${walletTxns.length}`);
    console.log(`   Total in Wallet Transactions: ₹${walletTxns.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}\n`);

    if (walletTxns.length === allReversals.length) {
      console.log('✅ All reversals have wallet transactions');
    } else {
      console.log(`⚠️  Mismatch: ${allReversals.length - walletTxns.length} reversals missing wallet transactions`);
    }
  }

  // Check current wallet balance
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true, spot_balance: true },
  });

  console.log(`💰 Current Wallet Balance:`);
  console.log(`   Total: ₹${Number(balance?.balance || 0).toFixed(2)}`);
  console.log(`   Other: ₹${Number(balance?.other_balance || 0).toFixed(2)}`);
  console.log(`   Spot : ₹${Number(balance?.spot_balance || 0).toFixed(2)}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
