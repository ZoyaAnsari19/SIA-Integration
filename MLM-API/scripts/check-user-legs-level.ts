/**
 * Check user level, legs, and leg-wise business by display_id.
 * Usage: npx tsx scripts/check-user-legs-level.ts SIA00111
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = process.argv[2] || 'SIA00111';
  const user = await prisma.users.findFirst({
    where: { display_id: { equals: displayId, mode: 'insensitive' } },
    select: { id: true, display_id: true, name: true, email: true, referrer_user_id: true, is_disqualified: true, disqualified_at: true },
  });
  if (!user) {
    console.log(`User not found: ${displayId}`);
    process.exit(1);
  }
  const userId = user.id as bigint;

  const levelEligibility = await prisma.level_eligibility.findUnique({
    where: { user_id: userId },
  });
  const eligibility = (levelEligibility?.eligibility as Record<string, boolean>) || {};

  const directLegs = await prisma.user_tree_paths.findMany({
    where: { ancestor_id: userId, depth: 1 },
  });

  const volumes: Record<string, number> = {};
  const legDetails: { display_id: string; name: string | null; legBusiness: number }[] = [];

  for (const leg of directLegs) {
    const legId = leg.descendant_id as bigint;
    const team = await prisma.user_tree_paths.findMany({ where: { ancestor_id: legId } });
    const memberIds = [legId.toString(), ...team.map((t) => t.descendant_id.toString())];
    const sum = await prisma.purchases.aggregate({
      _sum: { amount: true },
      where: { user_id: { in: memberIds.map((x) => BigInt(x)) }, status: 'completed' },
    });
    const legBusiness = Number(sum._sum.amount ?? 0);
    volumes[legId.toString()] = legBusiness;

    const legUser = await prisma.users.findUnique({
      where: { id: legId },
      select: { display_id: true, name: true },
    });
    legDetails.push({
      display_id: legUser?.display_id ?? String(legId),
      name: legUser?.name ?? null,
      legBusiness,
    });
  }

  const totalTeamBusiness = Object.values(volumes).reduce((s, v) => s + v, 0);
  const level1Required = 375000;
  const level1Qualified = Object.values(volumes).filter((v) => v >= level1Required).length >= 1;

  console.log('\n========== USER SUMMARY ==========');
  console.log('Display ID:', user.display_id);
  console.log('Name:', user.name);
  console.log('User ID (DB):', user.id.toString());
  console.log('Referrer User ID:', user.referrer_user_id?.toString() ?? 'null');
  console.log('Disqualified:', user.is_disqualified, user.disqualified_at ? `(from ${user.disqualified_at.toISOString().slice(0, 10)})` : '');
  console.log('\n========== LEVEL ELIGIBILITY ==========');
  for (let l = 1; l <= 9; l++) {
    console.log(`Level ${l}: ${eligibility[String(l)] === true ? 'QUALIFIED' : 'Not qualified'}`);
  }
  console.log('\n========== LEGS (Direct Referrals) ==========');
  console.log('Total direct legs (direct referrals):', directLegs.length);
  console.log('');
  legDetails.forEach((leg, i) => {
    const meetsLevel1 = leg.legBusiness >= level1Required ? ' ✅ (≥3.75L)' : '';
    console.log(`  Leg ${i + 1}: ${leg.display_id} | ${leg.name ?? '-'} | Business: ₹${(leg.legBusiness / 100000).toFixed(2)} Lakh${meetsLevel1}`);
  });
  console.log('\n========== BUSINESS SUMMARY ==========');
  console.log('Total team business (all legs):', `₹${(totalTeamBusiness / 100000).toFixed(2)} Lakh`);
  console.log('Level 1 requirement: 1 leg with ≥ ₹3.75 Lakh');
  console.log('Level 1 qualified (by legs):', level1Qualified ? 'YES' : 'NO');
  console.log('\n========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
