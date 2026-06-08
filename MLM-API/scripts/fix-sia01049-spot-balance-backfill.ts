/**
 * Backfill user_balances for SIA01049 when the 11 manual SPOT ledger rows exist but
 * spot_balance was NOT increased (spot_team_flush_active / 15-day flush skipped balance in wallet.ts).
 *
 * **Only run if** `spot_balance` / main `balance` did NOT go up by the ledger total after the credit script.
 * If balance already includes these ₹7000, running this **doubles** — do not run.
 *
 * Requires: CONFIRM=1
 *
 * Local:
 *   CONFIRM=1 DATABASE_URL=... npx tsx scripts/fix-sia01049-spot-balance-backfill.ts
 *
 * Production (port-forward prod Postgres only; set RUN_ON_PRODUCTION_SPOT=1):
 *   CONFIRM=1 DATABASE_URL=... RUN_ON_PRODUCTION_SPOT=1 npx tsx scripts/fix-sia01049-spot-balance-backfill.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const RECEIVER_DISPLAY_ID = 'SIA01049';
const KEY_PREFIX = 'manual:spot-sia01049:21feb0712';

async function main() {
  if (process.env.CONFIRM !== '1') {
    console.error('Set CONFIRM=1 to apply balance backfill (see script header).');
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL || '';
  if (process.env.RUN_ON_STAGE === '1' && process.env.RUN_ON_PRODUCTION_SPOT === '1') {
    console.error('Set only one of RUN_ON_STAGE or RUN_ON_PRODUCTION_SPOT.');
    process.exit(1);
  }
  if (process.env.RUN_ON_STAGE === '1' && !/localhost|127\.0\.0\.1/.test(dbUrl)) {
    console.error('RUN_ON_STAGE=1 requires DATABASE_URL localhost (stage port-forward).');
    process.exit(1);
  }
  if (process.env.RUN_ON_PRODUCTION_SPOT === '1' && !/localhost|127\.0\.0\.1/.test(dbUrl)) {
    console.error('RUN_ON_PRODUCTION_SPOT=1 requires DATABASE_URL localhost (prod port-forward).');
    process.exit(1);
  }

  const receiver = await prisma.users.findUnique({
    where: { display_id: RECEIVER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });
  if (!receiver) {
    console.error('User not found');
    process.exit(1);
  }
  const receiverId = receiver.id as unknown as bigint;

  const rows = await prisma.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(le.amount), 0)::text AS sum
    FROM ledger_entries le
    WHERE le.receiver_user_id = ${receiverId}
      AND le.commission_type = 'SPOT'
      AND le.idempotency_key LIKE ${KEY_PREFIX + '%'}
  `;
  const total = Number(rows[0]?.sum ?? 0);
  if (total <= 0) {
    console.log('No ledger rows found for', KEY_PREFIX, '- nothing to backfill.');
    return;
  }

  const bal = await prisma.user_balances.findUnique({
    where: { user_id: receiverId },
    select: { balance: true, spot_balance: true },
  });
  console.log('Receiver:', RECEIVER_DISPLAY_ID, 'id=', receiverId.toString());
  console.log('Sum of manual SPOT ledger rows:', total);
  console.log('Before — balance:', bal?.balance, 'spot_balance:', bal?.spot_balance);

  await prisma.$executeRawUnsafe(
    'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
    total,
    receiverId
  );

  const after = await prisma.user_balances.findUnique({
    where: { user_id: receiverId },
    select: { balance: true, spot_balance: true },
  });
  console.log('After — balance:', after?.balance, 'spot_balance:', after?.spot_balance);
  console.log('Done. Added ₹' + total.toFixed(2) + ' to balance + spot_balance.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
