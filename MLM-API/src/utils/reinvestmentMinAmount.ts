import { prisma } from '../config/prisma.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export type MinReinvestmentReason =
  /** User has had at least one successful Main wallet withdrawal — no 50% minimum. */
  | 'has_main_withdrawal'
  /** User never withdrew from Main; min = 50% of largest active package amount. */
  | 'fifty_percent_never_main_withdraw'
  /** No active (sub-2x) purchase found — caller should block reinvestment before this. */
  | 'no_active_package';

export type MinReinvestmentResult = {
  minAmount: number;
  reason: MinReinvestmentReason;
  lastWithdrawalAmount?: number;
  /** Largest active purchase amount (not reached 2×) used for the 50% rule. */
  currentPackageAmount?: number;
};

/**
 * Successful Main wallet withdrawals: approved or processing (payout in progress / done).
 */
async function hasEverSuccessfulMainWalletWithdrawal(userId: bigint): Promise<boolean> {
  const row = await prisma.withdraw_requests.findFirst({
    where: {
      user_id: userId,
      withdraw_type: 'wallet',
      status: { in: ['approved', 'processing'] },
      amount: { gt: 0 },
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Largest `amount` among completed purchases that have not reached 2× income yet.
 * Matches business meaning of "current / bada active package" when multiple actives exist.
 */
async function getMaxActivePurchaseAmount(userId: bigint): Promise<number> {
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      status: 'completed',
    },
    select: {
      id: true,
      amount: true,
    },
  });

  let maxAmount = 0;
  for (const p of purchases) {
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as bigint);
    if (!isDoubleReached) {
      const amt = Number(p.amount);
      if (amt > maxAmount) maxAmount = amt;
    }
  }
  return maxAmount;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Minimum reinvestment when user never withdrew from Main wallet:
 * **50% of the largest current active package amount** (sub-2× purchases only).
 *
 * If the user has ever had a successful Main (`wallet`) withdrawal (approved/processing),
 * there is **no** minimum from this rule (`minAmount = 0`).
 */
export async function getMinReinvestmentAmount(userId: bigint): Promise<MinReinvestmentResult> {
  // Rule removed: reinvestment should never be blocked by a minimum amount.
  // Keep API contract stable by always returning minAmount = 0.
  void userId;
  return {
    minAmount: 0,
    reason: 'has_main_withdrawal',
  };
}

/** User-facing message when reinvestment is below minimum. */
export function getMinReinvestmentMessage(r: MinReinvestmentResult): string {
  if (r.reason === 'fifty_percent_never_main_withdraw' && r.minAmount > 0) {
    const pkg = r.currentPackageAmount != null ? r.currentPackageAmount.toFixed(2) : '—';
    return (
      `Reinvestment must be at least 50% of your current active package (minimum ₹${r.minAmount.toFixed(2)}). ` +
      `Your largest active package is ₹${pkg}. You have not completed a Main wallet withdrawal yet.`
    );
  }
  return `Reinvestment amount is below the required minimum.`;
}
