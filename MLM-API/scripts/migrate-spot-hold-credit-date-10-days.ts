/**
 * Migration: Fix SPOT hold_until for existing entries to use CREDIT DATE + 10 days.
 *
 * Background:
 * - Buggy logic (since commit c76268b) set hold_until = join/purchase_date + SPOT_HOLD_DAYS.
 * - Correct logic (now in wallet.ts) is hold_until = credit_date + SPOT_HOLD_DAYS.
 *
 * This script updates existing SPOT ledger_entries where:
 *   - commission_type = 'SPOT'
 *   - metadata.hold_until IS NOT NULL
 *   - Old rule says: (metadata.hold_until)::date <= CURRENT_DATE  → currently treated as withdrawable
 *   - New rule says: (credited_at::date + interval '10 days')::date > CURRENT_DATE
 *       → they SHOULD still be on hold today
 *
 * For such rows we set:
 *   metadata.hold_until = (credited_at::date + interval '10 days')::date::text
 *
 * This does NOT change commission amounts or balances, only the hold_until metadata
 * used by income-history + getLockedSpotBalance.
 *
 * Usage (LOCAL DB):
 *   npx tsx scripts/migrate-spot-hold-credit-date-10-days.ts
 *
 * Usage (PROD - after backup):
 *   RUN_ON_PROD=1 npx tsx scripts/migrate-spot-hold-credit-date-10-days.ts
 *
 * Dry-run (no writes, only report what would be updated):
 *   RUN_ON_PROD=1 DRY_RUN=1 npx tsx scripts/migrate-spot-hold-credit-date-10-days.ts
 *
 * Safety:
 * - Refuses to run on non-local DATABASE_URL unless RUN_ON_PROD=1 is set.
 * - Only updates ledger_entries.metadata.hold_until (no amounts, no user_balances, no wallet_transactions).
 * - WHERE: SPOT only, hold_until present, hold_until<=today AND credited_at+10>today (bug pattern only).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isLikelyLocalDb(url: string): boolean {
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, 'http://'));
    const host = u.hostname || '';
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const runOnProd = process.env.RUN_ON_PROD === '1' || process.env.RUN_ON_PROD === 'true';
  const isLocal = isLikelyLocalDb(dbUrl);

  if (!isLocal && !runOnProd) {
    console.error(
      '❌ DATABASE_URL looks like production (not localhost). Set RUN_ON_PROD=1 to run this migration on prod.'
    );
    process.exit(1);
  }
  if (runOnProd) {
    console.log('⚠️  RUN_ON_PROD=1 — ensure full backup was taken before proceeding.');
    console.log('   This migration will update SPOT metadata.hold_until to CREDIT_DATE + 10 days');
    console.log('   for entries that are currently withdrawable but should still be on hold.\n');
  }

  console.log('=== 1. Before migration: bug-affected SPOT entries (summary) ===');
  const before = await prisma.$queryRaw<
    Array<{ entry_count: bigint; user_count: bigint; total_amount: string }>
  >`
    SELECT
      COUNT(*)::bigint AS entry_count,
      COUNT(DISTINCT receiver_user_id)::bigint AS user_count,
      COALESCE(SUM(amount), 0)::text AS total_amount
    FROM ledger_entries le
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
      AND (le.credited_at::date + interval '10 days')::date > CURRENT_DATE
  `;

  const beforeRow = before[0];
  console.log('  Entries:', beforeRow?.entry_count?.toString() ?? '0');
  console.log('  Users  :', beforeRow?.user_count?.toString() ?? '0');
  console.log('  Total amount (₹):', beforeRow?.total_amount ?? '0');
  console.log('');

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  if (dryRun) {
    console.log('🔒 DRY_RUN=1 — no updates will be written.\n');
  }

  if (!beforeRow || beforeRow.entry_count === 0n) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  console.log('=== 2. Sample of bug-affected entries (top 5) ===');
  const sample = await prisma.$queryRaw<
    Array<{
      ledger_id: bigint;
      receiver_display_id: string;
      amount: string;
      credited_at: Date;
      old_hold_until: string;
      new_hold_until: string;
    }>
  >`
    SELECT
      le.id AS ledger_id,
      u.display_id AS receiver_display_id,
      le.amount::text AS amount,
      le.credited_at,
      (le.metadata->>'hold_until')::text AS old_hold_until,
      ((le.credited_at::date + interval '10 days')::date)::text AS new_hold_until
    FROM ledger_entries le
    JOIN users u ON u.id = le.receiver_user_id
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
      AND (le.credited_at::date + interval '10 days')::date > CURRENT_DATE
    ORDER BY le.receiver_user_id, le.credited_at DESC, le.id DESC
    LIMIT 5
  `;

  for (const row of sample) {
    console.log(
      `  id=${row.ledger_id.toString()} user=${row.receiver_display_id} amount=${row.amount} credited_at=${row.credited_at.toISOString()} old_hold_until=${row.old_hold_until} new_hold_until=${row.new_hold_until}`
    );
  }
  console.log('');

  console.log('=== 3. Applying migration (update hold_until to credit_date + 10 days) ===');
  let updated = 0;
  if (!dryRun) {
    updated = await prisma.$executeRaw`
      UPDATE ledger_entries le
      SET metadata = jsonb_set(
        COALESCE(le.metadata::jsonb, '{}'::jsonb),
        '{hold_until}',
        to_jsonb(
          (
            (le.credited_at::date + interval '10 days')::date::text
          )
        )
      )
      WHERE le.commission_type = 'SPOT'
        AND le.metadata->>'hold_until' IS NOT NULL
        AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
        AND (le.credited_at::date + interval '10 days')::date > CURRENT_DATE
    `;
    console.log('  Updated rows:', updated);
  } else {
    console.log('  [DRY RUN] Would update', beforeRow.entry_count.toString(), 'rows. Run without DRY_RUN=1 to apply.');
  }
  console.log('');

  console.log('=== 4. After migration: remaining bug-affected entries (sanity check) ===');
  const after = await prisma.$queryRaw<
    Array<{ entry_count: bigint; user_count: bigint; total_amount: string }>
  >`
    SELECT
      COUNT(*)::bigint AS entry_count,
      COUNT(DISTINCT receiver_user_id)::bigint AS user_count,
      COALESCE(SUM(amount), 0)::text AS total_amount
    FROM ledger_entries le
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date <= CURRENT_DATE
      AND (le.credited_at::date + interval '10 days')::date > CURRENT_DATE
  `;

  const afterRow = after[0];
  console.log('  Entries:', afterRow?.entry_count?.toString() ?? '0');
  console.log('  Users  :', afterRow?.user_count?.toString() ?? '0');
  console.log('  Total amount (₹):', afterRow?.total_amount ?? '0');
  console.log('');

  console.log('Done. Existing SPOT hold_until now follows CREDIT DATE + 10 days for currently-affected entries.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

