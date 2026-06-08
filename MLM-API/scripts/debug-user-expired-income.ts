import { prisma } from '../src/config/prisma.js';

const displayId = process.argv[2] || 'SIA00608';

async function main() {
  console.log('============================================================');
  console.log(`🔍 Debug Expired-Income + Reversal for ${displayId}`);
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

  // Wallet balances
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true, spot_balance: true },
  });

  console.log('💰 Current Wallet Balances:');
  console.log(`   Total: ₹${Number(balance?.balance || 0).toFixed(2)}`);
  console.log(`   Other: ₹${Number(balance?.other_balance || 0).toFixed(2)}`);
  console.log(`   Spot : ₹${Number(balance?.spot_balance || 0).toFixed(2)}\n`);

  // Find all completed purchases
  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id, status: 'completed' },
    select: { id: true, amount: true, income: true, purchased_at: true } as any,
    orderBy: { purchased_at: 'asc' },
  });

  console.log('📦 Purchases:');
  for (const p of purchases) {
    const amt = Number(p.amount);
    const inc = Number((p as any).income || 0);
    console.log(`   Purchase ${p.id}: amount=₹${amt.toFixed(2)}, income=₹${inc.toFixed(2)}, 2x=₹${(amt*2).toFixed(2)}`);
  }
  console.log('');

  // For each purchase, compute income after expiry and reversal
  for (const p of purchases) {
    const purchaseId = p.id as unknown as bigint;
    const amt = Number(p.amount);
    const doubleAmt = amt * 2;

    // 1) All SELF+GLOBAL+MONTHLY after expiry (like bug script)
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
      expiryDate = p.purchased_at as any;
    }

    const incomeAfterExpiry = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        credited_at: { gte: expiryDate },
        commission_type: { in: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
        receiver_user_id: user.id,
      },
      select: { amount: true, commission_type: true },
    });

    const rawInvalid = incomeAfterExpiry.reduce((s, e) => s + Number(e.amount), 0);

    // 2) All reversal entries for this purchase
    const reversals = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: user.id,
        purchase_id: purchaseId,
        idempotency_key: { startsWith: 'reversal:expired:' },
      },
      select: { amount: true },
    });

    const reversed = reversals.reduce((s, e) => s + Number(e.amount), 0); // negative total
    const netAfterReversal = rawInvalid + reversed; // should be ~0

    if (Math.abs(rawInvalid) > 0.01 || Math.abs(reversed) > 0.01) {
      console.log(`📊 Purchase ${p.id}:`);
      console.log(`   Amount: ₹${amt.toFixed(2)}, 2x: ₹${(doubleAmt).toFixed(2)}`);
      console.log(`   Raw invalid income after expiry: ₹${rawInvalid.toFixed(2)}`);
      console.log(`   Total reversal (ADMIN_OPS): ₹${reversed.toFixed(2)}`);
      console.log(`   Net after reversal (should be 0): ₹${netAfterReversal.toFixed(2)}\n`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(() => prisma.$disconnect());
