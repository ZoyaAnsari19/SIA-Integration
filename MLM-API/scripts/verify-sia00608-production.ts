import { prisma } from '../src/config/prisma.js';

async function main() {
  const displayId = 'SIA00608';
  
  console.log('============================================================');
  console.log(`🔍 Production DB Verification: ${displayId}`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`User: ${user.display_id} - ${user.name} (ID: ${user.id})\n`);

  // 1. Wallet balances
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true, spot_balance: true },
  });

  console.log('💰 Current Wallet Balances:');
  console.log(`   Total: ₹${Number(balance?.balance || 0).toFixed(2)}`);
  console.log(`   Other: ₹${Number(balance?.other_balance || 0).toFixed(2)}`);
  console.log(`   Spot : ₹${Number(balance?.spot_balance || 0).toFixed(2)}\n`);

  // 2. Find expired purchase (2500 package)
  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id, status: 'completed' },
    select: { id: true, amount: true, income: true, purchased_at: true } as any,
    orderBy: { purchased_at: 'asc' },
  });

  const expired2500 = purchases.find(p => Number(p.amount) === 2500);
  if (!expired2500) {
    console.log('❌ 2500 package not found');
    return;
  }

  const purchaseId = expired2500.id as unknown as bigint;
  const amt = Number(expired2500.amount);
  const doubleAmt = amt * 2;
  const currentIncome = Number((expired2500 as any).income || 0);

  console.log(`📦 Expired 2500 Package (Purchase ${purchaseId}):`);
  console.log(`   Amount: ₹${amt.toFixed(2)}`);
  console.log(`   Current Income: ₹${currentIncome.toFixed(2)}`);
  console.log(`   2x Target: ₹${doubleAmt.toFixed(2)}`);
  console.log(`   Status: ${currentIncome >= doubleAmt ? 'EXPIRED ✅' : 'ACTIVE'}\n`);

  // 3. Find expiry date
  const selfGlobal = await prisma.ledger_entries.findMany({
    where: {
      purchase_id: purchaseId,
      receiver_user_id: user.id,
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
    },
    orderBy: { credited_at: 'asc' },
    select: { amount: true, credited_at: true },
  });

  let cum = 0;
  let expiryDate: Date | null = null;
  for (const e of selfGlobal) {
    cum += Number(e.amount);
    if (cum >= doubleAmt && !expiryDate) {
      expiryDate = e.credited_at;
      break;
    }
  }
  if (!expiryDate) {
    expiryDate = expired2500.purchased_at as any;
  }

  console.log(`📅 Expiry Date: ${expiryDate.toISOString().split('T')[0]}\n`);

  // 4. Find ALL entries after expiry (invalid income)
  const invalidEntries = await prisma.ledger_entries.findMany({
    where: {
      purchase_id: purchaseId,
      receiver_user_id: user.id,
      credited_at: { gte: expiryDate },
      commission_type: { in: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
    },
    orderBy: { credited_at: 'asc' },
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      idempotency_key: true,
    },
  });

  const totalInvalid = invalidEntries.reduce((s, e) => s + Number(e.amount), 0);

  console.log(`❌ Invalid Income Entries (after expiry):`);
  console.log(`   Count: ${invalidEntries.length}`);
  console.log(`   Total Amount: ₹${totalInvalid.toFixed(2)}\n`);

  // 5. Find reversal entries
  const reversals = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      purchase_id: purchaseId,
      idempotency_key: { startsWith: 'reversal:expired:' },
    },
    orderBy: { credited_at: 'asc' },
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      idempotency_key: true,
      metadata: true,
    },
  });

  const totalReversed = reversals.reduce((s, e) => s + Number(e.amount), 0);

  console.log(`🔄 Reversal Entries (ADMIN_OPS):`);
  console.log(`   Count: ${reversals.length}`);
  console.log(`   Total Amount: ₹${totalReversed.toFixed(2)} (should be -${totalInvalid.toFixed(2)})\n`);

  if (reversals.length > 0) {
    console.log(`   Sample Reversal Entries (first 5):`);
    for (const r of reversals.slice(0, 5)) {
      console.log(`     - ID ${r.id}: ${r.commission_type} ₹${Number(r.amount).toFixed(2)} at ${r.credited_at.toISOString().split('T')[0]}`);
      console.log(`       Key: ${r.idempotency_key}`);
    }
    console.log('');
  }

  // 6. Check wallet transactions for reversals
  const walletTxns = await prisma.wallet_transactions.findMany({
    where: {
      receiver_user_id: user.id,
      ledger_entry_id: { in: reversals.map(r => r.id as unknown as bigint) },
    },
    select: {
      id: true,
      amount: true,
      ledger_entry_id: true,
    },
  });

  console.log(`💳 Wallet Transactions for Reversals:`);
  console.log(`   Count: ${walletTxns.length}`);
  console.log(`   Total: ₹${walletTxns.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}\n`);

  // 7. Net calculation
  const net = totalInvalid + totalReversed; // totalReversed is negative
  console.log(`📊 Net Calculation:`);
  console.log(`   Invalid Income: ₹${totalInvalid.toFixed(2)}`);
  console.log(`   Reversed: ₹${totalReversed.toFixed(2)}`);
  console.log(`   Net (should be 0): ₹${net.toFixed(2)}\n`);

  // 8. Summary
  console.log('============================================================');
  console.log('✅ SUMMARY:');
  console.log('============================================================\n');
  
  if (Math.abs(net) < 0.01) {
    console.log('✅ Reversal is CORRECT - Net is 0');
  } else {
    console.log('❌ Reversal is INCOMPLETE - Net is not 0');
    console.log(`   Missing reversal: ₹${Math.abs(net).toFixed(2)}`);
  }

  if (reversals.length === 0) {
    console.log('❌ NO REVERSAL ENTRIES FOUND - Reversal script may not have run!');
  } else {
    console.log(`✅ Reversal entries exist: ${reversals.length} entries`);
  }

  if (walletTxns.length !== reversals.length) {
    console.log(`⚠️  Wallet transactions mismatch: ${walletTxns.length} vs ${reversals.length} reversal entries`);
  } else {
    console.log(`✅ Wallet transactions match reversal entries`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(() => prisma.$disconnect());
