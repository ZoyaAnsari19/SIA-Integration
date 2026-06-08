/**
 * Restore team_royalty for SIA00299 (user_id 280) — only jitna flush hua tha utna.
 * Restore = team_royalty balance at flush cutoff (spot_team_limit_reached_at).
 * Run once: npx tsx scripts/fix-sia00299-team-royalty-restore.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_DISPLAY_ID = 'SIA00299';
const USER_ID = 280n;
const FLUSH_CUTOFF = '2026-02-04T10:17:14.764Z';

async function main() {
  const userId = USER_ID;

  const trAtFlush = await prisma.$queryRaw<Array<{ s: string }>>`
    SELECT (
      (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
       WHERE receiver_user_id = ${userId} AND amount > 0 AND metadata->>'wallet_type' = 'team_royalty_balance'
       AND credited_at <= ${FLUSH_CUTOFF}::timestamptz)
      +
      (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
       WHERE receiver_user_id = ${userId} AND credited_at <= ${FLUSH_CUTOFF}::timestamptz AND amount < 0
       AND (metadata->>'wallet_type' = 'team_royalty_balance' OR (metadata->>'team_royalty_deducted')::numeric > 0))
    )::text AS s
  `;
  const restoreAmount = Math.max(0, Number(trAtFlush[0]?.s ?? 0));

  console.log('Team royalty at flush cutoff: restore amount =', restoreAmount);

  if (restoreAmount <= 0) {
    console.log('Nothing to restore.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const balance = await tx.user_balances.findUnique({ where: { user_id: userId } });
    if (!balance) throw new Error('user_balances not found');
    const currentTr = Number(balance.team_royalty_balance ?? 0);
    const currentTotal = Number(balance.balance ?? 0);
    const newTr = currentTr + restoreAmount;
    const newTotal = currentTotal + restoreAmount;

    await tx.user_balances.update({
      where: { user_id: userId },
      data: {
        team_royalty_balance: newTr,
        balance: newTotal,
        updated_at: new Date(),
      },
    });
    console.log('team_royalty_balance:', currentTr, '->', newTr, ', balance:', currentTotal, '->', newTotal);

    const ledger = await tx.ledger_entries.create({
      data: {
        receiver_user_id: userId,
        source_user_id: userId,
        purchase_id: null,
        commission_type: 'ADMIN_OPS',
        amount: restoreAmount,
        metadata: {
          reason: 'Restoration: incorrect 10x flush reversed (team royalty) for ' + USER_DISPLAY_ID,
          wallet_type: 'team_royalty_balance',
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
    console.log('Created ledger id:', ledger.id.toString());
  });

  const after = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  console.log('\nAfter: team_royalty_balance=', after?.team_royalty_balance?.toString(), ', balance=', after?.balance?.toString());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
