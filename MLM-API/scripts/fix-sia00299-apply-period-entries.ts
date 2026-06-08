/**
 * Backup (2026-02-19 04:45:46) restore ke baad, 19 Feb 04:45:46 se 21 Feb 2026 tak
 * jo ledger entries is user (280) ko mili (SPOT + MONTHLY team_royalty), unke hisaab se
 * spot_balance aur team_royalty_balance update karo. Lock wala spot bhi balance me aata hai.
 * Main wallet (other_balance) change nahi.
 * Run: npx tsx scripts/fix-sia00299-apply-period-entries.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_ID = 280n;
const PERIOD_START = '2026-02-19T04:45:46.000Z';
const PERIOD_END = '2026-02-21T23:59:59.999Z';

async function main() {
  const userId = USER_ID;

  const [spotDelta, trDelta, debitsSpot, debitsTr] = await Promise.all([
    prisma.$queryRaw<Array<{ s: string }>>`
      SELECT COALESCE(SUM(amount), 0)::text AS s FROM ledger_entries
      WHERE receiver_user_id = ${userId} AND amount > 0 AND credited_at > ${PERIOD_START}::timestamptz AND credited_at <= ${PERIOD_END}::timestamptz
        AND (commission_type = 'SPOT' OR (commission_type = 'MONTHLY' AND metadata->>'wallet_type' = 'spot_balance'))
        AND (commission_type != 'ADMIN_OPS' OR metadata->>'reason' NOT LIKE 'Restore from backup%')
    `,
    prisma.$queryRaw<Array<{ s: string }>>`
      SELECT COALESCE(SUM(amount), 0)::text AS s FROM ledger_entries
      WHERE receiver_user_id = ${userId} AND amount > 0 AND credited_at > ${PERIOD_START}::timestamptz AND credited_at <= ${PERIOD_END}::timestamptz
        AND metadata->>'wallet_type' = 'team_royalty_balance'
    `,
    prisma.$queryRaw<Array<{ s: string }>>`
      SELECT COALESCE(SUM(amount), 0)::text AS s FROM ledger_entries
      WHERE receiver_user_id = ${userId} AND amount < 0 AND credited_at > ${PERIOD_START}::timestamptz AND credited_at <= ${PERIOD_END}::timestamptz
        AND (metadata->>'wallet_type' = 'spot_balance' OR (metadata->>'spot_deducted')::numeric > 0)
    `,
    prisma.$queryRaw<Array<{ s: string }>>`
      SELECT COALESCE(SUM(amount), 0)::text AS s FROM ledger_entries
      WHERE receiver_user_id = ${userId} AND amount < 0 AND credited_at > ${PERIOD_START}::timestamptz AND credited_at <= ${PERIOD_END}::timestamptz
        AND (metadata->>'wallet_type' = 'team_royalty_balance' OR (metadata->>'team_royalty_deducted')::numeric > 0)
    `,
  ]);

  const spotCredit = Number(spotDelta[0]?.s ?? 0);
  const trCredit = Number(trDelta[0]?.s ?? 0);
  const spotDebit = Number(debitsSpot[0]?.s ?? 0);
  const trDebit = Number(debitsTr[0]?.s ?? 0);
  const netSpot = spotCredit + spotDebit;
  const netTr = trCredit + trDebit;

  console.log('Period 19 Feb 04:45:46 to 21 Feb 2026:');
  console.log('  Spot: credits', spotCredit, ', debits', spotDebit, '→ net', netSpot);
  console.log('  Team royalty: credits', trCredit, ', debits', trDebit, '→ net', netTr);

  if (netSpot === 0 && netTr === 0) {
    console.log('No change; skipping.');
    return;
  }

  const row = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  if (!row) throw new Error('user_balances not found');
  const otherBalance = Number(row.other_balance ?? 0);
  const currentSpot = Number(row.spot_balance ?? 0);
  const currentTr = Number(row.team_royalty_balance ?? 0);

  const newSpot = currentSpot + netSpot;
  const newTr = currentTr + netTr;
  const newTotal = otherBalance + newSpot + newTr;

  await prisma.user_balances.update({
    where: { user_id: userId },
    data: {
      spot_balance: newSpot,
      team_royalty_balance: newTr,
      balance: newTotal,
      updated_at: new Date(),
    },
  });

  console.log('Updated: spot_balance', currentSpot, '→', newSpot, ', team_royalty_balance', currentTr, '→', newTr);
  console.log('Total balance =', newTotal);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
