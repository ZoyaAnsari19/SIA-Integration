/**
 * Shared logic for renewal/upgrade via payment gateway.
 * Validates expired purchase and renewal window; executes same-package renewal or computes upgrade effective_global_ids.
 */
import { prisma } from '../config/prisma.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

const RENEWAL_WINDOW_DAYS = 65;

export type ExpiredPurchaseResult = {
  expiredPurchase: { id: bigint; user_id: bigint; package_id: number; purchased_at: Date; amount: unknown; income: unknown };
  previousPackageId: number;
};

/**
 * Find and validate expired purchase by previous_purchase_id. Throws with reply-friendly message if invalid.
 */
export async function findAndValidateExpiredPurchase(
  userId: bigint,
  previousPurchaseId: bigint
): Promise<ExpiredPurchaseResult> {
  const expiredPurchase = await prisma.purchases.findUnique({
    where: { id: previousPurchaseId },
  });
  if (!expiredPurchase) {
    throw new Error('EXPIRED_PURCHASE_NOT_FOUND');
  }
  if (expiredPurchase.user_id.toString() !== userId.toString()) {
    throw new Error('PREVIOUS_PURCHASE_NOT_OWNED');
  }
  const is2xReached = Number(expiredPurchase.income || 0) >= Number(expiredPurchase.amount) * 2;
  if (!is2xReached) {
    throw new Error('PREVIOUS_PURCHASE_NOT_EXPIRED');
  }
  return {
    expiredPurchase: expiredPurchase as ExpiredPurchaseResult['expiredPurchase'],
    previousPackageId: expiredPurchase.package_id,
  };
}

/**
 * Validate renewal window: asOfDate must be <= last_income_date + 65 days. Throws if expired.
 */
export async function validateRenewalWindow(
  previousPurchaseId: bigint,
  userId: bigint,
  asOfDate: Date
): Promise<void> {
  const lastIncomeDate = await CommissionService.getLastIncomeDate(previousPurchaseId, userId);
  if (!lastIncomeDate) {
    throw new Error('RENEWAL_WINDOW_UNKNOWN');
  }
  const lastIncomeDateUTC = new Date(Date.UTC(
    lastIncomeDate.getUTCFullYear(),
    lastIncomeDate.getUTCMonth(),
    lastIncomeDate.getUTCDate()
  ));
  const renewalDeadline = new Date(lastIncomeDateUTC);
  renewalDeadline.setUTCDate(renewalDeadline.getUTCDate() + RENEWAL_WINDOW_DAYS);
  renewalDeadline.setUTCHours(23, 59, 59, 999);
  const asOfStart = new Date(Date.UTC(
    asOfDate.getUTCFullYear(),
    asOfDate.getUTCMonth(),
    asOfDate.getUTCDate()
  ));
  if (asOfStart > renewalDeadline) {
    throw new Error('RENEWAL_WINDOW_EXPIRED');
  }
}

/**
 * Execute same-package renewal: update existing purchase (income=0, renewed_at, is_renewal, payment info).
 * @deprecated Prefer createRenewalAsNewRow so gateway history shows New / Reinvestment / Renewal as separate entries.
 */
export async function executeSamePackageRenewal(
  expiredPurchaseId: bigint,
  paymentInfo: { txn_id: string; payment_type: string }
): Promise<{ id: bigint }> {
  const renewedAt = new Date();
  const purchase = await prisma.purchases.update({
    where: { id: expiredPurchaseId },
    data: {
      income: 0,
      renewed_at: renewedAt,
      txn_id: paymentInfo.txn_id,
      payment_type: paymentInfo.payment_type,
      is_renewal: true,
    },
  });
  return { id: purchase.id };
}

/**
 * Same-package renewal as a NEW purchase row (like manual flow).
 * Keeps history correct: New Purchase, Reinvestment, and Renewal each show as separate entries in gateway history.
 */
export async function createRenewalAsNewRow(
  expiredPurchase: { id: bigint; user_id: bigint; package_id: number; course_id: string | null; purchase_type: string },
  intent: { amount: unknown; course_id: string | null },
  paymentInfo: { txn_id: string; payment_type: string; icici_txn_id?: string | null; icici_payment_id?: string | null }
): Promise<{ id: bigint }> {
  const amount = Number(intent.amount ?? 0);
  const purchase = await prisma.purchases.create({
    data: {
      user_id: expiredPurchase.user_id,
      package_id: expiredPurchase.package_id,
      course_id: intent.course_id ?? expiredPurchase.course_id,
      purchase_type: (expiredPurchase.purchase_type as any) || 'COURSE_PURCHASE',
      amount,
      status: 'completed',
      payment_type: paymentInfo.payment_type,
      is_manual: false,
      income: 0,
      is_renewal: true,
      previous_package_id: expiredPurchase.package_id,
      previous_purchase_id: expiredPurchase.id,
      txn_id: paymentInfo.txn_id,
      icici_txn_id: paymentInfo.icici_txn_id ?? null,
      icici_payment_id: paymentInfo.icici_payment_id ?? null,
    },
  });
  return { id: purchase.id };
}

/**
 * Compute effective_global_ids for upgrade: new_package_global_ids - used_ids_from_expired_package.
 */
export async function computeUpgradeEffectiveGlobalIds(
  expiredPurchase: { id: bigint; user_id: bigint; package_id: number; purchased_at: Date },
  newPackageId: number
): Promise<number> {
  const previousPackageId = expiredPurchase.package_id;
  const expiredPkg = await prisma.packages.findUnique({
    where: { id: previousPackageId },
    select: { global_ids: true },
  });
  const uniquePurchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: { gt: expiredPurchase.purchased_at },
      NOT: { user_id: expiredPurchase.user_id },
    },
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const usedIds = Math.min(uniquePurchases.length, expiredPkg?.global_ids || 0);
  const newPkg = await prisma.packages.findUnique({
    where: { id: newPackageId },
    select: { global_ids: true },
  });
  const newPackageGlobalIds = newPkg?.global_ids || 0;
  return Math.max(0, newPackageGlobalIds - usedIds);
}
