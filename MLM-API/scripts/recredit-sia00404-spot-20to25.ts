/**
 * Re-credit SPOT commissions for SIA00404 between 20 Feb 2026 and 25 Feb 2026.
 *
 * - Uses CommissionService.handlePurchase for purchases where SIA00404 is in the upline tree.
 * - Intended to be run on main local DB (mlm-prod-dump, port 5435) AFTER
 *   resetting balances/entries to 20 Feb 2026 snapshot.
 *
 * Run:
 *   npx tsx scripts/recredit-sia00404-spot-20to25.ts
 */

import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { CommissionService } from '../src/modules/commissions/commission.service';

async function main() {
  const displayId = 'SIA00404';

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log(`User ${displayId} not found.`);
    return;
  }

  console.log('User:', user);

  const descendantIds = (
    await prisma.user_tree_paths.findMany({
      where: { ancestor_id: user.id },
      select: { descendant_id: true },
    })
  ).map((u) => u.descendant_id as unknown as bigint);

  const purchases = await prisma.purchases.findMany({
    where: {
      purchased_at: {
        gte: new Date('2026-02-20T00:00:00.000Z'),
        lt: new Date('2026-02-26T00:00:00.000Z'),
      },
      user_id: { in: descendantIds },
    },
    select: {
      id: true,
      user_id: true,
      amount: true,
      purchased_at: true,
    },
    orderBy: { purchased_at: 'asc' },
  });

  console.log('\nPurchases between 20–25 Feb 2026 with SIA00404 in upline:', purchases.length);
  for (const p of purchases) {
    console.log(
      `  purchase_id=${p.id.toString()} buyer_id=${p.user_id.toString()} amount=${Number(
        p.amount
      )} purchased_at=${p.purchased_at.toISOString()}`
    );
  }

  for (const p of purchases) {
    console.log(`\n=== Re-processing purchase ${p.id.toString()} ===`);
    const result = await CommissionService.handlePurchase(p.id as unknown as bigint);
    console.log('Result:', result);
  }

  const finalSpot = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
      credited_at: {
        gte: new Date('2026-02-20T00:00:00.000Z'),
        lt: new Date('2026-02-26T00:00:00.000Z'),
      },
    },
    select: {
      id: true,
      amount: true,
      credited_at: true,
      purchase_id: true,
      metadata: true,
    },
    orderBy: { credited_at: 'asc' },
  });

  console.log('\nSPOT entries for user AFTER re-credit (20–25 Feb window):', finalSpot.length);
  let total = 0;
  for (const e of finalSpot) {
    total += Number(e.amount);
    const meta = (e.metadata || {}) as Record<string, unknown>;
    console.log(
      `  id=${e.id.toString()} amount=${Number(e.amount)} credited_at=${e.credited_at.toISOString()} purchase_id=${e.purchase_id?.toString() ?? 'null'} level=${meta.level ?? '(none)'} depth=${meta.depth ?? '(none)'}`
    );
  }
  console.log('Total SPOT amount credited (20–25 Feb):', total);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

