/**
 * Check SPOT ledger entries for user SIA00122 (Khushalrao Kewalram Sahare).
 *
 * Focus:
 * - List all SPOT entries, grouped by credited_at date.
 * - For 21 Feb 2026 entries, show purchase dates and amounts.
 *
 * Run:
 *   npx tsx scripts/check-sia00122-spot.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00122';

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log(`User ${displayId} not found.`);
    return;
  }
  console.log('User:', user);

  const entries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
    },
    select: {
      id: true,
      amount: true,
      credited_at: true,
      purchase_id: true,
      metadata: true,
    },
    orderBy: { credited_at: 'desc' },
  });

  console.log('\nAll SPOT ledger entries for user (latest first):', entries.length);

  const byDate = new Map<string, typeof entries>();

  for (const e of entries) {
    const d = e.credited_at.toISOString().slice(0, 10);
    const list = byDate.get(d) ?? [];
    list.push(e);
    byDate.set(d, list);
  }

  for (const [date, list] of Array.from(byDate.entries()).sort((a, b) =>
    a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0
  )) {
    const total = list.reduce((s, e) => s + Number(e.amount), 0);
    console.log(`\nDate ${date}: count=${list.length}, total_amount=${total}`);
    for (const e of list) {
      const meta = (e.metadata || {}) as Record<string, unknown>;
      console.log(
        `  id=${e.id.toString()} amount=${Number(e.amount)} credited_at=${e.credited_at.toISOString()} purchase_id=${e.purchase_id?.toString() ?? 'null'} hold_until=${meta.hold_until ?? '(none)'}`
      );
    }
  }

  // Special focus: 2026-02-21 entries with purchase dates
  console.log('\n=== Focus: 2026-02-21 SPOT entries with purchase dates ===');
  const entriesFeb21 = entries.filter(
    (e) => e.credited_at.toISOString().slice(0, 10) === '2026-02-21'
  );

  if (entriesFeb21.length === 0) {
    console.log('No SPOT entries on 2026-02-21.');
  } else {
    const purchaseIds = Array.from(
      new Set(entriesFeb21.filter((e) => e.purchase_id).map((e) => e.purchase_id!))
    );
    const purchases =
      purchaseIds.length > 0
        ? await prisma.purchases.findMany({
            where: { id: { in: purchaseIds } },
            select: { id: true, purchased_at: true, amount: true },
          })
        : [];
    const purchaseMap = new Map(
      purchases.map((p) => [p.id.toString(), { purchased_at: p.purchased_at, amount: p.amount }])
    );

    let total = 0;
    for (const e of entriesFeb21) {
      total += Number(e.amount);
      const purchase =
        e.purchase_id != null ? purchaseMap.get(e.purchase_id.toString()) ?? null : null;
      console.log(
        `  id=${e.id.toString()} amount=${Number(e.amount)} credited_at=${e.credited_at.toISOString()} purchase_date=${purchase?.purchased_at?.toISOString() ?? 'null'} purchase_amount=${purchase?.amount?.toString() ?? 'null'}`
      );
    }
    console.log('Total SPOT amount on 2026-02-21:', total);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

