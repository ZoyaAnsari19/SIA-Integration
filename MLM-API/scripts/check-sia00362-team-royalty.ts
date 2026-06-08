/**
 * Check SIA00362: Dashboard shows Team Royalty ₹1,296.49 but withdrawal shows Available ₹0.
 * Root cause: Withdraw page shows Available = min(team_royalty_balance, spot_team_withdraw_remaining).
 * If 10× limit is exhausted (spot_team_withdraw_remaining = 0), Available shows 0.
 * Run: npx tsx scripts/check-sia00362-team-royalty.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getSpotTeamWithdrawLimit } from '../src/utils/spotTeamWithdrawLimit.js';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00362';

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });
  if (!user) {
    console.log('User SIA00362 not found.');
    return;
  }
  const userId = user.id;
  console.log('=== User ===');
  console.log('id:', userId.toString(), 'display_id:', user.display_id, 'name:', user.name);
  console.log('');

  const balance = await prisma.user_balances.findUnique({
    where: { user_id: userId },
  });
  console.log('=== user_balances ===');
  const teamRoyalty = balance?.team_royalty_balance != null ? Number(balance.team_royalty_balance) : 0;
  const spotUsed = balance?.spot_team_withdraw_used != null ? Number(balance.spot_team_withdraw_used) : 0;
  console.log('team_royalty_balance:', balance?.team_royalty_balance?.toString() ?? 'N/A', `(₹${teamRoyalty.toFixed(2)})`);
  console.log('spot_balance:', balance?.spot_balance?.toString() ?? 'N/A');
  console.log('other_balance:', balance?.other_balance?.toString() ?? 'N/A');
  console.log('spot_team_withdraw_used:', balance?.spot_team_withdraw_used?.toString() ?? 'N/A', `(₹${spotUsed.toFixed(2)})`);
  console.log('spot_team_limit_reached_at:', (balance as any)?.spot_team_limit_reached_at ?? 'N/A');
  console.log('spot_team_flush_active:', (balance as any)?.spot_team_flush_active ?? 'N/A');
  console.log('');

  const limitResult = await getSpotTeamWithdrawLimit(userId);
  console.log('=== 10× Spot/Team Royalty limit (getSpotTeamWithdrawLimit) ===');
  console.log('spot_team_withdraw_limit:', '₹' + limitResult.spot_team_withdraw_limit.toFixed(2));
  console.log('spot_team_withdraw_used:', '₹' + limitResult.spot_team_withdraw_used.toFixed(2));
  console.log('spot_team_withdraw_remaining:', '₹' + limitResult.spot_team_withdraw_remaining.toFixed(2));
  console.log('spot_team_withdraw_multiplier:', limitResult.spot_team_withdraw_multiplier + '×');
  console.log('');

  const availableOnWithdrawPage = Math.min(teamRoyalty, limitResult.spot_team_withdraw_remaining);
  console.log('=== Why withdrawal shows Available ₹0 ===');
  console.log('Dashboard Team Royalty (balance):', '₹' + teamRoyalty.toFixed(2));
  console.log('Withdraw page Available = min(team_royalty_balance, spot_team_withdraw_remaining)');
  console.log('  = min(' + teamRoyalty.toFixed(2) + ', ' + limitResult.spot_team_withdraw_remaining.toFixed(2) + ') = ₹' + availableOnWithdrawPage.toFixed(2));
  if (limitResult.spot_team_withdraw_remaining <= 0) {
    console.log('');
    console.log('>>> Cause: 10× package limit exhausted (spot_team_withdraw_remaining = 0).');
    console.log('>>> User has already withdrawn Spot + Team Royalty up to the limit this cycle.');
    console.log('>>> To withdraw more: user must upgrade/buy new package to get a new cycle and reset limit.');
  }
  console.log('');

  const purchases = await prisma.purchases.findMany({
    where: { user_id: userId, status: 'completed' },
    orderBy: { purchased_at: 'desc' },
    take: 5,
    select: { id: true, amount: true, purchased_at: true, previous_purchase_id: true },
  });
  console.log('=== Latest completed purchases (for limit base value) ===');
  for (const p of purchases) {
    console.log('  id:', p.id.toString(), 'amount:', p.amount.toString(), 'purchased_at:', p.purchased_at, 'prev:', p.previous_purchase_id?.toString() ?? 'null');
  }
  console.log('');

  const withdrawals = await prisma.withdraw_requests.findMany({
    where: { user_id: userId, withdraw_type: { in: ['spot', 'team_royalty'] }, status: { in: ['approved', 'processing'] } },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  console.log('=== Approved/Processing Spot + Team Royalty withdrawals ===');
  for (const w of withdrawals) {
    console.log('  id:', w.id.toString(), 'amount:', w.amount.toString(), 'type:', w.withdraw_type, 'status:', w.status, 'created_at:', w.created_at);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
