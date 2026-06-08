/**
 * Local DB only: Simulate 15-day flush for SIA00334.
 * 1) Set spot_team_limit_reached_at to 16 days ago
 * 2) Run flush (zero spot + team_royalty, set spot_team_flush_active = true)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00334';
  const user = await prisma.users.findFirst({
    where: { display_id: displayId },
    select: { id: true, display_id: true },
  });
  if (!user) {
    console.error('User', displayId, 'not found');
    process.exit(1);
  }

  const before = await prisma.user_balances.findFirst({
    where: { user_id: user.id },
  });
  if (!before) {
    console.error('No balance row for', displayId);
    process.exit(1);
  }

  console.log('=== BEFORE (SIA00334) ===');
  console.log('spot_balance:', before.spot_balance?.toString());
  console.log('team_royalty_balance:', before.team_royalty_balance?.toString());
  console.log('balance:', before.balance?.toString());
  console.log('spot_team_limit_reached_at:', before.spot_team_limit_reached_at);
  console.log('spot_team_flush_active:', before.spot_team_flush_active);

  const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);

  // 1) Set limit_reached_at to 16 days ago so "15 days passed"
  await prisma.user_balances.update({
    where: { user_id: user.id },
    data: { spot_team_limit_reached_at: sixteenDaysAgo },
  });
  console.log('\nSet spot_team_limit_reached_at to', sixteenDaysAgo.toISOString());

  // 2) Run flush (same as wallet.ts): zero spot + team_royalty, set flag
  await prisma.$executeRawUnsafe(
    `UPDATE user_balances SET
      balance = balance - spot_balance - team_royalty_balance,
      spot_balance = 0,
      team_royalty_balance = 0,
      spot_team_flush_active = true,
      updated_at = now()
    WHERE user_id = $1`,
    user.id
  );
  console.log('Flush applied (spot=0, team_royalty=0, spot_team_flush_active=true).');

  const after = await prisma.user_balances.findFirst({
    where: { user_id: user.id },
  });
  console.log('\n=== AFTER (SIA00334) ===');
  console.log('spot_balance:', after?.spot_balance?.toString());
  console.log('team_royalty_balance:', after?.team_royalty_balance?.toString());
  console.log('balance:', after?.balance?.toString());
  console.log('spot_team_flush_active:', after?.spot_team_flush_active);
  console.log('\nDone. Local DB only.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
