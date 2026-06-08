/**
 * One-time cleanup: delete the 4 bug-affected Level 1 SPOT entries for SIA00835 in local DB.
 *
 * NOTE:
 * - Balance correction has already been applied by fix-sia00835-spot-bug.ts
 *   via an ADMIN_OPS negative adjustment on spot wallet.
 * - This script ONLY deletes the original SPOT credit entries + their wallet_transactions
 *   so they no longer appear in Spot Income history.
 *
 * Run (local only):
 *   npx tsx scripts/delete-sia00835-spot-bug-entries.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00835';

  console.log('=== Delete SIA00835 bug SPOT entries (local DB) ===');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log(`User ${displayId} not found, aborting.`);
    return;
  }

  console.log('User:', user);

  const bugEntryIds = [403608n, 403609n, 403610n, 403611n];

  const entries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
      id: { in: bugEntryIds },
    },
    select: {
      id: true,
      amount: true,
      credited_at: true,
    },
    orderBy: { id: 'asc' },
  });

  if (entries.length === 0) {
    console.log('No matching SPOT entries found for deletion. Maybe already deleted.');
    return;
  }

  console.log('\nEntries to delete:');
  for (const e of entries) {
    console.log(
      `  id=${e.id.toString()} amount=${Number(e.amount)} credited_at=${e.credited_at.toISOString()}`
    );
  }

  await prisma.$transaction(async (tx) => {
    // First delete wallet_transactions that reference these ledger entries
    const wtResult = await tx.wallet_transactions.deleteMany({
      where: {
        ledger_entry_id: { in: bugEntryIds },
      },
    });

    console.log('\nDeleted wallet_transactions rows:', wtResult.count);

    // Then delete the ledger_entries themselves
    const leResult = await tx.ledger_entries.deleteMany({
      where: {
        id: { in: bugEntryIds },
      },
    });

    console.log('Deleted ledger_entries rows:', leResult.count);
  });

  console.log('\n✅ Done. Bug SPOT entries removed from ledger + wallet_transactions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

