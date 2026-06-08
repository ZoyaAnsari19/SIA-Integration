/**
 * Phase 2: Spot/Team Royalty Withdrawal Limit
 * Withdrawals from Spot + Team Royalty wallets are capped at (multiplier × user's active package value).
 *
 * Rule:
 * - Single package line (1 purchase or 1 upgrade chain): baseValue = that line's current value
 * - Multiple package lines (2+ independent packages): baseValue = sum of all active
 * - limit = baseValue × multiplier (admin-configured; default 10)
 *
 * Tracking:
 * - `spot_team_withdraw_used` is the total approved/processing withdrawals from Spot + Team Royalty
 *   in the CURRENT cycle.
 * - Cycle resets on new package purchase/upgrade completion (we reset spot_team_withdraw_used to 0).
 *
 * Past withdrawals backfill:
 * - For older users (feature added later), we recompute used from `withdraw_requests`
 *   since the latest completed purchase and, if DB stored value is behind, we update it.
 */

import { prisma } from '../config/prisma.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export interface SpotTeamWithdrawLimitResult {
  /** (multiplier × active package value) = max withdrawable from Spot + Team Royalty in this cycle */
  spot_team_withdraw_limit: number;
  /** Amount already withdrawn from Spot + Team Royalty in this cycle */
  spot_team_withdraw_used: number;
  /** Remaining amount user can withdraw from Spot + Team Royalty (max(0, limit - used)) */
  spot_team_withdraw_remaining: number;
  /** Admin-configured multiplier (e.g. 5, 10) used for limit = baseValue × multiplier */
  spot_team_withdraw_multiplier: number;
}

/**
 * Get Spot/Team Royalty withdraw limit: baseValue × multiplier (multiplier from withdrawal_transfer_rules, default 10).
 * Single package line = that line's current value; multiple lines = sum of active.
 */
export async function getSpotTeamWithdrawLimit(userId: bigint): Promise<SpotTeamWithdrawLimitResult> {
  let multiplier = 10;
  try {
    const rules = await prisma.withdrawal_transfer_rules.findFirst({
      where: { is_active: true },
      orderBy: { updated_at: 'desc' },
      select: { spot_team_withdraw_multiplier: true },
    });
    if (rules?.spot_team_withdraw_multiplier != null) {
      const n = Number(rules.spot_team_withdraw_multiplier);
      if (Number.isInteger(n) && n >= 1 && n <= 100) multiplier = n;
    }
  } catch (_) {
    // table or column may not exist yet
  }

  const purchases = await prisma.purchases.findMany({
    where: { user_id: userId, status: 'completed' },
    select: { id: true, amount: true, purchased_at: true, previous_purchase_id: true },
    orderBy: { purchased_at: 'asc' },
  });

  const active: { id: bigint; amount: number; purchased_at: Date; previous_purchase_id: bigint | null }[] = [];
  for (const p of purchases) {
    const is2x = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
    if (!is2x) {
      active.push({
        id: p.id as bigint,
        amount: Number(p.amount),
        purchased_at: p.purchased_at,
        previous_purchase_id: p.previous_purchase_id != null ? BigInt(p.previous_purchase_id) : null,
      });
    }
  }

  let baseValue = 0;
  if (active.length > 0) {
    const pointedToIds = new Set(
      active
        .filter((a) => a.previous_purchase_id !== null)
        .map((a) => a.previous_purchase_id!.toString())
    );
    const roots = active.filter((a) => !pointedToIds.has(a.id.toString()));

    if (roots.length === 1) {
      let current = roots[0];
      while (true) {
        const next = active.find((a) => a.previous_purchase_id !== null && a.previous_purchase_id === current.id);
        if (!next) break;
        current = next;
      }
      baseValue = current.amount;
    } else {
      baseValue = active.reduce((s, a) => s + a.amount, 0);
    }
  }

  const limit = baseValue * multiplier;

  // Read stored used (may be 0 for old users if not backfilled yet)
  const balanceRow = await prisma.user_balances.findUnique({
    where: { user_id: userId },
    select: { spot_team_withdraw_used: true },
  });
  // Prisma Decimal -> number: support both object (toNumber/toString) and primitive
  const rawUsed = balanceRow?.spot_team_withdraw_used;
  let used =
    rawUsed == null
      ? 0
      : typeof rawUsed === 'object' && 'toNumber' in rawUsed
        ? (rawUsed as { toNumber: () => number }).toNumber()
        : Number(rawUsed);

  // Backfill past withdrawals in current cycle (approved/processing spot + team_royalty)
  // Cycle start = latest completed purchase timestamp (reset happens on purchase completion)
  try {
    const latestPurchase = await prisma.purchases.findFirst({
      where: { user_id: userId, status: 'completed' },
      orderBy: { purchased_at: 'desc' },
      select: { purchased_at: true },
    });
    const cycleStart = latestPurchase?.purchased_at ?? new Date(0);

    const agg = await prisma.withdraw_requests.aggregate({
      where: {
        user_id: userId,
        status: { in: ['approved', 'processing'] },
        withdraw_type: { in: ['spot', 'team_royalty'] },
        created_at: { gte: cycleStart },
      },
      _sum: { amount: true },
    });

    const computed = agg._sum.amount != null ? Number(agg._sum.amount) : 0;

    // Only bump forward (never reduce) to avoid surprises; reset function already sets to 0 on new cycle.
    if (computed > used + 0.0001) {
      used = computed;
      await prisma.user_balances.upsert({
        where: { user_id: userId },
        create: { user_id: userId, spot_team_withdraw_used: computed },
        update: { spot_team_withdraw_used: computed, updated_at: new Date() },
      });
    }
  } catch (_) {
    // ignore backfill errors; fall back to stored used
  }
  const remaining = Math.max(0, limit - used);

  return {
    spot_team_withdraw_limit: limit,
    spot_team_withdraw_used: used,
    spot_team_withdraw_remaining: remaining,
    spot_team_withdraw_multiplier: multiplier,
  };
}

/**
 * Reset spot_team_withdraw_used to 0 for a user (call when package purchase/upgrade completes).
 * Starts a new 10x cycle.
 */
export async function resetSpotTeamWithdrawUsed(userId: bigint): Promise<void> {
  await prisma.user_balances.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      // All balance fields default to 0, updated_at defaults to now
      spot_team_withdraw_used: 0,
      spot_team_limit_reached_at: null,
      spot_team_flush_active: false,
    },
    update: {
      spot_team_withdraw_used: 0,
      spot_team_limit_reached_at: null,
      spot_team_flush_active: false,
      updated_at: new Date(),
    },
  });
}
