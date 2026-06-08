/**
 * Restore SIA00299 (user_id 280) spot + team_royalty from prod backup 2026-02-19 04:45:46.
 * Main wallet (other_balance) touch nahi karte — sirf spot aur team royalty.
 * Amounts: spot = 9644.50, team_royalty = 12484.81
 * Run: npx tsx scripts/fix-sia00299-restore-from-backup.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_DISPLAY_ID = 'SIA00299';
const USER_ID = 280n;
const SPOT_RESTORE = 9644.5;
const TEAM_ROYALTY_RESTORE = 12484.81;

async function main() {
  const userId = USER_ID;

  await prisma.$transaction(async (tx) => {
    const row = await tx.user_balances.findUnique({ where: { user_id: userId } });
    if (!row) throw new Error('user_balances not found');
    const otherBalance = Number(row.other_balance ?? 0);
    const currentSpot = Number(row.spot_balance ?? 0);
    const currentTr = Number(row.team_royalty_balance ?? 0);

    const newSpot = SPOT_RESTORE;
    const newTr = TEAM_ROYALTY_RESTORE;
    const newTotal = otherBalance + newSpot + newTr;

    const spotDelta = newSpot - currentSpot;
    const trDelta = newTr - currentTr;

    if (spotDelta > 0) {
      const le = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId,
          purchase_id: null,
          commission_type: 'ADMIN_OPS',
          amount: spotDelta,
          metadata: {
            reason: 'Restore from backup (2026-02-19): incorrect flush reversed – spot for ' + USER_DISPLAY_ID,
            wallet_type: 'spot_balance',
          },
        },
      });
      await tx.wallet_transactions.create({
        data: { receiver_user_id: userId, ledger_entry_id: le.id, amount: spotDelta },
      });
    }
    if (trDelta > 0) {
      const le = await tx.ledger_entries.create({
        data: {
          receiver_user_id: userId,
          source_user_id: userId,
          purchase_id: null,
          commission_type: 'ADMIN_OPS',
          amount: trDelta,
          metadata: {
            reason: 'Restore from backup (2026-02-19): incorrect flush reversed – team royalty for ' + USER_DISPLAY_ID,
            wallet_type: 'team_royalty_balance',
          },
        },
      });
      await tx.wallet_transactions.create({
        data: { receiver_user_id: userId, ledger_entry_id: le.id, amount: trDelta },
      });
    }

    await tx.user_balances.update({
      where: { user_id: userId },
      data: {
        spot_balance: newSpot,
        team_royalty_balance: newTr,
        balance: newTotal,
        spot_team_limit_reached_at: null,
        spot_team_flush_active: false,
        updated_at: new Date(),
      },
    });

    console.log('Restored: spot_balance =', newSpot, ', team_royalty_balance =', newTr);
    console.log('Total balance = other + spot + team_royalty =', newTotal);
    console.log('Main wallet (other_balance) unchanged =', otherBalance);
  });

  const after = await prisma.user_balances.findUnique({ where: { user_id: userId } });
  console.log('\nAfter: spot=', after?.spot_balance?.toString(), ', team_royalty=', after?.team_royalty_balance?.toString(), ', other=', after?.other_balance?.toString(), ', balance=', after?.balance?.toString());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
