/**
 * One-time migration: set SPOT hold_until to join_date + 10 days (was 14).
 * Local: npx tsx scripts/migrate-spot-hold-14-to-10-days.ts
 * Prod:  Use run-spot-hold-migration-prod.sh (backup first, then RUN_ON_PROD=1).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isLikelyLocalDb(url: string): boolean {
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, 'http://'));
    const host = u.hostname || '';
    const port = u.port || '5432';
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
    console.error('❌ DATABASE_URL looks like production (not localhost). Set RUN_ON_PROD=1 to run migration on prod.');
    process.exit(1);
  }
  if (runOnProd) {
    console.log('⚠️  RUN_ON_PROD=1 — ensure full backup was taken before proceeding.');
    console.log('   Migration will update SPOT hold_until to join_date + 10 days.');
    console.log('');
  }
  // Before: count locked (hold_until > today)
  const before = await prisma.$queryRaw<
    Array<{ entry_count: bigint; user_count: bigint; total_locked: string }>
  >`
    SELECT
      COUNT(*)::bigint AS entry_count,
      COUNT(DISTINCT receiver_user_id)::bigint AS user_count,
      COALESCE(SUM(amount), 0)::text AS total_locked
    FROM ledger_entries
    WHERE commission_type = 'SPOT'
      AND metadata->>'hold_until' IS NOT NULL
      AND (metadata->>'hold_until')::date > CURRENT_DATE
  `;
  console.log('Before migration (currently locked with old hold_until):');
  console.log('  Entries:', before[0]?.entry_count?.toString() ?? 0);
  console.log('  Users:', before[0]?.user_count?.toString() ?? 0);
  console.log('  Total locked: ₹', before[0]?.total_locked ?? '0');
  console.log('');

  // Update: set hold_until = join_date + 10 days for all SPOT entries that have hold_until
  // join_date = purchase.purchased_at if purchase_id else credited_at
  const updated = await prisma.$executeRaw`
    UPDATE ledger_entries le
    SET metadata = jsonb_set(
      COALESCE(le.metadata::jsonb, '{}'::jsonb),
      '{hold_until}',
      to_jsonb(
        (
          COALESCE(
            (SELECT p.purchased_at FROM purchases p WHERE p.id = le.purchase_id),
            le.credited_at
          )::date + interval '10 days'
        )::date::text
      )
    )
    WHERE le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
  `;
  console.log('Updated', updated, 'SPOT ledger row(s) with new hold_until (join_date + 10 days).');
  console.log('');

  // After: count still locked (hold_until > today)
  const after = await prisma.$queryRaw<
    Array<{ entry_count: bigint; user_count: bigint; total_locked: string }>
  >`
    SELECT
      COUNT(*)::bigint AS entry_count,
      COUNT(DISTINCT receiver_user_id)::bigint AS user_count,
      COALESCE(SUM(amount), 0)::text AS total_locked
    FROM ledger_entries
    WHERE commission_type = 'SPOT'
      AND metadata->>'hold_until' IS NOT NULL
      AND (metadata->>'hold_until')::date > CURRENT_DATE
  `;
  console.log('After migration (still locked under 10-day rule):');
  console.log('  Entries:', after[0]?.entry_count?.toString() ?? 0);
  console.log('  Users:', after[0]?.user_count?.toString() ?? 0);
  console.log('  Total locked: ₹', after[0]?.total_locked ?? '0');
  console.log('');
  console.log('Done. SPOT hold_until is now 10-day rule for all.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
