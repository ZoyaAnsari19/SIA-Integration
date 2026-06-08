/**
 * One-time fix: reverse early-withdrawable Level 1 SPOT for SIA00835 in local DB.
 *
 * - Target user: display_id = 'SIA00835'
 * - Affected SPOT ledger ids (Level 1 on 21 Feb 2026):
 *   - 403608 (₹2500)
 *   - 403611 (₹187.50)
 *   - 403610 (₹1250)
 *   - 403609 (₹62.50)
 *
 * We do NOT delete or edit those SPOT entries.
 * Instead we create a single ADMIN_OPS negative entry on spot wallet
 * with clear metadata, and adjust user_balances + wallet_transactions.
 *
 * Run (local only):
 *   npx tsx scripts/fix-sia00835-spot-bug.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00835';
  const idempotencyKey = 'SIA00835-SPOT-HOLD-BUG-REVERSAL';

  console.log('=== Fix SIA00835 SPOT hold bug (local DB) ===');

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
  const existingAdjustment = await prisma.ledger_entries.findFirst({
    where: { idempotency_key: idempotencyKey },
    select: { id: true, amount: true, credited_at: true },
  });

  if (existingAdjustment) {
    console.log('Adjustment already exists with this idempotency key, nothing to do:');
    console.log(existingAdjustment);
    return;
  }

  // Bug-affected SPOT ledger ids (hard-coded from investigation)
  const bugEntryIds = [403608n, 403611n, 403610n, 403609n];

  const bugEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      commission_type: 'SPOT',
      id: { in: bugEntryIds },
    },
    select: {
      id: true,
      amount: true,
      credited_at: true,
      metadata: true,
    },
    orderBy: { id: 'asc' },
  });

  if (bugEntries.length === 0) {
    console.log('No matching SPOT entries found for given ids, aborting.');
    return;
  }

  console.log('\nBug-affected SPOT entries:');
  let adjustAmount = 0;
  for (const e of bugEntries) {
    const amt = Number(e.amount);
    adjustAmount += amt;
    console.log(
      `  id=${e.id.toString()} amount=${amt} credited_at=${e.credited_at.toISOString()}`
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
  if (spotBalance < adjustAmount - 0.001) {
    console.log(
      `\n❌ Spot balance (${spotBalance}) is less than adjustment (${adjustAmount}). Not applying fix.`
    );
    return;
  }

  console.log('\n✅ Spot balance is sufficient, applying adjustment inside a transaction...');

  await prisma.$transaction(async (tx) => {
    // Create ADMIN_OPS negative ledger entry on spot wallet
    const ledger = await tx.ledger_entries.create({
      data: {
        receiver_user_id: user.id,
        source_user_id: user.id,
        purchase_id: null,
        commission_type: 'ADMIN_OPS' as any,
        amount: -adjustAmount,
        metadata: {
          reason: 'SPOT_HOLD_RULE_BUG_REVERSAL',
          wallet_type: 'spot_balance',
          bug_entry_ids: bugEntries.map((e) => e.id.toString()),
          note:
            'Reversing Level 1 SPOT that became withdrawable early due to purchase-date based hold logic bug.',
        } as any,
        idempotency_key: idempotencyKey,
      },
    });

    console.log('\nCreated ADMIN_OPS ledger entry:', ledger.id.toString());

    // Create matching wallet_transaction (negative amount)
    await tx.wallet_transactions.create({
      data: {
        receiver_user_id: user.id,
        ledger_entry_id: ledger.id,
        amount: -adjustAmount,
        idempotency_key: idempotencyKey,
      },
    });

    // Ensure user_balances row exists
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

    // Decrement balance and spot_balance by adjustment amount
    await tx.$executeRawUnsafe(
      `UPDATE user_balances
       SET balance = balance - $1,
           spot_balance = spot_balance - $1,
           updated_at = now()
       WHERE user_id = $2`,
      adjustAmount,
      user.id
    );
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

  console.log('\n✅ Done. Adjustment applied successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

