/**
 * Check SIA00122 spot wallet + lock amount + SPOT history
 * for the currently loaded DB (20 Feb 2026 backup as per user).
 *
 * - Reads user_balances for SIA00122
 * - Uses getLockedSpotBalance() to compute locked SPOT as of "today"
 * - Lists SPOT ledger entries up to 2026-02-20 (inclusive)
 *
 * Run:
 *   npx tsx scripts/check-sia00122-balances-20feb.ts
 */

import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { getLockedSpotBalance } from '../src/utils/wallet';

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

  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
  });

  console.log('\nuser_balances row:');
  console.log(balance);

  const lockedSpot = await getLockedSpotBalance(user.id);
  console.log('\nLocked SPOT amount (from ledger_entries with hold_until > today):', lockedSpot);

  const spotEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
      credited_at: {
        lte: new Date('2026-02-20T23:59:59.999Z'),
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

  console.log('\nSPOT entries up to 2026-02-20: count=', spotEntries.length);
  let totalSpot = 0;
  for (const e of spotEntries) {
    totalSpot += Number(e.amount);
    const meta = (e.metadata || {}) as Record<string, unknown>;
    console.log(
      `  id=${e.id.toString()} amount=${Number(e.amount)} credited_at=${e.credited_at.toISOString()} purchase_id=${e.purchase_id?.toString() ?? 'null'} hold_until=${meta.hold_until ?? '(none)'}`
    );
  }
  console.log('Total SPOT amount (<= 20 Feb 2026):', totalSpot);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

