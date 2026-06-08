import { prisma } from '../../config/prisma.js';

type LegVolume = Record<string, number>;

export async function computeEligibilityForUser(userId: bigint) {
  // Check if user is disqualified
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { is_disqualified: true, disqualified_at: true },
  });

  // Compute business (sum of purchases.amount) per first-level leg (direct referrals)
  const directLegs = await prisma.user_tree_paths.findMany({ where: { ancestor_id: userId, depth: 1 } });
  
  // If user is disqualified, filter to only new referrals (added after disqualification date)
  let filteredLegs = directLegs;
  if (user?.is_disqualified && user.disqualified_at) {
    const newReferrals = await prisma.users.findMany({
      where: {
        referrer_user_id: userId,
        created_at: { gt: user.disqualified_at },
      },
      select: { id: true },
    });
    const newReferralIds = new Set(newReferrals.map(r => r.id.toString()));
    filteredLegs = directLegs.filter(leg => 
      newReferralIds.has(leg.descendant_id.toString())
    );
    console.log(`    ℹ️  User ${userId} is disqualified. Only counting ${filteredLegs.length} new referrals (after ${user.disqualified_at.toISOString().split('T')[0]}).`);
  }

  const volumes: LegVolume = {};
  for (const leg of filteredLegs) {
    const legId = leg.descendant_id as unknown as bigint;
    const team = await prisma.user_tree_paths.findMany({ where: { ancestor_id: legId } });
    const memberIds = [legId.toString(), ...team.map((t) => t.descendant_id.toString())];
    const sum = await prisma.purchases.aggregate({
      _sum: { amount: true },
      where: { user_id: { in: memberIds.map((x) => BigInt(x) as any) }, status: 'completed' },
    });
    volumes[legId.toString()] = Number(sum._sum.amount ?? 0);
  }

  // Determine levels based on levels table business requirements (Source of Truth)
  const levels = await prisma.levels.findMany({ 
    where: { level: { gte: 1, lte: 9 } },
    orderBy: { level: 'asc' }
  });
  
  const elig: Record<string, boolean> = {};
  
  // Calculate total team business (sum of all leg volumes)
  const totalTeamBusiness = Object.values(volumes).reduce((sum, v) => sum + v, 0);
  
  for (const levelData of levels) {
    const level = levelData.level;
    const businessReq = levelData.business_requirement as {
      required_leg_count?: number;
      required_leg_min_amount?: number;
      total_business?: number;
    } | null;
    
    if (!businessReq) {
      elig[String(level)] = false;
      continue;
    }
    
    const requiredLegCount = businessReq.required_leg_count ?? 0;
    const requiredLegMinAmount = businessReq.required_leg_min_amount ?? 0;
    const requiredTotalBusiness = businessReq.total_business ?? 0;
    
    // Level 1 only: combined rule (4 legs + each >= min amount + total team business >= total_business)
    // Admin sets: Required Leg Count, Required Leg Min Amount, Total Business in Master > Levels
    if (level === 1 && requiredLegCount > 0 && requiredLegMinAmount > 0 && requiredTotalBusiness > 0) {
      const satisfied = Object.values(volumes).filter((v) => v >= requiredLegMinAmount).length;
      elig[String(level)] =
        satisfied >= requiredLegCount && totalTeamBusiness >= requiredTotalBusiness;
      continue;
    }

    // Determine if this level uses leg-based or total-business-based requirements
    // Level 9: required_leg_count = 0, required_leg_min_amount = 0, total_business = requirement
    // Levels 1-8: required_leg_count > 0, total_business is just metadata (except Level 1 handled above)
    const isTotalBusinessBased = (requiredLegCount === 0 && requiredLegMinAmount === 0 && requiredTotalBusiness > 0);
    const isLegBased = (requiredLegCount > 0 || requiredLegMinAmount > 0);
    
    if (isTotalBusinessBased) {
      // Level 9: Check total business requirement only
      elig[String(level)] = totalTeamBusiness >= requiredTotalBusiness;
    } else if (isLegBased) {
      // Levels 2-8 (and Level 1 when not all three set): Check leg-based requirement only
      const satisfied = Object.values(volumes).filter(
        (v) => v >= requiredLegMinAmount
      ).length;
      elig[String(level)] = satisfied >= requiredLegCount;
    } else {
      // No requirements specified
      elig[String(level)] = false;
    }
  }

  await prisma.level_eligibility.upsert({
    where: { user_id: userId },
    update: { eligibility: elig, updated_at: new Date() },
    create: { user_id: userId, eligibility: elig },
  });

  return elig;
}

export async function recomputeAllEligibility() {
  const users = await prisma.users.findMany({ select: { id: true } });
  for (const u of users) {
    await computeEligibilityForUser(u.id as unknown as bigint);
  }
}


