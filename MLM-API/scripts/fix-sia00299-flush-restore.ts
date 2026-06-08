/// <reference types="node" />
/**
 * Fix SIA00299 (user_id 280): clear wrong flush + restore only the amount that was actually flushed.
 * - Restore = balance at flush cutoff (spot_team_limit_reached_at), not full ledger.
 * - Clears spot_team_limit_reached_at and spot_team_flush_active.
 * Run: npx tsx scripts/fix-sia00299-flush-restore.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_DISPLAY_ID = 'SIA00299';
const USER_ID = 280n;
const FLUSH_CUTOFF = '2026-02-04T10:17:14.764Z'; // spot_team_limit_reached_at at time of fix

async function main() {
  const userId = USER_ID;

  // Restore = spot balance at flush cutoff only (jitna flush hua utna)
  const spotAtFlush = await prisma.$queryRaw<Array<{ s: string }>>`
    SELECT (
      (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
       WHERE receiver_user_id = ${userId} AND commission_type = 'SPOT' AND credited_at <= ${FLUSH_CUTOFF}::timestamptz)
      +
      (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
       WHERE receiver_user_id = ${userId} AND credited_at <= ${FLUSH_CUTOFF}::timestamptz AND amount < 0
       AND (metadata->>'wallet_type' = 'spot_balance' OR (metadata->>'spot_deducted')::numeric > 0))
    )::text AS s
  `;
  const restoreAmount = Math.max(0, Number(spotAtFlush[0]?.s ?? 0));

  console.log('Spot at flush cutoff: restore amount =', restoreAmount);

  if (restoreAmount <= 0) {
    console.log('Nothing to restore; only clearing flush flags.');
  }

  await prisma.$transaction(async (tx) => {
    const balance = await tx.user_balances.findUnique({ where: { user_id: userId } });
    if (!balance) {
      throw new Error('user_balances row not found');
    }
    const currentSpot = Number(balance.spot_balance ?? 0);
    const currentTotal = Number(balance.balance ?? 0);
    const newSpot = currentSpot + restoreAmount;
    const newTotal = currentTotal + restoreAmount;

    // Clear flush flags
    await tx.user_balances.update({
      where: { user_id: userId },
      data: {
        spot_team_limit_reached_at: null,
        spot_team_flush_active: false,
        spot_balance: newSpot,
        balance: newTotal,
        updated_at: new Date(),
      },
    });
    console.log('Cleared flush flags. spot_balance:', currentSpot, '->', newSpot, ', balance:', currentTotal, '->', newTotal);

    if (restoreAmount > 0) {
      const ledger = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId,
          purchase_id: null,
          commission_type: 'ADMIN_OPS',
          amount: restoreAmount,
          metadata: {
            reason: 'Restoration: incorrect 10x flush reversed for ' + USER_DISPLAY_ID,
            wallet_type: 'spot_balance',
          },
        },
      });
      await tx.wallet_transactions.create({
        data: {
          receiver_user_id: userId,
          ledger_entry_id: ledger.id,
          amount: restoreAmount,
        },
      });
      console.log('Created ledger entry id:', ledger.id.toString(), 'and wallet_transaction for +' + restoreAmount);
    }
  });

  const after = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  console.log('\nAfter fix: spot_balance=', after?.spot_balance?.toString(), ', balance=', after?.balance?.toString());
  console.log('spot_team_flush_active=', (after as any)?.spot_team_flush_active, ', spot_team_limit_reached_at=', (after as any)?.spot_team_limit_reached_at ?? 'null');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
