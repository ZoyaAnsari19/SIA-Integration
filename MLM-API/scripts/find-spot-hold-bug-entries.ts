/**
 * Find users affected by the SPOT hold bug (purchase-date based hold_until)
 * in the local DB.
 *
 * Definition of bugged entry:
 * - commission_type = 'SPOT'
 * - metadata.hold_until IS NOT NULL
 * - credited_at::date is within the last 10 days (including today)
 *   → under correct rule (credit_date + 10 days) these should still be on hold
 * - BUT (metadata.hold_until)::date <= CURRENT_DATE
 *   → system currently treats them as withdrawable
 *
 * Run:
 *   npx tsx scripts/find-spot-hold-bug-entries.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type BugRow = {
  ledger_id: bigint;
  receiver_user_id: bigint;
  receiver_display_id: string;
  receiver_name: string | null;
  source_user_id: bigint;
  source_display_id: string | null;
  source_name: string | null;
  amount: string;
  credited_at: Date;
  hold_until: string;
  level: number | null;
  depth: number | null;
};

async function main() {
  console.log('=== Find SPOT hold bug entries (local DB) ===');

  const rows = await prisma.$queryRaw<BugRow[]>`
    SELECT
      le.id AS ledger_id,
      le.receiver_user_id,
      ru.display_id AS receiver_display_id,
      ru.name AS receiver_name,
      le.source_user_id,
      su.display_id AS source_display_id,
      su.name AS source_name,
      le.amount::text AS amount,
      le.credited_at,
      (le.metadata->>'hold_until')::text AS hold_until,
      NULLIF(le.metadata->>'level', '')::int AS level,
      NULLIF(le.metadata->>'depth', '')::int AS depth
    FROM ledger_entries le
    JOIN users ru ON ru.id = le.receiver_user_id
    LEFT JOIN users su ON su.id = le.source_user_id
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
      AND le.credited_at::date > (CURRENT_DATE - interval '10 days')
    ORDER BY le.receiver_user_id, le.credited_at DESC, le.id DESC
  `;

  if (rows.length === 0) {
    console.log('No bug-affected SPOT entries found with current date window.');
    return;
  }

  console.log(`Found ${rows.length} bug-affected SPOT ledger entries.\n`);

  const byUser = new Map<string, { userId: bigint; displayId: string; name: string | null; total: number; count: number; entries: BugRow[] }>();

  for (const row of rows) {
    const key = row.receiver_user_id.toString();
    const existing = byUser.get(key);
    const amt = Number(row.amount);
    if (!existing) {
      byUser.set(key, {
        userId: row.receiver_user_id,
        displayId: row.receiver_display_id,
        name: row.receiver_name,
        total: amt,
        count: 1,
        entries: [row],
      });
    } else {
      existing.total += amt;
      existing.count += 1;
      existing.entries.push(row);
    }
  }

  for (const [, info] of byUser) {
    console.log('---');
    console.log(
      `User ${info.displayId} (${info.userId.toString()}) - ${info.name ?? 'N/A'}`
    );
    console.log(`  Bug entries: ${info.count}, Total amount: ${info.total}`);
    for (const e of info.entries) {
      console.log(
        `  • ledger_id=${e.ledger_id.toString()}, amount=${e.amount}, credited_at=${e.credited_at.toISOString()}, hold_until=${e.hold_until}, level=${e.level}, depth=${e.depth}, source=${e.source_display_id ?? e.source_user_id.toString()}`
      );
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Distinct affected users: ${byUser.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

