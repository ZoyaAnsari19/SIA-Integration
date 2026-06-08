import { prisma } from '../src/config/prisma.js';

async function main() {
  const childDisplayId = 'SIA02008';
  const uplineDisplayId = 'SIA02000';

  const child = await prisma.users.findUnique({ where: { display_id: childDisplayId } });
  const upline = await prisma.users.findUnique({ where: { display_id: uplineDisplayId } });

  console.log('Child user:', {
    id: child?.id?.toString(),
    display_id: child?.display_id,
    referrer_user_id: child?.referrer_user_id?.toString(),
  });
  console.log('Upline user:', {
    id: upline?.id?.toString(),
    display_id: upline?.display_id,
  });

  if (!child || !upline) {
    console.log('Either child or upline user not found.');
    return;
  }

  const purchases = await prisma.purchases.findMany({
    where: { user_id: child.id, status: 'completed' },
    orderBy: { purchased_at: 'desc' },
  });

  console.log(`Found ${purchases.length} completed purchases for child.`);
  for (const p of purchases) {
    console.log('Purchase:', {
      id: p.id.toString(),
      amount: p.amount.toString(),
      purchased_at: p.purchased_at,
      previous_purchase_id: p.previous_purchase_id?.toString() || null,
      is_renewal: (p as any).is_renewal,
    });
  }

  const targetPurchase = purchases[0];
  if (!targetPurchase) {
    console.log('No completed purchase found for child.');
    return;
  }

  console.log('\nChecking ledger_entries for this purchase and upline as receiver...');
  const ledger = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: upline.id,
      purchase_id: targetPurchase.id,
    },
  });

  if (ledger.length === 0) {
    console.log('No ledger_entries found for this purchase/upline combination.');
  }

  for (const le of ledger) {
    console.log('Ledger entry:', {
      id: le.id.toString(),
      receiver_user_id: le.receiver_user_id.toString(),
      source_user_id: le.source_user_id.toString(),
      purchase_id: le.purchase_id?.toString() || null,
      commission_type: le.commission_type,
      amount: le.amount.toString(),
      credited_at: le.credited_at,
      metadata: le.metadata,
    });
  }

  console.log('\nChecking pending_commissions for this purchase and upline as receiver...');
  const pending = await prisma.pending_commissions.findMany({
    where: {
      receiver_user_id: upline.id,
      purchase_id: targetPurchase.id,
    },
  });

  if (pending.length === 0) {
    console.log('No pending_commissions found for this purchase/upline combination.');
  }

  for (const pc of pending) {
    console.log('Pending commission:', {
      id: pc.id.toString(),
      receiver_user_id: pc.receiver_user_id.toString(),
      source_user_id: pc.source_user_id.toString(),
      purchase_id: pc.purchase_id?.toString() || null,
      level: pc.level,
      commission_type: pc.commission_type,
      amount: pc.amount.toString(),
      metadata: pc.metadata,
    });
  }
}

main()
  .catch((e) => {
    console.error('Error in check-spot-commission script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

