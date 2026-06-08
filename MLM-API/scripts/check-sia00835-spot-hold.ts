/**
 * Check SIA00835: direct join + spot commission hold_until in local DB
 * Run: npx tsx scripts/check-sia00835-spot-hold.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00835';

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true, referrer_user_id: true },
  });
  if (!user) {
    console.log(`User ${displayId} not found.`);
    return;
  }
  console.log('User:', user);

  const spotEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
    },
    select: {
      id: true,
      source_user_id: true,
      purchase_id: true,
      amount: true,
      credited_at: true,
      metadata: true,
    },
    orderBy: { credited_at: 'desc' },
  });
  console.log('\nSPOT ledger entries for', displayId, ':', spotEntries.length);
  for (const e of spotEntries) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const holdUntil = meta?.hold_until;
    const level = meta?.level;
    const depth = meta?.depth;
    const sourceUser = await prisma.users.findUnique({
      where: { id: e.source_user_id },
      select: { display_id: true },
    });
    const purchase = e.purchase_id
      ? await prisma.purchases.findUnique({
          where: { id: e.purchase_id },
          select: { purchased_at: true, amount: true },
        })
      : null;
    console.log('  ---');
    console.log('  ledger id:', e.id.toString());
    console.log('  source_user:', sourceUser?.display_id, 'amount:', e.amount, 'credited_at:', e.credited_at);
    console.log('  purchase_id:', e.purchase_id?.toString(), 'purchase_date:', purchase?.purchased_at);
    console.log('  metadata.hold_until:', holdUntil ?? '(not set)');
    console.log('  metadata.level:', level, 'depth:', depth);
    if (holdUntil) {
      const holdDate = new Date(holdUntil as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      holdDate.setHours(0, 0, 0, 0);
      const released = holdDate <= today;
      console.log('  => Hold status:', released ? 'RELEASED (can withdraw)' : 'LOCKED (under 10-day hold)');
    } else {
      console.log('  => Hold status: No hold_until (treated as released)');
    }
  }

  if (spotEntries.length === 0) {
    console.log('\nNo SPOT entries found. So no hold to check.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

