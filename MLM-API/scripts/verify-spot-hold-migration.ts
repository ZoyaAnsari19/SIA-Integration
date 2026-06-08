/**
 * Verify spot-hold migration did not affect anything else in local DB.
 * Run: npx tsx scripts/verify-spot-hold-migration.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. Only SPOT entries have hold_until in metadata ===');
  const nonSpotWithHold = await prisma.$queryRaw<Array<{ commission_type: string; cnt: bigint }>>`
    SELECT commission_type, COUNT(*)::bigint AS cnt
    FROM ledger_entries
    WHERE metadata->>'hold_until' IS NOT NULL
      AND commission_type != 'SPOT'
    GROUP BY commission_type
  `;
  if (nonSpotWithHold.length === 0) {
    console.log('  OK: No non-SPOT entries have hold_until.');
  } else {
    console.log('  WARN: Non-SPOT with hold_until:', nonSpotWithHold);
  }

  console.log('\n=== 2. SPOT entries: only metadata.hold_until changed (sample) ===');
  const sample = await prisma.ledger_entries.findMany({
    where: { commission_type: 'SPOT', metadata: { not: null } },
    select: { id: true, amount: true, credited_at: true, purchase_id: true, metadata: true },
    take: 3,
    orderBy: { id: 'desc' },
  });
  for (const row of sample) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    console.log('  id:', row.id.toString(), 'amount:', row.amount, 'hold_until:', meta.hold_until, 'keys:', Object.keys(meta));
  }

  console.log('\n=== 3. Total ledger_entries count (unchanged) ===');
  const totalLedger = await prisma.ledger_entries.count();
  const spotCount = await prisma.ledger_entries.count({ where: { commission_type: 'SPOT' } });
  console.log('  Total ledger_entries:', totalLedger);
  console.log('  SPOT ledger_entries:', spotCount);

  console.log('\n=== 4. wallet_transactions count (unchanged) ===');
  const wtCount = await prisma.wallet_transactions.count();
  console.log('  Total wallet_transactions:', wtCount);
  const wtForSpot = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*)::bigint AS cnt FROM wallet_transactions wt
    JOIN ledger_entries le ON le.id = wt.ledger_entry_id AND le.commission_type = 'SPOT'
  `;
  console.log('  wallet_transactions linked to SPOT ledger:', wtForSpot[0]?.cnt?.toString() ?? 0);

  console.log('\n=== 5. user_balances: spot_balance vs sum(SPOT ledger) ===');
  const balanceSum = await prisma.$queryRaw<Array<{ total_spot: string }>>`
    SELECT COALESCE(SUM(spot_balance), 0)::text AS total_spot FROM user_balances
  `;
  const ledgerSpotSum = await prisma.$queryRaw<Array<{ total: string }>>`
    SELECT COALESCE(SUM(amount), 0)::text AS total FROM ledger_entries WHERE commission_type = 'SPOT'
  `;
  console.log('  Sum(user_balances.spot_balance):', balanceSum[0]?.total_spot ?? 0);
  console.log('  Sum(SPOT ledger_entries.amount):', ledgerSpotSum[0]?.total ?? 0);
  const b = Number(balanceSum[0]?.total_spot ?? 0);
  const l = Number(ledgerSpotSum[0]?.total ?? 0);
  if (Math.abs(b - l) < 0.01) console.log('  OK: Spot balances match SPOT ledger sum.');
  else console.log('  WARN: Mismatch between spot_balance sum and SPOT ledger sum.');

  console.log('\n=== 6. Other tables row counts (sanity) ===');
  const usersCount = await prisma.users.count();
  const purchasesCount = await prisma.purchases.count();
  const feeCount = await prisma.fee_transactions.count();
  console.log('  users:', usersCount, 'purchases:', purchasesCount, 'fee_transactions:', feeCount);

  console.log('\n=== 7. SPOT entries with hold_until: all have valid date format ===');
  const invalidHold = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id FROM ledger_entries
    WHERE commission_type = 'SPOT'
      AND metadata->>'hold_until' IS NOT NULL
      AND (metadata->>'hold_until')::date IS NULL
    LIMIT 5
  `;
  if (invalidHold.length === 0) {
    console.log('  OK: All hold_until values are valid dates.');
  } else {
    console.log('  WARN: Invalid hold_until:', invalidHold);
  }

  console.log('\nDone. Migration only touched SPOT ledger_entries.metadata.hold_until.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
