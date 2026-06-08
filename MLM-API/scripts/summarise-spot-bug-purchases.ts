/**
 * Summarise purchase dates for SPOT entries affected by the old purchase-date hold bug.
 *
 * Same bug definition as find-spot-hold-bug-entries.ts:
 * - commission_type = 'SPOT'
 * - metadata.hold_until IS NOT NULL
 * - credited_at::date is within the last 10 days (CURRENT_DATE - 10)
 * - (metadata.hold_until)::date <= CURRENT_DATE
 *
 * This script groups by receiver user and shows:
 * - display_id, name
 * - bug entry count
 * - total SPOT amount
 * - earliest & latest purchase date among those entries (if purchase_id present)
 *
 * Run:
 *   npx tsx scripts/summarise-spot-bug-purchases.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SummaryRow = {
  receiver_user_id: bigint;
  receiver_display_id: string;
  receiver_name: string | null;
  bug_entries: bigint;
  total_amount: string;
  earliest_purchase: Date | null;
  latest_purchase: Date | null;
};

async function main() {
  console.log('=== SPOT hold bug: purchase date summary (local DB) ===');

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      le.receiver_user_id,
      ru.display_id AS receiver_display_id,
      ru.name AS receiver_name,
      COUNT(*)::bigint AS bug_entries,
      COALESCE(SUM(le.amount), 0)::text AS total_amount,
      MIN(p.purchased_at) AS earliest_purchase,
      MAX(p.purchased_at) AS latest_purchase
    FROM ledger_entries le
    JOIN users ru ON ru.id = le.receiver_user_id
    LEFT JOIN purchases p ON p.id = le.purchase_id
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
      AND le.credited_at::date > (CURRENT_DATE - interval '10 days')
    GROUP BY le.receiver_user_id, ru.display_id, ru.name
    ORDER BY ru.display_id::text
  `;

  if (rows.length === 0) {
    console.log('No bug-affected SPOT entries found for current window.');
    return;
  }

  for (const row of rows) {
    console.log('---');
    console.log(
      `User ${row.receiver_display_id} (${row.receiver_user_id.toString()}) - ${row.receiver_name ?? 'N/A'}`
    );
    console.log(`  Bug entries   : ${row.bug_entries.toString()}`);
    console.log(`  Total amount  : ${row.total_amount}`);
    console.log(
      `  Purchase dates: earliest=${row.earliest_purchase?.toISOString() ?? 'NULL'}, latest=${row.latest_purchase?.toISOString() ?? 'NULL'}`
    );
  }

  console.log('\nTotal affected users:', rows.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

