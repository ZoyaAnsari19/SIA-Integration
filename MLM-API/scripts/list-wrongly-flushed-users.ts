/**
 * List users affected by wrong flush: spot_team_flush_active = true but remaining > 0.
 * Run: npx tsx scripts/list-wrongly-flushed-users.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getSpotTeamWithdrawLimit } from '../src/utils/spotTeamWithdrawLimit.js';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.user_balances.findMany({
    where: { spot_team_flush_active: true },
    select: { user_id: true },
  });
  console.log('Users with spot_team_flush_active = true:', rows.length);
  const affected: Array<{ user_id: string; display_id: string; name: string; used: number; limit: number; remaining: number }> = [];
  for (const r of rows) {
    const userId = r.user_id as bigint;
    const limitResult = await getSpotTeamWithdrawLimit(userId);
    if (limitResult.spot_team_withdraw_remaining > 0) {
      const u = await prisma.users.findUnique({
        where: { id: userId },
        select: { display_id: true, name: true },
      });
      affected.push({
        user_id: userId.toString(),
        display_id: u?.display_id ?? userId.toString(),
        name: u?.name ?? '—',
        used: limitResult.spot_team_withdraw_used,
        limit: limitResult.spot_team_withdraw_limit,
        remaining: limitResult.spot_team_withdraw_remaining,
      });
    }
  }
  console.log('\nWrongly flushed (remaining > 0):', affected.length);
  console.log(JSON.stringify(affected, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
