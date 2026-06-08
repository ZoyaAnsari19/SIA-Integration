/**
 * One-time fix: reverse and delete 21 Feb 2026 SPOT entries for SIA00122.
 *
 * Business context:
 * - User SIA00122 (Khushalrao Kewalram Sahare) received many Level 1 SPOT
 *   commissions on 2026-02-21 that correspond to old purchases (mostly 2025).
 * - Those commissions were already handled in the legacy system; the new
 *   system re-credited them on 21 Feb 2026, so we want to reverse them.
 *
 * What this script does (local DB):
 * 1. Finds all SPOT ledger_entries for SIA00122 where credited_at::date = '2026-02-21'.
 * 2. Sums the amount (expected 5750).
 * 3. Creates a single ADMIN_OPS negative ledger entry on spot wallet with that amount.
 * 4. Creates a matching wallet_transaction.
 * 5. Decrements user_balances.balance and spot_balance by that amount.
 * 6. Deletes the original 21 Feb 2026 SPOT ledger_entries and their wallet_transactions.
 *
 * Idempotent via idempotency_key; safe to re-run (no double adjustment).
 *
 * Run:
 *   npx tsx scripts/fix-sia00122-spot-duplicate.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00122';
  const idempotencyKey = 'SIA00122-SPOT-DUPLICATE-2026-02-21-REVERSAL-V2';

  console.log('=== Fix SIA00122 SPOT duplicates for 2026-02-21 (local DB) ===');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log(`User ${displayId} not found, aborting.`);
    return;
  }

  console.log('User:', user);

  // Idempotency: if adjustment already exists, exit safely
  const existingAdj = await prisma.ledger_entries.findFirst({
    where: { idempotency_key: idempotencyKey },
    select: { id: true, amount: true, credited_at: true },
  });

  if (existingAdj) {
    console.log('Adjustment already exists with this idempotency key:');
    console.log(existingAdj);
    return;
  }

  // Find all SPOT entries on 2026-02-21
  const bugEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
      credited_at: {
        gte: new Date('2026-02-21T00:00:00.000Z'),
        lt: new Date('2026-02-22T00:00:00.000Z'),
      },
    },
    select: {
      id: true,
      amount: true,
      credited_at: true,
      purchase_id: true,
      metadata: true,
    },
    orderBy: { id: 'asc' },
  });

  if (bugEntries.length === 0) {
    console.log('No SPOT entries found on 2026-02-21 for this user; nothing to do.');
    return;
  }

  console.log('\nBug-affected SPOT entries on 2026-02-21:');
  let adjustAmount = 0;
  for (const e of bugEntries) {
    const amt = Number(e.amount);
    adjustAmount += amt;
    console.log(
      `  id=${e.id.toString()} amount=${amt} credited_at=${e.credited_at.toISOString()} purchase_id=${e.purchase_id?.toString() ?? 'null'}`
    );
  }
  console.log('\nTotal adjustment amount (to be reversed from spot):', adjustAmount);

  // Check current balances
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
  });

  console.log('\nCurrent user_balances:');
  console.log(
    '  balance       =',
    balance?.balance?.toString() ?? 'N/A',
    '\n  spot_balance  =',
    balance?.spot_balance?.toString() ?? 'N/A',
    '\n  other_balance =',
    balance?.other_balance?.toString() ?? 'N/A',
    '\n  team_royalty  =',
    balance?.team_royalty_balance?.toString() ?? 'N/A'
  );

  const spotBalance = balance ? Number(balance.spot_balance ?? 0) : 0;
  console.log(
    `\nInfo: spot_balance=${spotBalance}, adjustment=${adjustAmount}. Proceeding to reverse full amount (spot_balance may go negative).`
  );

  console.log('\n✅ Applying adjustment + delete inside a transaction...');

  await prisma.$transaction(async (tx) => {
    // 1) Create ADMIN_OPS negative ledger entry on spot wallet
    const ledger = await tx.ledger_entries.create({
      data: {
        receiver_user_id: user.id,
        source_user_id: user.id,
        purchase_id: null,
        commission_type: 'ADMIN_OPS' as any,
        amount: -adjustAmount,
        metadata: {
          reason: 'SPOT_DUPLICATE_REVERSAL_2026-02-21',
          wallet_type: 'spot_balance',
          bug_entry_ids: bugEntries.map((e) => e.id.toString()),
          note:
            'Reversing SPOT commissions credited on 2026-02-21 that correspond to old purchases already handled in legacy system.',
        } as any,
        idempotency_key: idempotencyKey,
      },
    });

    console.log('\nCreated ADMIN_OPS ledger entry:', ledger.id.toString());

    // 2) Matching wallet_transaction
    await tx.wallet_transactions.create({
      data: {
        receiver_user_id: user.id,
        ledger_entry_id: ledger.id,
        amount: -adjustAmount,
        idempotency_key: idempotencyKey,
      },
    });

    // 3) Ensure user_balances exists
    const existingBalance = await tx.user_balances.findUnique({
      where: { user_id: user.id },
    });
    if (!existingBalance) {
      await tx.user_balances.create({
        data: {
          user_id: user.id,
          balance: 0,
          spot_balance: 0,
          other_balance: 0,
          team_royalty_balance: 0,
          spot_team_withdraw_used: 0,
          spot_team_limit_reached_at: null,
          spot_team_flush_active: false,
        },
      });
    }

    // 4) Decrement balance and spot_balance
    await tx.$executeRawUnsafe(
      `UPDATE user_balances
       SET balance = balance - $1,
           spot_balance = spot_balance - $1,
           updated_at = now()
       WHERE user_id = $2`,
      adjustAmount,
      user.id
    );

    // 5) Delete wallet_transactions for the bug entries
    const bugIds = bugEntries.map((e) => e.id);
    const wtResult = await tx.wallet_transactions.deleteMany({
      where: {
        ledger_entry_id: { in: bugIds },
      },
    });
    console.log('Deleted wallet_transactions for bug entries:', wtResult.count);

    // 6) Delete the SPOT ledger_entries themselves
    const leResult = await tx.ledger_entries.deleteMany({
      where: {
        id: { in: bugIds },
      },
    });
    console.log('Deleted SPOT ledger_entries for bug entries:', leResult.count);
  });

  const finalBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
  });

  console.log('\nFinal user_balances after adjustment:');
  console.log(
    '  balance       =',
    finalBalance?.balance?.toString() ?? 'N/A',
    '\n  spot_balance  =',
    finalBalance?.spot_balance?.toString() ?? 'N/A',
    '\n  other_balance =',
    finalBalance?.other_balance?.toString() ?? 'N/A',
    '\n  team_royalty  =',
    finalBalance?.team_royalty_balance?.toString() ?? 'N/A'
  );

  console.log('\n✅ Done. 21 Feb 2026 SPOT entries reversed and deleted for SIA00122.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

