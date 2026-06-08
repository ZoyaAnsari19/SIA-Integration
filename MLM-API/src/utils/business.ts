import { prisma } from '../config/prisma.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export async function isUserActive(userId: bigint): Promise<boolean> {
  // Check if user has at least one active course (not reached 2x)
  // Active course = purchase has NOT reached 2x investment (date doesn't matter, only 2x matters)
  // This matches the logic in creditDailyCommissions() where expiry is based on 2x, not active_until
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      status: 'completed',
    },
    select: {
      id: true,
      status: true,
      // active_until removed - expiry is ONLY based on 2x income
    },
  });

  // Check if any purchase has not reached 2x
  for (const purchase of purchases) {
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
    if (!isDoubleReached) {
      return true; // Found at least one active course (not reached 2x)
    }
  }

  return false; // No active course found (all reached 2x)
}

export async function getUplines(userId: bigint, maxDepth = 9): Promise<Array<{ ancestor_id: bigint; depth: number }>> {
  const rows = await prisma.user_tree_paths.findMany({
    where: { descendant_id: userId, depth: { gt: 0, lte: maxDepth } },
    orderBy: { depth: 'asc' },
  });
  return rows.map((r) => ({ ancestor_id: r.ancestor_id as unknown as bigint, depth: r.depth }));
}

export async function checkEligibility(userId: bigint, level: number): Promise<boolean> {
  const row = await prisma.level_eligibility.findUnique({ where: { user_id: userId } });
  if (!row) return false;
  const key = String(level);
  const map = row.eligibility as Record<string, boolean>;
  return Boolean(map?.[key]);
}


