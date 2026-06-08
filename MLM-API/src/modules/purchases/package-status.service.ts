import { prisma } from '../../config/prisma.js';
import { daysInMonth } from '../../utils/dateUtils.js';
import { getGlobalContributorWindowCounts } from '../../utils/global-helping-contributors.js';

export interface GlobalIdsInfo {
  package_cap: number;
  used_ids: number;
  remaining_ids: number;
  is_cap_reached: boolean;
  new_ids_after_cap: number | null;
  cap_exceed_loss: number | null; // Monetary loss for IDs that joined after cap (₹)
  total_global_users: number; // Total global users (cap + exceeded)
  /** Distinct first-purchasers in the counting window (same window as daily GLOBAL_HELPING) */
  contributors_raw_in_window: number;
  /** Those whose qualifying first purchase in the window still has income < 2× (counted for payout) */
  contributors_active_in_window: number;
  /** raw − active: joined in window but first purchase already reached 2× (not in daily global payout) */
  inactive_global_contributors: number;
}

export interface DailyLossBreakdown {
  day: number;
  date: string;
  self_income: number;
  monthly_royalty: number;
  spot_income: number;
  total: number;
}

export interface ExpiryLossInfo {
  total_loss: number;
  days_since_expiry: number;
  daily_breakdown: DailyLossBreakdown[];
}

export interface RenewalCountdown {
  last_income_date: string | null; // ISO date string
  renewal_deadline: string; // ISO date string
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total_seconds: number;
  };
  can_renew: boolean;
}

export class PackageStatusService {
  /**
   * Calculate global IDs information for a purchase
   * Shows remaining IDs, used IDs, and if cap is reached, how many new IDs joined after cap
   */
  static async calculateGlobalIdsInfo(
    purchaseId: bigint,
    userId: bigint
  ): Promise<GlobalIdsInfo | null> {
    try {
      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
        select: {
          effective_global_ids: true,
          package_id: true,
          // active_until removed - expiry is ONLY based on 2x income
          status: true,
          purchased_at: true,
          is_renewal: true,
          previous_package_id: true,
          is_manual: true, // Check if manually assigned by admin
          payment_type: true, // Only use effective_global_ids when payment_type === 'admin_assignment'
        } as any,
      });

      if (!purchase) {
        console.log(`[PackageStatusService] Purchase ${purchaseId} not found`);
        return null;
      }
      
      console.log(`[PackageStatusService] Purchase found:`, {
        id: purchaseId.toString(),
        status: purchase.status,
        // active_until removed - expiry is ONLY based on 2x income
        package_id: purchase.package_id
      });

      // Check if purchase is active (status completed AND not reached 2x)
      // Expiry is based on 2x, not active_until date
      const purchaseFor2xCheck = await prisma.purchases.findUnique({
        where: { id: purchaseId },
        select: { amount: true, income: true },
      });
      
      if (!purchaseFor2xCheck) {
        console.log(`[PackageStatusService] Purchase ${purchaseId} not found for 2x check`);
        return null;
      }
      
      const isActive = purchase.status === 'completed' && 
        Number(purchaseFor2xCheck.income || 0) < Number(purchaseFor2xCheck.amount) * 2;
      
      console.log(`[PackageStatusService] isActive check (2x-based):`, {
        status: purchase.status,
        income: Number(purchaseFor2xCheck.income || 0),
        amount: Number(purchaseFor2xCheck.amount),
        target_2x: Number(purchaseFor2xCheck.amount) * 2,
        isActive
      });
      
      if (!isActive) {
        console.log(`[PackageStatusService] Purchase not active (reached 2x or not completed), returning null`);
        return null;
      }

      // Get package to find global_ids cap
      const pkg = await prisma.packages.findUnique({
        where: { id: purchase.package_id },
        select: { global_ids: true },
      });

      if (!pkg) {
        console.log(`[PackageStatusService] Package ${purchase.package_id} not found`);
        return null;
      }

      // Package cap is ALWAYS package.global_ids (the maximum available)
      const packageCap = pkg.global_ids !== null && pkg.global_ids !== undefined 
        ? pkg.global_ids 
        : 0;

      // effective_global_ids interpretation:
      // For upgrades/renewals: effective_global_ids = REMAINING IDs (new_package_ids - used_from_old)
      // For new purchases: effective_global_ids = null (calculate dynamically)
      const effectiveGlobalIds = purchase.effective_global_ids !== null && purchase.effective_global_ids !== undefined 
        ? purchase.effective_global_ids 
        : null;

      console.log(`[PackageStatusService] Package cap calculation:`, {
        effective_global_ids: purchase.effective_global_ids,
        package_global_ids: pkg.global_ids,
        packageCap,
        is_renewal: purchase.is_renewal,
        previous_package_id: purchase.previous_package_id,
      });

      if (packageCap === 0) {
        console.log(`[PackageStatusService] Package cap is 0, returning zero result`);
        return {
          package_cap: 0,
          used_ids: 0,
          remaining_ids: 0,
          is_cap_reached: false,
          new_ids_after_cap: null,
          cap_exceed_loss: null,
          total_global_users: 0,
          contributors_raw_in_window: 0,
          contributors_active_in_window: 0,
          inactive_global_contributors: 0,
        };
      }

      // Calculate used_ids and remaining_ids
      let usedIds: number;
      let globalUsersCount: number = 0;
      let contributorsRawInWindow = 0;
      let contributorsActiveInWindow = 0;

      // Check if this is same package renewal or upgrade
      // Same package renewal: is_renewal=true AND (previous_package_id=package_id OR previous_package_id IS NULL)
      // Upgrade: is_renewal=true AND previous_package_id != package_id AND previous_package_id IS NOT NULL
      const isSamePackageRenewal = purchase.is_renewal && 
        (purchase.previous_package_id === null || purchase.previous_package_id === purchase.package_id);
      const isUpgrade = purchase.is_renewal && 
        purchase.previous_package_id !== null && 
        purchase.previous_package_id !== purchase.package_id;

      // For UPGRADE: effective_global_ids = REMAINING IDs (new_package - used_from_old)
      if (isUpgrade && effectiveGlobalIds !== null && effectiveGlobalIds >= 0) {
        // BUG FIX: Upgrade should add NEW users who joined AFTER upgrade date
        // effective_global_ids = remaining IDs (for upgrades)
        // So: initial_used_ids = package_cap - effective_global_ids (used from old package)
        const initialUsedIds = Math.max(0, packageCap - effectiveGlobalIds);
        
        // Count NEW users who joined AFTER upgrade date
        const upgradeDate = new Date(purchase.purchased_at);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const upgradeCounts = await getGlobalContributorWindowCounts(userId, upgradeDate, today);
        const newUsersActive = upgradeCounts.activeDistinct;
        const newUsersRaw = upgradeCounts.rawDistinct;
        contributorsRawInWindow = newUsersRaw;
        contributorsActiveInWindow = newUsersActive;
        // Total raw joiners (for cap / loss); payout-aligned used_ids uses active joiners only
        globalUsersCount = initialUsedIds + newUsersRaw;
        const totalUsedActive = initialUsedIds + newUsersActive;
        usedIds = Math.min(totalUsedActive, packageCap); // Cap at new package's cap
        
        console.log(`[PackageStatusService] Upgrade (FIXED): effective_global_ids=${effectiveGlobalIds} (remaining), initial_used=${initialUsedIds}, new_users_after_upgrade_active=${newUsersActive}, new_users_after_upgrade_raw=${newUsersRaw}, used_ids=${usedIds}, package_cap=${packageCap}`);
      } else if (isSamePackageRenewal) {
        // SAME PACKAGE RENEWAL: Global IDs continue from where they were
        // effective_global_ids might be set, but we need to calculate from original purchase date
        // Count global users from FIRST purchase of this package (not renewal date)
        const firstPurchase = await prisma.purchases.findFirst({
          where: {
            user_id: userId,
            package_id: purchase.package_id,
            status: 'completed',
          },
          orderBy: { purchased_at: 'asc' },
          select: { purchased_at: true },
        });
        const startDate = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase.purchased_at);
        
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const renewalCounts = await getGlobalContributorWindowCounts(userId, startDate, today);
        contributorsRawInWindow = renewalCounts.rawDistinct;
        contributorsActiveInWindow = renewalCounts.activeDistinct;
        globalUsersCount = renewalCounts.rawDistinct;
        usedIds = Math.min(renewalCounts.activeDistinct, packageCap);
        console.log(`[PackageStatusService] Same Package Renewal: Global IDs continue from first purchase (${startDate.toISOString()}), raw=${globalUsersCount}, active_used=${usedIds}, package_cap=${packageCap}`);
      } else if (effectiveGlobalIds !== null && effectiveGlobalIds > 0 && purchase.is_manual && (purchase as any).payment_type === 'admin_assignment') {
        // ONLY genuine admin assignment: use effective_global_ids + new users (matches CommissionService)
        // Legacy/migration (is_manual but payment_type !== 'admin_assignment') → fall through to pure dynamic below
        const startDate = new Date(purchase.purchased_at);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const adminCounts = await getGlobalContributorWindowCounts(userId, startDate, today);
        contributorsRawInWindow = adminCounts.rawDistinct;
        contributorsActiveInWindow = adminCounts.activeDistinct;
        globalUsersCount = effectiveGlobalIds + adminCounts.rawDistinct;
        usedIds = Math.min(effectiveGlobalIds + adminCounts.activeDistinct, packageCap);
        console.log(`[PackageStatusService] Admin assignment: initial_used=${effectiveGlobalIds}, new_users_after_raw=${adminCounts.rawDistinct}, new_users_after_active=${adminCounts.activeDistinct}, used_ids=${usedIds}`);
      } else {
        // Calculate from actual global users (for new purchases without migration data)
        // For renewals: Count from FIRST purchase of same package (previous_package_id)
        // For first purchase: Count from THIS purchase date (only users who joined AFTER this package was purchased)
        // IMPORTANT: Each package counts only users who joined AFTER that specific package was purchased
        let startDate: Date;
        
        if (purchase.is_renewal && purchase.previous_package_id) {
          // Renewal: Find the FIRST purchase of this package type for this user
          // Global IDs continue from where they were, so count from first purchase date
          const firstPurchase = await prisma.purchases.findFirst({
            where: {
              user_id: userId,
              package_id: purchase.previous_package_id,
              status: 'completed',
            },
            orderBy: { purchased_at: 'asc' },
            select: { purchased_at: true },
          });
          startDate = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase.purchased_at);
        } else {
          // First purchase: Use THIS purchase's date
          // Each package counts only users who joined AFTER that specific package was purchased
          // This ensures Basic Package (Dec 4) only counts users who joined after Dec 4, not Dec 3
          startDate = new Date(purchase.purchased_at);
        }
        
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Count UNIQUE users who made their FIRST purchase (not renewal) of ANY package AFTER the start date
        // Rules:
        // 1. Count unique users (not purchases) - 1 user = 1 count only
        // 2. Count only FIRST purchase (is_renewal = false) - renewals don't count
        // 3. Count ALL packages (any package purchase counts for all active packages)
        // 4. Exclude self (userId)
        const dynamicCounts = await getGlobalContributorWindowCounts(userId, startDate, today);
        contributorsRawInWindow = dynamicCounts.rawDistinct;
        contributorsActiveInWindow = dynamicCounts.activeDistinct;
        globalUsersCount = dynamicCounts.rawDistinct;
        console.log(`[PackageStatusService] Global users count (from start date ${startDate.toISOString()}): raw=${globalUsersCount}, active=${dynamicCounts.activeDistinct}`);

        // Payout-aligned used IDs (active contributors only), capped at package cap
        usedIds = Math.min(dynamicCounts.activeDistinct, packageCap);
      }

      const remainingIds = Math.max(0, packageCap - usedIds);
      // Cap "full" is based on raw joiners (who took slots), not active-only payout bar
      const isCapReached = globalUsersCount >= packageCap;

      // If cap is reached, find how many new IDs joined after cap was full (these are losses)
      // BUT: For same package renewal, don't show "missed IDs" - it's expected that cap is full
      let newIdsAfterCap: number | null = null;
      let capExceedLoss: number | null = null;
      
      console.log(`[PackageStatusService] Cap calculation check:`, {
        isCapReached,
        isSamePackageRenewal,
        globalUsersCount,
        packageCap,
        usedIds,
        willCalculateNewIds: isCapReached && !isSamePackageRenewal
      });
      
      if (isCapReached && !isSamePackageRenewal) {
        // Total global users minus cap = new IDs after cap (loss)
        // Only show for upgrades/new purchases, not same package renewals
        newIdsAfterCap = Math.max(0, globalUsersCount - packageCap);
        
        console.log(`[PackageStatusService] Calculated new_ids_after_cap:`, {
          globalUsersCount,
          packageCap,
          newIdsAfterCap,
          calculation: `${globalUsersCount} - ${packageCap} = ${globalUsersCount - packageCap}`
        });
        
        // Calculate monetary loss for IDs that joined after cap
        // Loss = new_ids_after_cap * GLOBAL_MONTHLY_PER_ID * (days since cap exceeded / days in current month)
        if (newIdsAfterCap > 0 && effectiveGlobalIds === null) {
          // Only calculate loss if we're using dynamic calculation (not migrated data)
          const GLOBAL_MONTHLY_PER_ID = 6.25; // ₹6.25 per ID per month
          
          // Find when cap was exceeded (when the (cap+1)th unique user joined)
          // Get the purchase date of the first user that exceeded the cap
          // Count unique users (first purchases only), not renewals
          let startDateForCap: Date;
          if (purchase.is_renewal && purchase.previous_package_id) {
            const firstPurchase = await prisma.purchases.findFirst({
              where: {
                user_id: userId,
                package_id: purchase.previous_package_id,
                status: 'completed',
              },
              orderBy: { purchased_at: 'asc' },
              select: { purchased_at: true },
            });
            startDateForCap = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase.purchased_at);
          } else {
            startDateForCap = new Date(purchase.purchased_at);
          }
          
          const todayForCap = new Date();
          todayForCap.setHours(23, 59, 59, 999);
          
          const uniqueFirstPurchasesForCap = await prisma.purchases.findMany({
            where: {
              // Removed package_id filter - count ALL packages
              status: 'completed',
              is_renewal: false, // Only count first purchases, not renewals
              purchased_at: { 
                gt: startDateForCap,
                lte: todayForCap 
              },
              NOT: { user_id: userId },
            },
            select: {
              user_id: true,
              purchased_at: true,
            },
            orderBy: { purchased_at: 'asc' },
            distinct: ['user_id'], // Get unique users only
          });
          
          // Get the (cap+1)th user's purchase date
          const firstExceededPurchase = uniqueFirstPurchasesForCap.length > packageCap
            ? { purchased_at: uniqueFirstPurchasesForCap[packageCap].purchased_at }
            : null;
          
          // If we found when cap was exceeded, use that date; otherwise use purchase date as fallback
          const capExceededDate = firstExceededPurchase 
            ? new Date(firstExceededPurchase.purchased_at)
            : new Date(purchase.purchased_at);
          
          // Calculate days since cap was exceeded
          const daysSinceCapExceeded = Math.max(1, Math.floor(
            (todayForCap.getTime() - capExceededDate.getTime()) / (1000 * 60 * 60 * 24)
          ));
          
          // Get days in current month
          const daysInCurrentMonth = daysInMonth(todayForCap);
          
          // Calculate daily rate per ID
          const dailyPerId = GLOBAL_MONTHLY_PER_ID / daysInCurrentMonth;
          
          // Total loss = new_ids_after_cap * daily_per_id * days_since_cap_exceeded
          capExceedLoss = newIdsAfterCap * dailyPerId * daysSinceCapExceeded;
        }
      }

      const inactiveGlobalContributors = Math.max(0, contributorsRawInWindow - contributorsActiveInWindow);

      // Convert BigInt values to numbers for JSON serialization
      const result = {
        package_cap: Number(packageCap),
        used_ids: Number(usedIds),
        remaining_ids: Number(remainingIds),
        is_cap_reached: isCapReached,
        new_ids_after_cap: newIdsAfterCap !== null ? Number(newIdsAfterCap) : null,
        cap_exceed_loss: capExceedLoss !== null ? Number(capExceedLoss.toFixed(2)) : null,
        total_global_users: Number(globalUsersCount), // Total including exceeded
        contributors_raw_in_window: contributorsRawInWindow,
        contributors_active_in_window: contributorsActiveInWindow,
        inactive_global_contributors: inactiveGlobalContributors,
      };
      
      console.log(`[PackageStatusService] Final result calculation:`, {
        purchaseId: purchaseId.toString(),
        userId: userId.toString(),
        packageCap,
        globalUsersCount,
        usedIds,
        isCapReached,
        isSamePackageRenewal,
        newIdsAfterCap,
        calculation: `globalUsersCount (${globalUsersCount}) - packageCap (${packageCap}) = ${globalUsersCount - packageCap}`,
        result: JSON.stringify(result, null, 2)
      });
      
      return result;
    } catch (error) {
      console.error(`[PackageStatusService] Error in calculateGlobalIdsInfo:`, error);
      if (error instanceof Error) {
        console.error(`[PackageStatusService] Error stack:`, error.stack);
      }
      return null;
    }
  }

  /**
   * Calculate expired package loss (day-wise breakdown)
   * Shows potential income lost (SELF + MONTHLY + SPOT) for up to 20 days after expiry
   */
  static async calculateExpiryLoss(
    purchaseId: bigint,
    userId: bigint,
    maxDays: number = 20
  ): Promise<ExpiryLossInfo | null> {
    // Validate maxDays parameter
    if (maxDays <= 0 || maxDays > 365) {
      console.warn(`[PackageStatusService] Invalid maxDays: ${maxDays}, using default 20`);
      maxDays = 20;
    }
    
    const purchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
      select: {
        // active_until removed - expiry is ONLY based on 2x income
        package_id: true,
        status: true,
        amount: true,
        income: true,
        purchased_at: true,
      },
    });

    if (!purchase) return null;

    // Check if purchase is expired (status completed AND reached 2x)
    // Expiry is based on 2x income, not date
    const isExpired = purchase.status === 'completed' && 
      Number(purchase.income || 0) >= Number(purchase.amount) * 2;

    if (!isExpired) {
      return null;
    }

    // Expiry is 2x-based, not date-based
    // Since we don't track exact 2x date, use purchased_at as reference
    // NOTE: This is an approximation - actual expiry happened when 2x was reached
    // TODO: Consider adding reached_2x_at field if exact expiry date needed
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Use purchased_at as expiry date reference (approximation)
    const expiryDate = new Date(purchase.purchased_at);
    expiryDate.setHours(0, 0, 0, 0);

    const daysSinceExpiry = Math.floor(
      (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // For 2x-based expiry, daysSinceExpiry is approximate
    // If negative (future date), don't show loss
    if (daysSinceExpiry < 0) return null;

    // Calculate days to show (at least 1 day if expired today)
    const daysToCalculate = Math.min(maxDays, Math.max(1, daysSinceExpiry + 1));

    // Get package details
    const pkg = await prisma.packages.findUnique({
      where: { id: purchase.package_id },
      select: {
        price: true,
        self_roi_percent: true,
        recurring_rate_percent: true,
      },
    });

    if (!pkg) return null;

    // Get downline IDs (all descendants)
    const downlinePaths = await prisma.user_tree_paths.findMany({
      where: { ancestor_id: userId, depth: { gte: 1 } },
      select: { descendant_id: true },
    });
    const downlineIds = downlinePaths.map(
      (p) => p.descendant_id as unknown as bigint
    );

    const dailyBreakdown: DailyLossBreakdown[] = [];
    let totalLoss = 0;

    // Pre-fetch all downline purchases for performance (include income for 2x check)
    const allDownlinePurchases = downlineIds.length > 0
      ? await prisma.purchases.findMany({
          where: {
            user_id: { in: downlineIds },
            status: 'completed',
          },
          select: {
            id: true,
            user_id: true,
            package_id: true,
            amount: true,
            income: true,
            purchased_at: true,
            // active_until removed - expiry is ONLY based on 2x income
          },
        })
      : [];

    // Pre-fetch all packages for SPOT calculation
    const allPackages = await prisma.packages.findMany({
      select: {
        id: true,
        recurring_rate_percent: true,
      },
    });
    const packageMap = new Map(
      allPackages.map((p) => [p.id, p.recurring_rate_percent])
    );

    // Get levels for SPOT and MONTHLY calculation
    const levels = await prisma.levels.findMany({
      select: {
        level: true,
        spot_commission_percent: true,
        monthly_royalty_percent: true,
      },
    });
    const levelSpotMap = new Map(
      levels.map((l) => [l.level, l.spot_commission_percent])
    );
    const levelMonthlyMap = new Map(
      levels.map((l) => [l.level, l.monthly_royalty_percent])
    );

    // Get user tree paths for downline levels (with depth)
    const downlineLevelMap = new Map<bigint, number>();
    const downlinePathsWithDepth = await prisma.user_tree_paths.findMany({
      where: { ancestor_id: userId, depth: { gte: 1 } },
      select: { descendant_id: true, depth: true },
    });
    for (const path of downlinePathsWithDepth) {
      downlineLevelMap.set(
        path.descendant_id as unknown as bigint,
        path.depth
      );
    }

    for (let day = 1; day <= daysToCalculate; day++) {
      const targetDate = new Date(expiryDate);
      targetDate.setDate(targetDate.getDate() + day);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // SELF income (calculate dynamically from self_roi_percent)
      const daysInTargetMonth = daysInMonth(targetDate);
      const selfMonthly = pkg.self_roi_percent && Number(pkg.self_roi_percent) > 0
        ? Number(pkg.price) * Number(pkg.self_roi_percent) / 100
        : 0;
      const selfDaily = selfMonthly > 0
        ? selfMonthly / daysInTargetMonth
          : 0;

      // MONTHLY royalty (from active downline on that date)
      // MONTHLY is calculated based on level's monthly_royalty_percent, not package's recurring_rate_percent
      let monthlyRoyalty = 0;
      for (const downlinePurchase of allDownlinePurchases) {
        const purchaseDate = new Date(downlinePurchase.purchased_at);
        purchaseDate.setHours(0, 0, 0, 0);

        // Check if this downline purchase was active on targetDate
        // Active = purchased before/on targetDate AND not reached 2x (expiry is based on 2x, not active_until)
        const isDownlineActive = purchaseDate <= targetDate && 
          Number(downlinePurchase.income || 0) < Number(downlinePurchase.amount) * 2;
        
        if (isDownlineActive) {
          // Get depth for this downline to determine commission level
          const depth = downlineLevelMap.get(
            downlinePurchase.user_id as unknown as bigint
          );
          if (depth !== undefined && depth >= 1 && depth <= 10) {
            // depth=1 is Level 0 (direct) - uses package.recurring_rate_percent
            // depth=2-10 are Level 1-9 (team) - uses levels.monthly_royalty_percent
            let monthlyPercent = 0;
            if (depth === 1) {
              // Direct referrer: use package's recurring_rate_percent
              const recurringRate = packageMap.get(downlinePurchase.package_id);
              monthlyPercent = recurringRate ? Number(recurringRate) : 0;
            } else if (depth >= 2 && depth <= 10) {
              // Team levels: use levels table monthly_royalty_percent
              // monthly_royalty_percent is stored as percentage (e.g., 0.30 for 0.30%)
              const commissionLevel = depth - 1; // Convert depth to commission level
              const levelMonthlyData = levelMonthlyMap.get(commissionLevel);
              // Use directly as percentage (0.30 means 0.30%)
              monthlyPercent = levelMonthlyData
                ? Number(levelMonthlyData)
                : 0.5; // Default 0.5% if not found
            }

            if (monthlyPercent > 0) {
              // Ensure amount is positive (protect against corrupted data)
              const amount = Math.max(0, Number(downlinePurchase.amount));
              const monthlyAmount = (amount * monthlyPercent) / 100;
              monthlyRoyalty += monthlyAmount / daysInTargetMonth;
            }
          }
        }
      }

      // SPOT income (new purchases by downline on that date)
      let spotIncome = 0;
      for (const downlinePurchase of allDownlinePurchases) {
        const purchaseDate = new Date(downlinePurchase.purchased_at);
        purchaseDate.setHours(0, 0, 0, 0);

        // Check if this purchase was made on targetDate
        if (
          purchaseDate.getTime() >= targetDate.getTime() &&
          purchaseDate.getTime() < nextDay.getTime()
        ) {
          // Get depth for this downline (how many levels down from the expired user)
          const depth = downlineLevelMap.get(
            downlinePurchase.user_id as unknown as bigint
          );
          // Only process up to depth 10 (9 commission levels)
          if (depth !== undefined && depth >= 1 && depth <= 10) {
            // depth=1 is Level 0 (direct referrer) - gets 5% fixed
            // depth=2-10 are Level 1-9 (team levels) - get from levels table
            let spotPercent = 0;
            if (depth === 1) {
              // Direct referrer (Level 0) - always 5%
              spotPercent = 5.0;
            } else if (depth >= 2 && depth <= 10) {
              // Team levels: depth=2 → level=1, depth=3 → level=2, etc.
              const commissionLevel = depth - 1; // Convert depth to commission level
              const levelData = levelSpotMap.get(commissionLevel);
              spotPercent = levelData ? Number(levelData) : 0;
            }

            if (spotPercent > 0) {
              // Ensure amount is positive (protect against corrupted data)
              const amount = Math.max(0, Number(downlinePurchase.amount));
              spotIncome += (amount * spotPercent) / 100;
            }
          }
        }
      }

      const dayTotal = selfDaily + monthlyRoyalty + spotIncome;
      totalLoss += dayTotal;

      dailyBreakdown.push({
        day,
        date: targetDate.toISOString().split('T')[0],
        self_income: Number(selfDaily.toFixed(2)),
        monthly_royalty: Number(monthlyRoyalty.toFixed(2)),
        spot_income: Number(spotIncome.toFixed(2)),
        total: Number(dayTotal.toFixed(2)),
      });
    }

    return {
      total_loss: Number(totalLoss.toFixed(2)),
      days_since_expiry: daysSinceExpiry,
      daily_breakdown: dailyBreakdown,
    };
  }

  /**
   * Calculate renewal countdown for expired packages
   * Countdown starts from last SELF + GLOBAL_HELPING income date + 65 days (extended from 30 days)
   * 
   * IMPORTANT: Returns FIXED renewal_deadline that never changes across browsers/sessions.
   * Frontend MUST calculate real-time countdown from renewal_deadline using client time:
   *   countdown = renewal_deadline - client_current_time
   * 
   * This ensures countdown is consistent and real-time across all browsers/devices.
   */
  static async calculateRenewalCountdown(
    purchaseId: bigint,
    userId: bigint
  ): Promise<RenewalCountdown | null> {
    try {
      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
        select: {
          amount: true,
          income: true,
          status: true,
          purchased_at: true,
        },
      });

      if (!purchase) {
        return null;
      }

      // Check if purchase is expired (status completed AND reached 2x)
      const isExpired = purchase.status === 'completed' && 
        Number(purchase.income || 0) >= Number(purchase.amount) * 2;

      if (!isExpired) {
        return null; // Only calculate for expired packages
      }

      // Find last SELF + GLOBAL_HELPING income date for this purchase
      const lastIncomeEntry = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchaseId,
          receiver_user_id: userId,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
        },
        orderBy: { credited_at: 'desc' },
        select: { credited_at: true },
      });

      const now = new Date();
      let lastIncomeDate: Date | null = null;
      let renewalDeadline: Date;

      if (lastIncomeEntry && lastIncomeEntry.credited_at) {
        // Use last income date + 65 days (extended from 30 days for all users)
        // IMPORTANT: Use UTC dates to match admin approval validation logic
        lastIncomeDate = new Date(lastIncomeEntry.credited_at);
        const lastIncomeDateUTC = new Date(Date.UTC(
          lastIncomeDate.getUTCFullYear(),
          lastIncomeDate.getUTCMonth(),
          lastIncomeDate.getUTCDate()
        ));
        renewalDeadline = new Date(lastIncomeDateUTC);
        renewalDeadline.setUTCDate(renewalDeadline.getUTCDate() + 65); // Extended to 65 days for all users
        renewalDeadline.setUTCHours(23, 59, 59, 999); // End of deadline day UTC
      } else {
        // Fallback: Use purchase date + 65 days (if no income found)
        lastIncomeDate = null;
        const purchaseDate = new Date(purchase.purchased_at);
        const purchaseDateUTC = new Date(Date.UTC(
          purchaseDate.getUTCFullYear(),
          purchaseDate.getUTCMonth(),
          purchaseDate.getUTCDate()
        ));
        renewalDeadline = new Date(purchaseDateUTC);
        renewalDeadline.setUTCDate(renewalDeadline.getUTCDate() + 65); // Extended to 65 days for all users
        renewalDeadline.setUTCHours(23, 59, 59, 999); // End of deadline day UTC
      }

      // Calculate countdown remaining (for initial display only)
      // Frontend should calculate real-time countdown from renewal_deadline using client time
      const remainingMs = renewalDeadline.getTime() - now.getTime();
      const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;

      const canRenew = totalSeconds > 0;

      return {
        last_income_date: lastIncomeDate ? lastIncomeDate.toISOString() : null,
        // FIXED deadline - never changes, frontend calculates real-time countdown from this
        // Formula: countdown = renewal_deadline - client_current_time
        renewal_deadline: renewalDeadline.toISOString(),
        // Initial countdown (for display, but frontend should recalculate from renewal_deadline)
        countdown: {
          days,
          hours,
          minutes,
          seconds,
          total_seconds: totalSeconds,
        },
        can_renew: canRenew,
      };
    } catch (error) {
      console.error(`[PackageStatusService] Error in calculateRenewalCountdown:`, error);
      return null;
    }
  }
}

