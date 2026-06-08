/**
 * Revert over-restoration for SIA00299: flush ke waqt actually 0 tha spot + team_royalty.
 * So jo extra return kiya (9432 + 15207.25) wo wapas le lo.
 * Run once: npx tsx scripts/fix-sia00299-revert-over-restore.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_ID = 280n;
const FLUSH_CUTOFF = '2026-02-04T10:17:14.764Z'; // spot_team_limit_reached_at (known value)

async function main() {
  const userId = USER_ID;

  // Balance at flush cutoff (only entries credited_at <= cutoff)
  const [spotAtFlush, trAtFlush] = await Promise.all([
    prisma.$queryRaw<Array<{ spot: string }>>`
      SELECT (
        (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
         WHERE receiver_user_id = ${userId} AND commission_type = 'SPOT' AND credited_at <= ${FLUSH_CUTOFF}::timestamptz)
        +
        (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
         WHERE receiver_user_id = ${userId} AND credited_at <= ${FLUSH_CUTOFF}::timestamptz AND amount < 0
         AND (metadata->>'wallet_type' = 'spot_balance' OR (metadata->>'spot_deducted')::numeric > 0))
      )::text AS spot
    `,
    prisma.$queryRaw<Array<{ tr: string }>>`
      SELECT (
        (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
         WHERE receiver_user_id = ${userId} AND amount > 0 AND metadata->>'wallet_type' = 'team_royalty_balance'
         AND credited_at <= ${FLUSH_CUTOFF}::timestamptz)
        +
        (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
         WHERE receiver_user_id = ${userId} AND credited_at <= ${FLUSH_CUTOFF}::timestamptz AND amount < 0
         AND (metadata->>'wallet_type' = 'team_royalty_balance' OR (metadata->>'team_royalty_deducted')::numeric > 0))
      )::text AS tr
    `,
  ]);

  const spotRestore = Math.max(0, Number(spotAtFlush[0]?.spot ?? 0));
  const trRestore = Math.max(0, Number(trAtFlush[0]?.tr ?? 0));
  console.log('At flush cutoff, correct restore: spot=', spotRestore, ', team_royalty=', trRestore);

  const balance = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  if (!balance) throw new Error('user_balances not found');
  const currentSpot = Number(balance.spot_balance ?? 0);
  const currentTr = Number(balance.team_royalty_balance ?? 0);
  const currentTotal = Number(balance.balance ?? 0);
  const otherBalance = Number(balance.other_balance ?? 0);

  const excessSpot = Math.max(0, currentSpot - spotRestore);
  const excessTr = Math.max(0, currentTr - trRestore);
  console.log('Current spot=', currentSpot, ', current team_royalty=', currentTr);
  console.log('Excess to revert: spot=', excessSpot, ', team_royalty=', excessTr);

  if (excessSpot <= 0 && excessTr <= 0) {
    console.log('Nothing to revert.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const newSpot = currentSpot - excessSpot;
    const newTr = currentTr - excessTr;
    const newTotal = otherBalance + newSpot + newTr;

    if (excessSpot > 0) {
      const ledgerSpot = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId,
          purchase_id: null,
          commission_type: 'ADMIN_OPS',
          amount: -excessSpot,
          metadata: {
            reason: 'Reversal: over-restoration of spot (only flush amount should be returned)',
            wallet_type: 'spot_balance',
          },
        },
      });
      await tx.wallet_transactions.create({
        data: { receiver_user_id: userId, ledger_entry_id: ledgerSpot.id, amount: -excessSpot },
      });
    }
    if (excessTr > 0) {
      const ledgerTr = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId,
          purchase_id: null,
          commission_type: 'ADMIN_OPS',
          amount: -excessTr,
          metadata: {
            reason: 'Reversal: over-restoration of team royalty (only flush amount should be returned)',
            wallet_type: 'team_royalty_balance',
          },
        },
      });
      await tx.wallet_transactions.create({
        data: { receiver_user_id: userId, ledger_entry_id: ledgerTr.id, amount: -excessTr },
      });
    }

    await tx.user_balances.update({
      where: { user_id: userId },
      data: {
        spot_balance: newSpot,
        team_royalty_balance: newTr,
        balance: newTotal,
        updated_at: new Date(),
      },
    });
    console.log('Updated: spot_balance=', newSpot, ', team_royalty_balance=', newTr, ', balance=', newTotal);
  });

  const after = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  console.log('\nAfter revert: spot=', after?.spot_balance?.toString(), ', team_royalty=', after?.team_royalty_balance?.toString(), ', balance=', after?.balance?.toString());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
