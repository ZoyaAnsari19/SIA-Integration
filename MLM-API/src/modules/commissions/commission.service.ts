import { prisma } from '../../config/prisma.js';
import { daysInMonth, addMonths } from '../../utils/dateUtils.js';
import { addLedgerAndWallet } from '../../utils/wallet.js';
import { isUserActive, getUplines, checkEligibility } from '../../utils/business.js';
import { newIdempotencyKey } from '../../utils/idempotency.js';
import { recomputeAllEligibility } from './eligibility.compute.js';
import { 
  rupeesToPaise, 
  paiseToRupees, 
  calculateDailyPaise,
  calculateCommissionPaise,
  multiplyPaise,
  formatPaise
} from '../../utils/paise.js';
import { getGlobalContributorWindowCounts } from '../../utils/global-helping-contributors.js';

export class CommissionService {
  // NOTE: ensureScheduledCommission() function removed (Dec 20, 2025)
  // All commissions (SELF, GLOBAL_HELPING, MONTHLY) are now processed dynamically
  // No need for scheduled_commissions table - all commissions are calculated on-the-fly

  static async handlePurchase(purchaseId: bigint) {
    console.log(`    💰 handlePurchase called for ID: ${purchaseId}`);
    const purchase = await prisma.purchases.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      console.log(`    ❌ Purchase not found: ${purchaseId}`);
      return { ok: false, message: 'Purchase not found' };
    }
    console.log(`    ✓ Purchase found:`, purchase);
    
    // Log if this is a renewal
    if ((purchase as any).is_renewal) {
      console.log(`    🔄 This is a RENEWAL purchase (previous_package_id: ${(purchase as any).previous_package_id || 'N/A'})`);
    }
    
    const pkg = await prisma.packages.findUnique({ where: { id: purchase.package_id } });
    if (!pkg) {
      console.log(`    ❌ Package not found: ${purchase.package_id}`);
      return { ok: false, message: 'Package not found' };
    }
    console.log(`    ✓ Package found:`, pkg);

    const buyerId = purchase.user_id as unknown as bigint;
    const referrer = await prisma.users.findUnique({ where: { id: purchase.user_id } }).then(async (u: { referrer_user_id: bigint | null } | null) => {
      if (!u?.referrer_user_id) return null;
      return prisma.users.findUnique({ where: { id: u.referrer_user_id } });
    });

    // For renewals, use renewed_at as start date; otherwise use purchased_at
    // This ensures new scheduled commissions start from renewal date, not original purchase date
    const startDate = (purchase as any).renewed_at 
      ? new Date((purchase as any).renewed_at) 
      : new Date(purchase.purchased_at);
    // For renewals, calculate end_date from renewed_at + validity_months; otherwise use purchased_at + validity_months
    // NOTE: end_date is just for reference - actual expiry is based on 2x income, NOT active_until date
    // active_until field is deprecated for logic - expiry is ONLY based on 2x income
    const endDate = (purchase as any).renewed_at && pkg.validity_months
      ? addMonths(new Date((purchase as any).renewed_at), pkg.validity_months)
      : (pkg.validity_months ? addMonths(new Date(purchase.purchased_at), pkg.validity_months) : new Date(purchase.purchased_at));
    // Use renewal date for daily amount calculation if renewed, otherwise use purchase date
    const purchaseDate = (purchase as any).renewed_at 
      ? new Date((purchase as any).renewed_at) 
      : new Date(purchase.purchased_at);

    // NOTE: SELF and GLOBAL_HELPING commissions are NO LONGER scheduled at purchase time
    // They are now processed directly by creditDailyCommissions() daily job (00:05 UTC)
    // This ensures ALL active purchases (old + new) get commissions automatically
    // Expiry is ONLY based on 2x income, not scheduled_commissions table
    if (pkg.self_roi_percent) {
      const selfMonthly = Number(pkg.price) * Number(pkg.self_roi_percent) / 100;
      console.log(`    ℹ️  SELF commission will be credited daily: ₹${selfMonthly}/month (${pkg.self_roi_percent}% of ₹${pkg.price})`);
      console.log(`    ℹ️  Daily job will process this purchase automatically starting tomorrow`);
    }

    if (pkg.global_ids) {
      console.log(`    ℹ️  GLOBAL_HELPING commission will be credited daily: ₹6.25/ID/month (package has ${pkg.global_ids} global IDs)`);
      console.log(`    ℹ️  Daily job will process this purchase automatically starting tomorrow`);
    }

    // 3) SPOT to direct referrer (Level 0) - Using levels table dynamically (Source of Truth)
    // RULE: SPOT commission only if referrer has at least one active course
    console.log(`    📍 Checking SPOT commission, referrer:`, referrer?.id);
    if (referrer) {
      // Check if referrer has at least one active course (not reached 2x)
      const referrerHasActive = await CommissionService.hasActiveCourse(
        referrer.id as unknown as bigint,
        new Date()
      );
      
      if (!referrerHasActive) {
        console.log(`    ⛔ Referrer ${referrer.id} has no active course. Skipping SPOT commission. All courses reached 2x investment.`);
      } else {
        // Use package's direct_spot_percent (Field Worker - Level 0 SPOT commission)
        // ONLY use package setting - no fallback to levels table
        let spotPercent: number;
        if (pkg.direct_spot_percent) {
          spotPercent = Number(pkg.direct_spot_percent);
        } else {
          // No commission if package doesn't have direct_spot_percent set
          console.log(`    ⚠️ Package ${pkg.id} (${pkg.name}) has no direct_spot_percent set. Skipping SPOT commission.`);
          spotPercent = 0; // No commission if not set in package
        }

        // Calculate SPOT using paise arithmetic with dynamic percentage
        const spotPaise = calculateCommissionPaise(Number(purchase.amount), spotPercent);
        const amount = paiseToRupees(spotPaise);
        console.log(`    💵 SPOT amount: ${formatPaise(spotPaise)} (${spotPercent}% of ₹${purchase.amount})`);
        console.log(`    ✅ Exact paise: ${spotPaise} paise = ₹${amount}`);

        const idk = newIdempotencyKey(`spot:${purchase.id}:${referrer.id}`);
        // Only check if referrer is active (buyer check removed - buyer might not have active course yet on first purchase)
        // Direct SPOT commission only requires referrer to have active course
        const rcvActive = await isUserActive(referrer.id as unknown as bigint);
        console.log(`    ✓ Active check - Referrer: ${rcvActive}`);
        if (rcvActive) {
          console.log(`    💳 Creating SPOT ledger entry...`);
          await addLedgerAndWallet({
            receiverId: referrer.id as unknown as bigint,
            sourceId: buyerId,
            purchaseId: purchase.id as unknown as bigint,
            amount,
            type: 'SPOT',
            metadata: { level: 0, depth: 1 }, // Level 0 (Direct) = Depth 1
            idempotencyKey: idk,
          });
          console.log(`    ✅ SPOT commission credited to ${referrer.id}`);
        } else {
          console.log(`    ⚠️ SPOT not credited - referrer inactive`);
        }
      }
    } else {
      console.log(`    ⚠️ No referrer found for buyer ${buyerId}`);
    }

    // 4) MONTHLY commission to direct referrer (Level 0)
    // NOTE: MONTHLY commissions are NO LONGER scheduled at purchase time
    // They are now processed directly by creditDailyCommissions() daily job (00:05 UTC)
    // This ensures ALL active purchases (old + new) get MONTHLY commissions automatically
    // Use ONLY package's direct_monthly_royalty_percent (no fallback)
    const monthlyPercent = pkg.direct_monthly_royalty_percent 
      ? Number(pkg.direct_monthly_royalty_percent)
      : null;
    
    if (referrer && monthlyPercent) {
      const monthlyPaise = calculateCommissionPaise(Number(purchase.amount), monthlyPercent);
      const monthly = paiseToRupees(monthlyPaise);
      console.log(`    ℹ️  MONTHLY commission will be credited daily: ₹${monthly}/month (${monthlyPercent}% of ₹${purchase.amount})`);
      console.log(`    ℹ️  Daily job will process this purchase automatically starting tomorrow`);
    } else if (referrer && !monthlyPercent) {
      console.log(`    ⚠️ Package ${pkg.id} (${pkg.name}) has no direct_monthly_royalty_percent set. No MONTHLY commission will be credited.`);
    }

    // 5) 9-level traversal: team SPOT and recurring per rules → if eligible credit/schedule else pending
    // Check if this is a reinvestment (for Level 2+ SPOT reduction)
    const isReinvestment = await CommissionService.isReinvestment(purchase.id as unknown as bigint, buyerId);
    
    // Get buyer's referrer info to check if buyer is in disqualified user's new chain
    const buyer = await prisma.users.findUnique({
      where: { id: buyerId },
      select: { referrer_user_id: true, created_at: true },
    });

    // Check if buyer is in a disqualified user's new chain
    let buyerInNewChain = false;
    let disqualifiedReferrerId: bigint | null = null;
    if (buyer?.referrer_user_id) {
      const buyerReferrer = await prisma.users.findUnique({
        where: { id: buyer.referrer_user_id },
        select: { id: true, is_disqualified: true, disqualified_at: true },
      });
      
      if (buyerReferrer?.is_disqualified && buyerReferrer.disqualified_at && buyer.created_at > buyerReferrer.disqualified_at) {
        buyerInNewChain = true;
        disqualifiedReferrerId = buyer.referrer_user_id;
        console.log(`    🔗 Buyer ${buyerId} is in disqualified user ${buyerReferrer.id}'s new chain (added after ${buyerReferrer.disqualified_at.toISOString().split('T')[0]})`);
      }
    }

    const uplines = await getUplines(buyerId, 9);
    
    // Filter uplines: exclude disqualified users and ancestors of disqualified referrer when buyer is in new chain
    const activeUplines = [];
    for (const { ancestor_id, depth } of uplines) {
      // skip direct self (depth 0) and direct referrer case (depth 1) already covered for SPOT/MONTHLY direct
      // Direct referrer SPOT is handled separately above (lines 115-155)
      // NOTE: Direct referrer (Level 1) does NOT check disqualification - A2 will get Level 1 SPOT from A7 even if disqualified
      if (depth <= 1) continue;

      // Skip if upline is disqualified
      const user = await prisma.users.findUnique({ 
        where: { id: ancestor_id },
        select: { is_disqualified: true },
      });
      if (user?.is_disqualified) {
        console.log(`    ⛔ Skipping disqualified upline ${ancestor_id} at depth ${depth}`);
        continue;
      }
      
      // If buyer is in disqualified user's new chain, skip uplines that are ancestors of disqualified referrer
      // This ensures A1 does NOT get commission from A7 (A2's new chain)
      if (buyerInNewChain && disqualifiedReferrerId) {
        // Check if this upline is an ancestor of the disqualified referrer
        const isAncestorOfDisqualified = await prisma.user_tree_paths.findFirst({
          where: {
            ancestor_id: ancestor_id,
            descendant_id: disqualifiedReferrerId,
          },
        });
        
        // If upline is ancestor of disqualified referrer, skip (A1 shouldn't get from A7)
        if (isAncestorOfDisqualified) {
          console.log(`    ⛔ Skipping upline ${ancestor_id} at depth ${depth} - buyer is in disqualified user's new chain`);
          continue;
        }
      }
      
      activeUplines.push({ ancestor_id, depth });
    }
    
    // CRITICAL: Recalculate eligibility BEFORE checking it to ensure fresh data
    // This ensures that the new purchase is included in eligibility calculations
    // before we check if uplines are eligible for commissions
    console.log(`    🔄 Recalculating eligibility BEFORE commission checks to ensure fresh data...`);
    try {
      await recomputeAllEligibility();
      console.log(`    ✅ Eligibility recalculated, now checking commissions with fresh data`);
    } catch (error) {
      console.error(`    ⚠️ Error recalculating eligibility before commission checks:`, error);
      // Continue processing even if eligibility recalculation fails
      // The old eligibility data will be used as fallback
    }
    
    for (const { ancestor_id, depth } of activeUplines) {
      // Map depth to level: depth 2 → level 1, depth 3 → level 2, etc.
      // Level 0 (depth 1) is handled separately above (direct referrer gets 5% SPOT)
      // Formula: level = depth - 1 (for depth >= 2)
      const levelForCommission = depth - 1;
      
      const eligible = await checkEligibility(ancestor_id, levelForCommission);
      
      // MONTHLY commission based on levels table (monthly_royalty_percent) - Source of Truth
      // Fallback to 0.5% (0.005) if levels table doesn't have the percentage
      const levelDataForMonthly = await prisma.levels.findUnique({ where: { level: levelForCommission } });
      const monthlyPercent = levelDataForMonthly?.monthly_royalty_percent 
        ? Number(levelDataForMonthly.monthly_royalty_percent) / 100 
        : 0.005; // Default 0.5% if not found
      const monthly = Number(purchase.amount) * monthlyPercent;

      // Team SPOT based on levels table (spot_commission_percent) - Source of Truth
      // Fallback to commission_rules if levels table doesn't have the percentage
      // RULE: Level SPOT commission only if upline has at least one active course
      const levelData = await prisma.levels.findUnique({ where: { level: levelForCommission } });
      let spotPercent = 0;
      
      if (levelData?.spot_commission_percent) {
        // Primary source: levels table
        spotPercent = Number(levelData.spot_commission_percent);
      } else {
        // Fallback: commission_rules table
        const spotRule = await prisma.commission_rules.findFirst({ where: { type: 'LEVEL_SPOT', level: levelForCommission } });
        spotPercent = Number(spotRule?.percent ?? 0);
      }
      
      let teamSpotAmount = (Number(purchase.amount) * spotPercent) / 100;
      
      // Apply 50% reduction for Level 1+ (depth 2+) on reinvestments
      // Level 0 (depth 1, direct referrer) always gets 100% - handled separately above
      if (isReinvestment && depth >= 2) {
        teamSpotAmount = teamSpotAmount * 0.5; // 50% reduction for Level 1+ (depth 2+) on reinvestments
        console.log(`    🔄 Reinvestment detected: Level ${levelForCommission} (depth ${depth}) SPOT reduced to 50%: ₹${teamSpotAmount.toFixed(2)} (was ₹${(teamSpotAmount * 2).toFixed(2)})`);
      }
      
      if (teamSpotAmount > 0 && eligible) {
        // Check if upline has at least one active course (not reached 2x)
        const uplineHasActive = await CommissionService.hasActiveCourse(
          ancestor_id as unknown as bigint,
          new Date()
        );
        
        if (!uplineHasActive) {
          console.log(`    ⛔ Upline ${ancestor_id} (depth ${depth}, level ${levelForCommission}) has no active course. Skipping level SPOT commission.`);
        } else {
          const idk = newIdempotencyKey(`teamspot:${depth}:${purchase.id}:${ancestor_id.toString()}`);
          // Only check if receiver is active (buyer check removed - buyer might not have active course yet on first purchase)
          // Team SPOT commission only requires receiver to have active course
          const rcvActive = await isUserActive(ancestor_id as unknown as bigint);
          console.log(`    ✓ Active check - Receiver (Upline): ${rcvActive}`);
          if (rcvActive) {
            await addLedgerAndWallet({
              receiverId: ancestor_id as unknown as bigint,
              sourceId: buyerId,
              purchaseId: purchase.id as unknown as bigint,
              amount: teamSpotAmount,
              type: 'SPOT',
              metadata: { level: levelForCommission, depth: depth, is_reinvestment: isReinvestment },
              idempotencyKey: idk,
            });
            console.log(`    ✅ Team SPOT commission credited to ${ancestor_id} (Level ${levelForCommission})`);
          } else {
            console.log(`    ⚠️ Team SPOT not credited - receiver (upline) inactive`);
          }
        }
      } else if (teamSpotAmount > 0 && !eligible) {
        await prisma.pending_commissions.create({
          data: {
            receiver_user_id: ancestor_id,
            source_user_id: buyerId,
            purchase_id: purchase.id,
            level: levelForCommission,
            commission_type: 'SPOT',
            amount: teamSpotAmount,
            metadata: { level: levelForCommission, depth: depth, reason: 'eligibility', is_reinvestment: isReinvestment },
          },
        });
      }
      // NOTE: MONTHLY commissions are NOT scheduled or held during purchase processing.
      // They will be scheduled when the upline achieves level eligibility (see recalculateEligibility).
    }

    // After purchase processing, synchronously recalculate eligibility to release pending SPOT
    // This second recalculation is needed to:
    // 1. Release any pending SPOT commissions that became eligible due to this purchase
    // 2. Ensure eligibility is up-to-date for any subsequent operations
    // SPOT should be released immediately when qualification happens, not via PgBoss
    // PgBoss is only for MONTHLY recurring commissions
    console.log(`    🔄 Recalculating eligibility AFTER commission processing to release pending SPOT...`);
    try {
      await CommissionService.recalculateEligibility();
      console.log(`    ✅ Eligibility recalculated, pending SPOT released instantly`);
    } catch (error) {
      console.error(`    ⚠️ Error recalculating eligibility:`, error);
      // Don't fail the purchase if eligibility recalculation fails
    }

    return { ok: true };
  }

  /**
   * Check if a purchase has reached 2x investment (SELF + GLOBAL_HELPING >= 2x purchase amount)
   * Returns true if 2x reached, false otherwise
   * 
   * IMPORTANT: Only SELF + GLOBAL_HELPING commissions count towards 2x check
   * SPOT and MONTHLY commissions are NOT included in this calculation
   */
  static async isPurchaseDoubleReached(purchaseId: bigint): Promise<boolean> {
    const purchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
      // NOTE: We MUST include `income` here, otherwise currentIncome will always be 0
      // and 2x expiry will never trigger. `income` column exists in DB but may not be
      // present in the generated Prisma client types, so we cast to `any`.
      select: { amount: true, income: true } as any,
    });
    if (!purchase) return false;

    const investmentAmount = Number(purchase.amount);
    const doubleAmount = investmentAmount * 2;

    // Use income column for 2x check (faster and more accurate)
    // income column tracks SELF + GLOBAL_HELPING commissions only
    const currentIncome = Number((purchase as any).income || 0);
    const isReached = currentIncome >= doubleAmount;
    
    if (isReached) {
      console.log(`    📊 Purchase ${purchaseId}: Invested ₹${investmentAmount}, Income: ₹${currentIncome.toFixed(2)}, Double: ₹${doubleAmount.toFixed(2)} - REACHED`);
      
      // Purchase reached 2x - expiry is based on 2x income, not active_until
      // NOTE: active_until removed - we don't update it anymore
      console.log(`    ✅ Purchase ${purchaseId} reached 2x income (expired)`);
    }
    
    return isReached;
  }

  /**
   * Check if user has at least one active course (not reached 2x investment)
   * Active course = total_earned < 2x investment (date doesn't matter, only 2x matters)
   */
  static async hasActiveCourse(userId: bigint, today: Date): Promise<boolean> {
    // Get all completed purchases (ignore active_until date - expiry is only based on 2x)
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        status: 'completed',
        // Removed: active_until check - expiry is ONLY based on 2x, not date
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

  /**
   * Get user's last expired or 2x reached purchase (for renewal detection)
   */
  static async getLastExpiredOr2xPurchase(userId: bigint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        status: 'completed',
      },
      orderBy: { purchased_at: 'desc' },
      select: {
        id: true,
        purchased_at: true,
        // active_until removed - expiry is ONLY based on 2x income
      },
    });
    
    for (const purchase of purchases) {
      // Expiry is based on 2x income (self + global), NOT active_until date
      const is2xReached = await CommissionService.isPurchaseDoubleReached(
        purchase.id as unknown as bigint
      );
      
      if (is2xReached) {
        return purchase;
      }
    }
    
    return null;
  }

  /**
   * Check if this purchase is a renewal (user has expired or 2x reached purchase)
   */
  static async checkIfRenewal(userId: bigint): Promise<{ isRenewal: boolean; previousPurchase: any | null }> {
    const previousPurchase = await CommissionService.getLastExpiredOr2xPurchase(userId);
    return {
      isRenewal: previousPurchase !== null,
      previousPurchase,
    };
  }

  /**
   * Check if a purchase is a reinvestment (user has at least 1 active purchase before this purchase)
   * Reinvestment = user has at least 1 active purchase (not reached 2x) that was purchased BEFORE current purchase
   */
  private static async isReinvestment(purchaseId: bigint, userId: bigint): Promise<boolean> {
    const currentPurchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
      select: { purchased_at: true, is_renewal: true },
    });
    
    if (!currentPurchase) return false;

    // IMPORTANT: Renewals are NEVER reinvestments - they should be treated as first purchase (100% commission)
    // Renewal = user renews after package reached 2x or expired
    // According to business rules: Renewal after 2x/expiry is NOT a reinvestment - treated as first purchase
    if (currentPurchase.is_renewal) {
      return false; // Renewal is NOT reinvestment - always 100% commission
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all purchases that were purchased BEFORE current purchase
    // NOTE: active_until is NOT used for filtering - expiry is ONLY based on 2x income
    const previousPurchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        status: 'completed',
        purchased_at: { lt: currentPurchase.purchased_at }, // Purchased before current purchase
      },
      select: {
        id: true,
        purchased_at: true,
        // active_until removed - expiry is ONLY based on 2x income
      },
    });

    // Check if any previous purchase has not reached 2x (active = not reached 2x)
    for (const purchase of previousPurchases) {
      const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
      if (!isDoubleReached) {
        return true; // Found at least one active course before current purchase = reinvestment
      }
    }

    return false; // No active course found before current purchase = first purchase
  }

  /**
   * Reinvestment SELF + GLOBAL lock: from purchase date
   * Day 0–90 → 90 day lock (hold_until = purchase + 90), stage 1
   * Day 91–150 → 60 day extra (hold_until = purchase + 150), stage 2
   * Day 151–180 → 30 day extra (hold_until = purchase + 180), stage 3
   * Day 180+ → no lock
   */
  private static getReinvestmentLockHoldUntil(purchaseDate: Date, creditDate: Date): { hold_until: string; reinvestment_lock_stage: number } | null {
    const purchase = new Date(purchaseDate);
    purchase.setHours(0, 0, 0, 0);
    const credit = new Date(creditDate);
    credit.setHours(0, 0, 0, 0);
    const dayDiff = Math.floor((credit.getTime() - purchase.getTime()) / (24 * 60 * 60 * 1000));
    const addDays = (d: Date, days: number) => {
      const x = new Date(d);
      x.setDate(x.getDate() + days);
      return x.toISOString().slice(0, 10);
    };
    if (dayDiff <= 90) return { hold_until: addDays(purchase, 90), reinvestment_lock_stage: 1 };
    if (dayDiff <= 150) return { hold_until: addDays(purchase, 150), reinvestment_lock_stage: 2 };
    if (dayDiff <= 180) return { hold_until: addDays(purchase, 180), reinvestment_lock_stage: 3 };
    return null;
  }

  /**
   * Processes daily commissions for TODAY (current date).
   * Runs daily at 00:05 UTC (5:35 AM IST) as per project-understanding.md
   * 
   * NEW APPROACH: Directly processes ALL active purchases (not reached 2x)
   * No longer depends on scheduled_commissions table for SELF and GLOBAL_HELPING
   * 
   * IMPORTANT BUSINESS RULES:
   * 1. SELF + GLOBAL_HELPING: Stop when purchase reaches 2x investment
   * 2. SPOT + MONTHLY + Level commissions: Stop when user has NO active course (all reached 2x)
   * 3. Active course = total_earned < 2x investment (expiry is ONLY based on 2x, NOT active_until date)
   */
  static async creditDailyCommissions() {
    // "today" = date part (for month/day calculations)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    
    // Get today's month days for accurate calculation
    const daysInTodayMonth = daysInMonth(today);
    const isLastDayOfMonth = today.getDate() === new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Get ALL active purchases (not reached 2x investment)
    // This ensures both old and new purchases are processed automatically
    const allPurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
      },
      select: {
        id: true,
        user_id: true,
        package_id: true,
        amount: true,
        purchased_at: true,
        status: true,
        income: true, // CRITICAL: Must include income to check 2x expiry
        is_manual: true, // CRITICAL: For manual assignment / admin assignment check
        effective_global_ids: true, // CRITICAL: For initial used IDs in manual assignments
        is_renewal: true, // CRITICAL: For renewal logic
        previous_package_id: true, // CRITICAL: For upgrade logic
        payment_type: true, // CRITICAL: To distinguish true admin assignments from legacy/manual data
      } as any, // Include income, is_renewal, etc. (exist in DB but not in Prisma schema)
    });

    // Filter purchases that haven't reached 2x and fetch their packages
    const eligiblePurchases: Array<{
      purchase: typeof allPurchases[0];
      package: Awaited<ReturnType<typeof prisma.packages.findUnique>>;
    }> = [];

    for (const purchase of allPurchases) {
      const investmentAmount = Number(purchase.amount);
      const doubleAmount = investmentAmount * 2;
      const currentIncome = Number((purchase as any).income || 0);
      
      // Only process if not reached 2x
      if (currentIncome < doubleAmount) {
        // Fetch package separately (no relation in Prisma schema)
        const pkg = await prisma.packages.findUnique({
          where: { id: purchase.package_id },
          select: {
            id: true,
            price: true,
            self_roi_percent: true,
            global_ids: true,
          },
      });

        if (!pkg) continue;

        eligiblePurchases.push({
          purchase,
          package: pkg as any, // Type assertion for partial select
        });
      }
    }

    console.log(`📊 Found ${eligiblePurchases.length} active purchases (not reached 2x)`);

    let creditedCount = 0;
    let skippedCount = 0;

    for (const { purchase, package: pkg } of eligiblePurchases) {
      const userId = purchase.user_id as unknown as bigint;
      const purchaseId = purchase.id as unknown as bigint;

      // Check if user is disqualified
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { is_disqualified: true },
      });
      if (user?.is_disqualified) {
        skippedCount++;
        continue;
      }

      // Check if user is active (has at least one active course)
      const userActive = await isUserActive(userId);
      if (!userActive) {
        skippedCount++;
        continue;
      }

      // Double-check 2x (in case it was reached between query and now)
      const investmentAmount = Number(purchase.amount);
      const doubleAmount = investmentAmount * 2;
      const currentIncome = Number((purchase as any).income || 0);
      if (currentIncome >= doubleAmount) {
        skippedCount++;
        continue;
      }

      // Process SELF commission if package has self_roi_percent
      // NOTE: After SELF commission is credited, purchase.income is updated in database
      // We need to track if income was updated so we can re-fetch it before MONTHLY check
      let selfIncomeCredited = false;
      if (pkg && pkg.self_roi_percent && Number(pkg.self_roi_percent) > 0) {
        const selfMonthly = Number(pkg.price) * Number(pkg.self_roi_percent) / 100;
        const { dailyPaise, remainderPaise } = calculateDailyPaise(selfMonthly, daysInTodayMonth);
        
        let selfAmount: number;
        if (isLastDayOfMonth && remainderPaise > 0n) {
          selfAmount = paiseToRupees(dailyPaise + remainderPaise);
        } else {
          selfAmount = paiseToRupees(dailyPaise);
        }

        if (selfAmount > 0) {
          // Fixed idempotency key: daily:self:{purchaseId}:{date}
          // This ensures same purchase on same date only credits once
          const selfIdk = `daily:self:${purchaseId}:${today.toISOString().slice(0, 10)}`;
          
          // Check if already credited (idempotency)
          const existingSelf = await prisma.ledger_entries.findFirst({
            where: { idempotency_key: selfIdk },
          });

          if (!existingSelf) {
            const isReinvestmentSelf = await CommissionService.isReinvestment(purchaseId, userId);
            const purchaseDateSelf = new Date(purchase.purchased_at);
            const creditDateSelf = new Date();
            const lockSelf = isReinvestmentSelf ? CommissionService.getReinvestmentLockHoldUntil(purchaseDateSelf, creditDateSelf) : null;
            const selfMetadata: Record<string, unknown> = lockSelf
              ? { is_reinvestment: true, hold_until: lockSelf.hold_until, reinvestment_lock_stage: lockSelf.reinvestment_lock_stage }
              : {};
            await addLedgerAndWallet({
              receiverId: userId,
              sourceId: userId,
              purchaseId: purchaseId,
              amount: selfAmount,
              type: 'SELF',
              metadata: selfMetadata,
              idempotencyKey: selfIdk,
              creditedAt: new Date(), // Use current time, not midnight
            });

            // Update purchase income for 2x tracking
            // IMPORTANT: This updates purchase.income in database, but the cached 'purchase' object
            // still has the old income value. We need to re-fetch it before MONTHLY check.
            await prisma.purchases.update({
              where: { id: purchaseId },
              data: { income: { increment: selfAmount } } as any,
            });

            selfIncomeCredited = true; // Mark that income was updated
            creditedCount++;
            console.log(`    ✅ SELF: Purchase ${purchaseId}, User ${userId}, Amount: ₹${selfAmount.toFixed(2)}`);
          }
        }
      }

      // Process GLOBAL_HELPING commission if package has global_ids
      // NOTE: After GLOBAL_HELPING commission is credited, purchase.income is updated in database
      // We need to track if income was updated so we can re-fetch it before MONTHLY check
      let globalIncomeCredited = false;
      if (pkg && pkg.global_ids && Number(pkg.global_ids) > 0) {
        const GLOBAL_MONTHLY_PER_ID = 6.25; // Fixed constant
        const { dailyPaise: perIdDailyPaise, remainderPaise: perIdRemainderPaise } = 
          calculateDailyPaise(GLOBAL_MONTHLY_PER_ID, daysInTodayMonth);
        
        // Calculate used IDs (same logic as before)
        let packageCap = Number(pkg.global_ids) || 0;
        let usedIds = 0;

        // Determine start date for counting
        let startDate: Date;
        if ((purchase as any).is_renewal && (purchase as any).previous_package_id) {
          // Renewal: Count from FIRST purchase of same package type
          const firstPurchase = await prisma.purchases.findFirst({
            where: {
              user_id: userId,
              package_id: (purchase as any).previous_package_id,
              status: 'completed',
            },
            orderBy: { purchased_at: 'asc' },
            select: { purchased_at: true },
          });
          startDate = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase.purchased_at);
        } else {
          // First purchase: Use THIS purchase's date
          startDate = new Date(purchase.purchased_at);
        }
        
        const nowForQuery = new Date();
        nowForQuery.setHours(23, 59, 59, 999);

        /**
         * IMPORTANT:
         * Not every `is_manual = true` purchase is an "admin assigned" package.
         *
         * Historical / migrated data also used `is_manual` + `effective_global_ids`
         * for bookkeeping, but business rules say:
         *
         *   👉 Daily GLOBAL_HELPING should ONLY treat `effective_global_ids`
         *      as initial used IDs for:
         *        - Admin UI assigned packages
         *        - Genuine upgrades (handled separately below)
         *
         * Admin-assigned packages can be reliably detected via
         * `payment_type = 'admin_assignment'` (and UTR / TXNADMIN in UI).
         *
         * For all other manual/migrated purchases we MUST fall back to
         * pure dynamic calculation to avoid sudden jumps (like SIA00635, SIA00424).
         */
        const isAdminAssignment =
          (purchase as any).is_manual &&
          (purchase as any).payment_type === 'admin_assignment' &&
          (purchase as any).effective_global_ids !== null &&
          (purchase as any).effective_global_ids > 0;

        const isUpgrade =
          (purchase as any).is_renewal &&
          (purchase as any).previous_package_id !== null &&
          (purchase as any).previous_package_id !== (purchase as any).package_id &&
          (purchase as any).effective_global_ids !== null &&
          (purchase as any).effective_global_ids > 0;

        /** After windowStart: raw = all first joiners; active = joiners whose qualifying first purchase is still < 2× */
        let globalContributorsRaw = 0;
        let globalContributorsActive = 0;

        if (isUpgrade) {
          // Upgrade: count only users whose first purchase after UPGRADE date is still active (< 2×)
          const remainingIds = Number((purchase as any).effective_global_ids);
          packageCap = Number(pkg.global_ids) || 0;
          const initialUsedIds = Math.max(0, packageCap - remainingIds);

          const upgradeDate = new Date(purchase.purchased_at);
          const upgradeCounts = await getGlobalContributorWindowCounts(
            userId,
            upgradeDate,
            nowForQuery,
          );
          globalContributorsRaw = upgradeCounts.rawDistinct;
          globalContributorsActive = upgradeCounts.activeDistinct;

          const totalUsed = initialUsedIds + globalContributorsActive;
          usedIds = Math.min(totalUsed, packageCap); // Cap at new package's cap

          console.log(
            `[CommissionService] Upgrade (FIXED): remaining_ids=${remainingIds}, initial_used=${initialUsedIds}, new_users_after_upgrade_active=${globalContributorsActive}, new_users_after_upgrade_raw=${globalContributorsRaw}, total=${totalUsed}, used_ids=${usedIds}, package_cap=${packageCap}`,
          );
        } else {
          const baseCounts = await getGlobalContributorWindowCounts(userId, startDate, nowForQuery);
          globalContributorsRaw = baseCounts.rawDistinct;
          globalContributorsActive = baseCounts.activeDistinct;

          if (isAdminAssignment) {
            // Admin assignment: effective_global_ids = initial used IDs (before purchase)
            // Add new users who joined AFTER purchase date (manual + dynamic) — active only for payout
            const initialUsed = Number((purchase as any).effective_global_ids);
            const totalUsed = initialUsed + globalContributorsActive;
            usedIds = Math.min(totalUsed, packageCap);

            console.log(
              `[CommissionService] Admin assignment: initial_used=${initialUsed}, new_users_after_active=${globalContributorsActive}, new_users_after_raw=${globalContributorsRaw}, total=${totalUsed}, used_ids=${usedIds}, package_cap=${packageCap}`,
            );
          } else {
            // Normal / legacy dynamic calculation:
            // - For non-manual, non-upgrade purchases we IGNORE effective_global_ids
            //   for commission calculation to avoid over-counting migrated data.
            usedIds = Math.min(globalContributorsActive, packageCap);
          }
        }

        // Safety check: Ensure packageCap is a valid positive number
        if (!packageCap || packageCap <= 0 || isNaN(packageCap)) {
          packageCap = Number(pkg.global_ids) || 0;
        }
        if (!packageCap || packageCap <= 0 || isNaN(packageCap)) {
          // If still invalid, skip GLOBAL_HELPING calculation for this purchase
          console.warn(`⚠️ Invalid packageCap for purchase ${purchaseId}, user ${userId}, skipping GLOBAL_HELPING`);
          continue;
        }
            
        // Calculate total using PAISE arithmetic
        const totalDailyPaise = perIdDailyPaise * BigInt(usedIds);
        
        let globalAmount: number;
        if (isLastDayOfMonth && perIdRemainderPaise > 0n) {
          const totalRemainderPaise = perIdRemainderPaise * BigInt(usedIds);
          globalAmount = paiseToRupees(totalDailyPaise + totalRemainderPaise);
            } else {
          globalAmount = paiseToRupees(totalDailyPaise);
        }

        if (globalAmount > 0) {
          // Fixed idempotency key: daily:global:{purchaseId}:{date}
          // This ensures same purchase on same date only credits once
          const globalIdk = `daily:global:${purchaseId}:${today.toISOString().slice(0, 10)}`;
          
          // Check if already credited (idempotency)
          const existingGlobal = await prisma.ledger_entries.findFirst({
            where: { idempotency_key: globalIdk },
          });

          if (!existingGlobal) {
            const isReinvestmentGlobal = await CommissionService.isReinvestment(purchaseId, userId);
            const purchaseDateGlobal = new Date(purchase.purchased_at);
            const creditDateGlobal = new Date();
            const lockGlobal = isReinvestmentGlobal ? CommissionService.getReinvestmentLockHoldUntil(purchaseDateGlobal, creditDateGlobal) : null;
            const globalMetadata: Record<string, unknown> = {
              used_ids: usedIds,
              package_cap: packageCap,
              global_contributors_raw: globalContributorsRaw,
              global_contributors_active: globalContributorsActive,
              ...(lockGlobal ? { is_reinvestment: true, hold_until: lockGlobal.hold_until, reinvestment_lock_stage: lockGlobal.reinvestment_lock_stage } : {}),
            };
            await addLedgerAndWallet({
              receiverId: userId,
              sourceId: userId,
              purchaseId: purchaseId,
              amount: globalAmount,
              type: 'GLOBAL_HELPING',
              metadata: globalMetadata,
              idempotencyKey: globalIdk,
              creditedAt: new Date(), // Use current time, not midnight
            });

            // Update purchase income for 2x tracking
            // IMPORTANT: This updates purchase.income in database, but the cached 'purchase' object
            // still has the old income value. We need to re-fetch it before MONTHLY check.
            await prisma.purchases.update({
              where: { id: purchaseId },
              data: { income: { increment: globalAmount } } as any,
            });

            globalIncomeCredited = true; // Mark that income was updated
            creditedCount++;
            console.log(`    ✅ GLOBAL_HELPING: Purchase ${purchaseId}, User ${userId}, Used IDs: ${usedIds}, Amount: ₹${globalAmount.toFixed(2)}`);
            }
          }
        }
        
      // CRITICAL FIX: Re-fetch purchase income from database before MONTHLY commission check
      // WHY: SELF and GLOBAL_HELPING commissions update purchase.income in database, but the cached
      // 'purchase' object still has the old income value. If a purchase was at 1.95x before SELF/GLOBAL,
      // and after SELF/GLOBAL it reaches 2x, the MONTHLY check would still see 1.95x and incorrectly
      // credit MONTHLY commissions to expired packages. This bug allows expired packages to receive
      // income they shouldn't get. By re-fetching the updated income, we ensure MONTHLY commissions
      // are only credited for active purchases (not reached 2x).
      let updatedPurchaseIncome = Number((purchase as any).income || 0);
      if (selfIncomeCredited || globalIncomeCredited) {
        // Re-fetch purchase from database to get updated income value
        const updatedPurchase = await prisma.purchases.findUnique({
          where: { id: purchaseId },
          select: { income: true } as any,
        });
        if (updatedPurchase) {
          updatedPurchaseIncome = Number((updatedPurchase as any).income || 0);
          console.log(`    🔄 Re-fetched purchase income: ₹${updatedPurchaseIncome.toFixed(2)} (was ₹${Number((purchase as any).income || 0).toFixed(2)})`);
        }
      }
        
      // Process MONTHLY commissions dynamically (NEW APPROACH - Dec 20, 2025)
      // For each purchase, find all eligible uplines and credit MONTHLY commission
      const buyerId = userId;
        
      // Get all uplines (Level 0-9, depth 1-10)
      const uplines = await getUplines(buyerId, 9);
      
      for (const { ancestor_id, depth } of uplines) {
        const level = depth - 1; // depth 1 → level 0, depth 2 → level 1, etc.
        const uplineId = ancestor_id as unknown as bigint;
        
        // Check if upline is disqualified
        const upline = await prisma.users.findUnique({
          where: { id: uplineId },
          select: { is_disqualified: true },
        });
        if (upline?.is_disqualified) continue;
        
        // FIX: Level 0 (Direct Referrer) Eligibility Check
        // Level 0 (direct referrer) is ALWAYS eligible - no need to check database
        // Level 1-9 require eligibility check from level_eligibility table
        // Reason: Direct referrers don't need to qualify for any level - they automatically get Level 0 commission
        // Issue: Previously, Level 0 was also checked for eligibility, causing many users to be skipped
        // Solution: Skip eligibility check for Level 0, always return true
        const eligible = level === 0 ? true : await checkEligibility(uplineId, level);
        if (!eligible) continue;
        
        // Check if upline is active (has at least one active course)
        const uplineActive = await isUserActive(uplineId);
        if (!uplineActive) continue;
        
        // Check if buyer is active (has at least one active course)
        const buyerActive = await isUserActive(buyerId);
        if (!buyerActive) continue;
        
        // CRITICAL FIX: Use updated purchase income (re-fetched after SELF/GLOBAL_HELPING)
        // WHY: We must use the updated income value that includes SELF and GLOBAL_HELPING commissions
        // credited earlier in this loop. Using the old cached value would allow expired packages
        // (reached 2x) to still receive MONTHLY commissions, which is incorrect.
        const purchaseIncome = updatedPurchaseIncome; // Use re-fetched income, not cached value
        const purchaseAmount = Number(purchase.amount);
        if (purchaseIncome >= purchaseAmount * 2) {
          console.log(`    ⛔ Skipping MONTHLY: Purchase ${purchaseId} reached 2x (Income: ₹${purchaseIncome.toFixed(2)}, 2x: ₹${(purchaseAmount * 2).toFixed(2)})`);
          continue;
        }
        
        // FIX: Level 0 (Direct Referrer) Monthly Royalty Percentage
        // Level 0 should use package's direct_monthly_royalty_percent (or recurring_rate_percent as fallback)
        // Level 1-9 should use levels.monthly_royalty_percent (from levels table)
        // Reason: As per screenshot and business logic, direct referrers get monthly royalty based on package sold:
        //   - ₹2,500 to ₹3 lakh packages: 0.50% monthly royalty
        //   - ₹5 lakh to ₹23 lakh packages: 1% monthly royalty
        // For Level 0, use ONLY package's direct_monthly_royalty_percent (no fallback)
        let monthlyPercent: number;
        if (level === 0) {
          // Level 0 (Direct Referrer): Use ONLY package's direct_monthly_royalty_percent
          // NO fallback - must be set in package settings
          const pkg = await prisma.packages.findUnique({ 
            where: { id: purchase.package_id } 
          });
          if (pkg?.direct_monthly_royalty_percent) {
            monthlyPercent = Number(pkg.direct_monthly_royalty_percent) / 100;
          } else {
            // No commission if package doesn't have direct_monthly_royalty_percent set
            console.log(`    ⚠️ Package ${pkg?.id} has no direct_monthly_royalty_percent set. Skipping MONTHLY commission.`);
            monthlyPercent = 0; // No commission if not set in package
          }
        } else {
          // Level 1-9 (Team Levels): Use levels table monthly_royalty_percent
          const levelData = await prisma.levels.findUnique({ where: { level } });
          monthlyPercent = levelData?.monthly_royalty_percent 
            ? Number(levelData.monthly_royalty_percent) / 100 
            : 0.005; // Default 0.5% if not found
        }
        
        let monthly = purchaseAmount * monthlyPercent;
        
        // Check if this purchase is a reinvestment (for 50% reduction on Level 1+)
        const isReinvestment = await CommissionService.isReinvestment(
          purchaseId,
          buyerId
        );
        
        // Level 0 (direct referrer) always gets 100%, Level 1+ get 50% on reinvestments
        if (isReinvestment && level >= 1) {
          monthly = monthly * 0.5; // 50% reduction
        }
        
        // Calculate daily amount
        const { dailyPaise, remainderPaise } = calculateDailyPaise(monthly, daysInTodayMonth);
        let dailyAmount: number;
        if (isLastDayOfMonth && remainderPaise > 0n) {
          dailyAmount = paiseToRupees(dailyPaise + remainderPaise);
        } else {
          dailyAmount = paiseToRupees(dailyPaise);
        }
        
        if (dailyAmount > 0) {
          // Fixed idempotency key: daily:monthly:{purchaseId}:{uplineId}:{level}:{date}
          // This ensures same purchase, same upline, same level, same date only credits once
          const monthlyIdk = `daily:monthly:${purchaseId}:${uplineId}:${level}:${today.toISOString().slice(0, 10)}`;
          
          // Check if already credited (idempotency)
          const existingMonthly = await prisma.ledger_entries.findFirst({
            where: { idempotency_key: monthlyIdk },
          });
          
          if (!existingMonthly) {
      await addLedgerAndWallet({
              receiverId: uplineId,
              sourceId: buyerId,
              purchaseId: purchaseId,
              amount: dailyAmount,
              type: 'MONTHLY',
              metadata: { 
                level, 
                is_reinvestment: isReinvestment,
                credited_by_daily_job: true,
                date: today.toISOString().slice(0, 10)
              },
              idempotencyKey: monthlyIdk,
              creditedAt: new Date(), // Use current time, not midnight
            });
            
            creditedCount++;
            console.log(`    ✅ MONTHLY: Purchase ${purchaseId}, Upline ${uplineId} (Level ${level}), Amount: ₹${dailyAmount.toFixed(2)}`);
            }
          }
      }
    }

    console.log(`📊 Daily commission summary: ${creditedCount} credited, ${skippedCount} skipped`);
    return { count: creditedCount };
  }

  static async recalculateEligibility() {
    // Get old eligibility before recomputing to detect newly qualified levels
    const oldEligRows = await prisma.level_eligibility.findMany();
    const oldEligMap = new Map<bigint, Record<string, boolean>>();
    for (const row of oldEligRows) {
      oldEligMap.set(row.user_id as unknown as bigint, row.eligibility as Record<string, boolean>);
    }

    // Recompute eligibility
    await recomputeAllEligibility();
    
    const eligRows = await prisma.level_eligibility.findMany();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const e of eligRows) {
      const newEligMap = e.eligibility as Record<string, boolean>;
      const userId = e.user_id as unknown as bigint;
      const oldEligMapForUser = oldEligMap.get(userId) || {};
      // Qualification date is NOW (when recalculateEligibility is called and level qualifies)
      // This ensures SPOT is credited on the exact date/time when qualification happens
      const qualificationDate = new Date();

      // 1. Release SPOT commissions from pending (only SPOT, not MONTHLY)
      const pending = await prisma.pending_commissions.findMany({ 
        where: { 
          receiver_user_id: userId,
          commission_type: 'SPOT' // Only process SPOT commissions
        } 
      });
      
      for (const p of pending) {
        const lvl = String(p.level);
        if (!newEligMap[lvl]) continue; // Still not eligible
        const srcActive = await isUserActive(p.source_user_id as unknown as bigint);
        const rcvActive = await isUserActive(userId);
        if (!srcActive || !rcvActive) continue;
        const idk = newIdempotencyKey(`pending:${p.id}`);
        
        // The pending commission amount is already stored with 50% reduction if it was a reinvestment
        // (see handlePurchase where we apply the reduction before creating pending_commissions)
        // So we just use the stored amount directly
        const metadata = p.metadata as any || {};
        const isReinvestment = metadata.is_reinvestment === true;
        const spotAmount = Number(p.amount);
        
        if (isReinvestment && Number(lvl) >= 1) {
          console.log(`    🔄 Releasing pending SPOT from reinvestment: Level ${lvl} (depth ${Number(lvl) + 1}), Amount: ₹${spotAmount.toFixed(2)} (already reduced to 50%)`);
        }
        
        // Credit SPOT on qualification date - same day and time as when level qualifies
        await addLedgerAndWallet({
          receiverId: p.receiver_user_id as unknown as bigint,
          sourceId: p.source_user_id as unknown as bigint,
          purchaseId: p.purchase_id as unknown as bigint,
          amount: spotAmount,
          type: 'SPOT',
          metadata: { ...metadata, level: Number(lvl) },
          idempotencyKey: idk,
          creditedAt: qualificationDate, // Use current time (qualification date)
        });
        await prisma.pending_commissions.delete({ where: { id: p.id } });
      }

      // 2. MONTHLY commissions are NO LONGER scheduled here
      // NOTE: MONTHLY commissions are now processed dynamically by creditDailyCommissions() daily job
      // This ensures ALL active purchases (old + new) get MONTHLY commissions automatically
      // No need to schedule MONTHLY commissions - they are calculated on-the-fly each day
    }
    return { ok: true };
  }

  /**
   * Get the last income date for a purchase (used for renewal window validation)
   * Returns the date when SELF or GLOBAL_HELPING income was last credited to this purchase
   * Uses SAME logic as API's calculateRenewalCountdown for consistency
   * If no income exists, returns the purchase date
   */
  static async getLastIncomeDate(purchaseId: bigint, userId?: bigint): Promise<Date | null> {
    try {
      // Get the purchase to find user_id if not provided
      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
        select: { 
          user_id: true,
          purchased_at: true,
        },
      });

      if (!purchase) {
        return null;
      }

      const actualUserId = userId || purchase.user_id;

      // IMPORTANT: Use SAME logic as API's calculateRenewalCountdown
      // Find last SELF + GLOBAL_HELPING income from ledger_entries (NOT commissions table)
      const lastIncomeEntry = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchaseId,
          receiver_user_id: actualUserId,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }, // ← MUST MATCH API
        },
        orderBy: { credited_at: 'desc' },
        select: { credited_at: true },
      });

      if (lastIncomeEntry && lastIncomeEntry.credited_at) {
        return new Date(lastIncomeEntry.credited_at);
      }

      // Fallback: return purchase date as the initial income date
      return new Date(purchase.purchased_at);
    } catch (error) {
      console.error(`Error getting last income date for purchase ${purchaseId}:`, error);
      return null;
    }
  }
}
