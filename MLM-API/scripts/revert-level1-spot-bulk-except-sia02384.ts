/**
 * Revert the bulk Level 1 SPOT credit (credit-level1-spot-bulk-except-sia02384.ts).
 * - Deletes ledger_entries where idempotency_key LIKE 'manual:spot-bulk:%'
 * - Deletes corresponding wallet_transactions
 * - Reduces user_balances.spot_balance and user_balances.balance by the summed amount per user
 *
 * Local: DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission npx tsx scripts/revert-level1-spot-bulk-except-sia02384.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const IDEMPOTENCY_PREFIX = 'manual:spot-bulk:';

async function main() {
  const entries = await prisma.ledger_entries.findMany({
    where: { idempotency_key: { startsWith: IDEMPOTENCY_PREFIX } },
    select: { id: true, receiver_user_id: true, amount: true },
  });

  if (entries.length === 0) {
    console.log('No manual:spot-bulk entries found. Nothing to revert.');
    return;
  }

  const amountByUser = new Map<string, number>();
  for (const e of entries) {
    const uid = e.receiver_user_id.toString();
    const amt = Number(e.amount);
    amountByUser.set(uid, (amountByUser.get(uid) ?? 0) + amt);
  }

  const entryIds = entries.map((e) => e.id);

  await prisma.$transaction(async (tx) => {
    for (const [userId, amount] of amountByUser) {
      const uid = BigInt(userId);
      await tx.$executeRaw`
        UPDATE user_balances
        SET spot_balance = spot_balance - ${amount},
            balance = balance - ${amount},
            updated_at = now()
        WHERE user_id = ${uid}
      `;
    }
    await tx.wallet_transactions.deleteMany({
      where: { idempotency_key: { startsWith: IDEMPOTENCY_PREFIX } },
    });
    const deleted = await tx.ledger_entries.deleteMany({
      where: { idempotency_key: { startsWith: IDEMPOTENCY_PREFIX } },
    });
    console.log('Reverted:', deleted.count, 'ledger entries,', amountByUser.size, 'users balance adjusted');
  });

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
