/**
 * Remove 2 SPOT entries from SIA00404 (385) and reduce balance by ₹187.50.
 * Entries: SIA02069 ₹62.50 (22 Feb 12:28), SIA00477 ₹125 (14 Feb 05:35).
 * Run AFTER credit-sia00404-spot-history-from-list.ts on production.
 *
 * Prod: use prod DATABASE_URL (e.g. port-forward or pod env) then:
 *   npx tsx scripts/prod-remove-two-spot-sia00404.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const RECEIVER_ID = BigInt(385);
const IDEMPOTENCY_KEYS = [
  'manual:spot-sia00404:0:2009:62.5:2026-02-22T06:58:00.000Z',
  'manual:spot-sia00404:39:458:125:2026-02-14T12:05:00.000Z',
];
const TOTAL_REVERT = 62.5 + 125; // 187.50

async function main() {
  const entries = await prisma.ledger_entries.findMany({
    where: { idempotency_key: { in: IDEMPOTENCY_KEYS } },
    select: { id: true, amount: true, idempotency_key: true },
  });

  if (entries.length === 0) {
    console.log('No matching entries found. Nothing to remove.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE user_balances
      SET spot_balance = spot_balance - ${TOTAL_REVERT},
          balance = balance - ${TOTAL_REVERT},
          updated_at = now()
      WHERE user_id = ${RECEIVER_ID}
    `;
    await tx.wallet_transactions.deleteMany({
      where: { idempotency_key: { in: IDEMPOTENCY_KEYS } },
    });
    const d = await tx.ledger_entries.deleteMany({
      where: { idempotency_key: { in: IDEMPOTENCY_KEYS } },
    });
    console.log('Removed', d.count, 'ledger entries. Balance reduced by ₹' + TOTAL_REVERT);
  });
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
