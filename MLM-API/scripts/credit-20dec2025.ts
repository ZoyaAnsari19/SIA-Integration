/**
 * One-time script to credit SELF, GLOBAL_HELPING, and MONTHLY commissions
 * for all eligible users for 20 Dec 2025.
 * 
 * This script reuses the exact same logic from creditDailyCommissions()
 * but with a fixed date (20 Dec 2025) instead of current date.
 * 
 * Usage: npx tsx scripts/credit-20dec2025.ts
 * 
 * IMPORTANT: Ensure DATABASE_URL in .env points to local database (port 5435)
 */

import { prisma } from '../src/config/prisma.js';
import { daysInMonth } from '../src/utils/dateUtils.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';
import { isUserActive, getUplines, checkEligibility } from '../src/utils/business.js';
import { calculateDailyPaise, paiseToRupees } from '../src/utils/paise.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

// Fixed date: 20 Dec 2025
const creditDate = new Date('2025-12-20');
creditDate.setHours(0, 0, 0, 0);
const dateString = creditDate.toISOString().slice(0, 10); // "2025-12-20"
const daysInMonth = 31; // December 2025
const isLastDayOfMonth = false; // Dec 20 is not the last day

async function creditCommissionsFor20Dec2025() {
  console.log('🚀 Starting commission credit for 20 Dec 2025...');
  console.log(`📅 Date: ${dateString}`);
  console.log(`📊 Days in month: ${daysInMonth}`);
  console.log('');

  // Get ALL completed purchases
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
    } as any, // Include income, is_renewal, effective_global_ids, etc. (exist in DB but not in Prisma schema)
  });

  console.log(`📦 Found ${allPurchases.length} total completed purchases`);

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
          recurring_rate_percent: true,
        },
      });

      if (!pkg) continue;

      eligiblePurchases.push({
        purchase,
        package: pkg as any, // Type assertion for partial select
      });
    }
  }

  console.log(`✅ Found ${eligiblePurchases.length} eligible purchases (not reached 2x)`);
  console.log('');

  // Counters for summary
  let selfCount = 0;
  let selfTotal = 0;
  let globalCount = 0;
  let globalTotal = 0;
  let monthlyCount = 0;
  let monthlyTotal = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process each eligible purchase
  for (let i = 0; i < eligiblePurchases.length; i++) {
    const { purchase, package: pkg } = eligiblePurchases[i];
    const userId = purchase.user_id as unknown as bigint;
    const purchaseId = purchase.id as unknown as bigint;

    try {
      // Progress logging every 100 purchases
      if ((i + 1) % 100 === 0) {
        console.log(`⏳ Processing purchase ${i + 1}/${eligiblePurchases.length}...`);
      }

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

      // ============================================
      // Process SELF commission
      // ============================================
      if (pkg && pkg.self_roi_percent && Number(pkg.self_roi_percent) > 0) {
        try {
          const selfMonthly = Number(pkg.price) * Number(pkg.self_roi_percent) / 100;
          const { dailyPaise, remainderPaise } = calculateDailyPaise(selfMonthly, daysInMonth);
          
          let selfAmount: number;
          if (isLastDayOfMonth && remainderPaise > 0n) {
            selfAmount = paiseToRupees(dailyPaise + remainderPaise);
          } else {
            selfAmount = paiseToRupees(dailyPaise);
          }

          if (selfAmount > 0) {
            // Fixed idempotency key: daily:self:{purchaseId}:2025-12-20
            const selfIdk = `daily:self:${purchaseId}:${dateString}`;
            
            // Check if already credited (idempotency)
            const existingSelf = await prisma.ledger_entries.findFirst({
              where: { idempotency_key: selfIdk },
            });

            if (!existingSelf) {
              await addLedgerAndWallet({
                receiverId: userId,
                sourceId: userId,
                purchaseId: purchaseId,
                amount: selfAmount,
                type: 'SELF',
                metadata: {},
                idempotencyKey: selfIdk,
                creditedAt: new Date('2025-12-20T00:00:00Z'), // Fixed date: 20 Dec 2025 00:00:00 UTC
              });

              // Update purchase income for 2x tracking
              await prisma.purchases.update({
                where: { id: purchaseId },
                data: { income: { increment: selfAmount } } as any,
              });

              selfCount++;
              selfTotal += selfAmount;
              console.log(`    ✅ SELF: Purchase ${purchaseId}, User ${userId}, Amount: ₹${selfAmount.toFixed(2)}`);
            }
          }
        } catch (error: any) {
          console.error(`    ❌ Error processing SELF for purchase ${purchaseId}, user ${userId}:`, error.message);
          errorCount++;
        }
      }

      // ============================================
      // Process GLOBAL_HELPING commission
      // ============================================
      if (pkg && pkg.global_ids && Number(pkg.global_ids) > 0) {
        try {
          const GLOBAL_MONTHLY_PER_ID = 6.25; // Fixed constant
          const { dailyPaise: perIdDailyPaise, remainderPaise: perIdRemainderPaise } = 
            calculateDailyPaise(GLOBAL_MONTHLY_PER_ID, daysInMonth);
          
          // Calculate used IDs (up to 20 Dec 2025)
          let packageCap = Number(pkg.global_ids) || 0;
          let usedIds = 0;

          // Determine package cap (check effective_global_ids for renewals)
          if ((purchase as any).effective_global_ids !== null) {
            packageCap = Number((purchase as any).effective_global_ids) || packageCap;
          }

          // Safety check: Ensure packageCap is a valid positive number
          if (!packageCap || packageCap <= 0 || isNaN(packageCap)) {
            packageCap = Number(pkg.global_ids) || 0;
          }
          if (!packageCap || packageCap <= 0 || isNaN(packageCap)) {
            console.warn(`    ⚠️ Invalid packageCap for purchase ${purchaseId}, user ${userId}, skipping GLOBAL_HELPING`);
            continue;
          }

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

          // Count UNIQUE users who made their FIRST purchase AFTER the start date
          // IMPORTANT: Count up to 20 Dec 2025, not current date
          const creditDateEnd = new Date('2025-12-20');
          creditDateEnd.setHours(23, 59, 59, 999);
          
          const uniqueFirstPurchases = await prisma.purchases.findMany({
            where: {
              status: 'completed',
              is_renewal: false, // Only first purchases count
              purchased_at: { 
                gt: startDate,
                lte: creditDateEnd // Up to 20 Dec 2025
              },
              NOT: { user_id: userId }, // Exclude self
            } as any,
            select: { user_id: true },
            distinct: ['user_id'],
            take: Math.max(1, Math.floor(packageCap) + 1), // Ensure valid positive integer
            orderBy: { purchased_at: 'asc' },
          });

          const globalUsersCount = uniqueFirstPurchases.length;
          usedIds = Math.min(globalUsersCount, packageCap);

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
            // Fixed idempotency key: daily:global:{purchaseId}:2025-12-20
            const globalIdk = `daily:global:${purchaseId}:${dateString}`;
            
            // Check if already credited (idempotency)
            const existingGlobal = await prisma.ledger_entries.findFirst({
              where: { idempotency_key: globalIdk },
            });

            if (!existingGlobal) {
              await addLedgerAndWallet({
                receiverId: userId,
                sourceId: userId,
                purchaseId: purchaseId,
                amount: globalAmount,
                type: 'GLOBAL_HELPING',
                metadata: {
                  used_ids: usedIds,
                  package_cap: packageCap,
                },
                idempotencyKey: globalIdk,
                creditedAt: new Date('2025-12-20T00:00:00Z'), // Fixed date: 20 Dec 2025 00:00:00 UTC
              });

              // Update purchase income for 2x tracking
              await prisma.purchases.update({
                where: { id: purchaseId },
                data: { income: { increment: globalAmount } } as any,
              });

              globalCount++;
              globalTotal += globalAmount;
              console.log(`    ✅ GLOBAL_HELPING: Purchase ${purchaseId}, User ${userId}, Used IDs: ${usedIds}, Amount: ₹${globalAmount.toFixed(2)}`);
            }
          }
        } catch (error: any) {
          console.error(`    ❌ Error processing GLOBAL_HELPING for purchase ${purchaseId}, user ${userId}:`, error.message);
          errorCount++;
        }
      }

      // ============================================
      // Process MONTHLY commissions
      // ============================================
      const buyerId = userId;
      
      // Get all uplines (Level 0-9, depth 1-10)
      const uplines = await getUplines(buyerId, 9);
      
      for (const { ancestor_id, depth } of uplines) {
        const level = depth - 1; // depth 1 → level 0, depth 2 → level 1, etc.
        const uplineId = ancestor_id as unknown as bigint;
        
        try {
          // Check if upline is disqualified
          const upline = await prisma.users.findUnique({
            where: { id: uplineId },
            select: { is_disqualified: true },
          });
          if (upline?.is_disqualified) continue;
          
          // Check if upline is eligible for this level
          const eligible = await checkEligibility(uplineId, level);
          if (!eligible) continue;
          
          // Check if upline is active (has at least one active course)
          const uplineActive = await isUserActive(uplineId);
          if (!uplineActive) continue;
          
          // Check if buyer is active (has at least one active course)
          const buyerActive = await isUserActive(buyerId);
          if (!buyerActive) continue;
          
          // Double-check purchase hasn't reached 2x (for this upline's commission)
          const purchaseIncome = Number((purchase as any).income || 0);
          const purchaseAmount = Number(purchase.amount);
          if (purchaseIncome >= purchaseAmount * 2) continue;
          
          // Calculate MONTHLY amount based on level
          const levelData = await prisma.levels.findUnique({ where: { level } });
          const monthlyPercent = levelData?.monthly_royalty_percent 
            ? Number(levelData.monthly_royalty_percent) / 100 
            : 0.005; // Default 0.5% if not found
          
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
          const { dailyPaise, remainderPaise } = calculateDailyPaise(monthly, daysInMonth);
          let dailyAmount: number;
          if (isLastDayOfMonth && remainderPaise > 0n) {
            dailyAmount = paiseToRupees(dailyPaise + remainderPaise);
          } else {
            dailyAmount = paiseToRupees(dailyPaise);
          }
          
          if (dailyAmount > 0) {
            // Fixed idempotency key: daily:monthly:{purchaseId}:{uplineId}:{level}:2025-12-20
            const monthlyIdk = `daily:monthly:${purchaseId}:${uplineId}:${level}:${dateString}`;
            
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
                  date: dateString
                },
                idempotencyKey: monthlyIdk,
                creditedAt: new Date('2025-12-20T00:00:00Z'), // Fixed date: 20 Dec 2025 00:00:00 UTC
              });
              
              monthlyCount++;
              monthlyTotal += dailyAmount;
              console.log(`    ✅ MONTHLY: Purchase ${purchaseId}, Upline ${uplineId} (Level ${level}), Amount: ₹${dailyAmount.toFixed(2)}`);
            }
          }
        } catch (error: any) {
          console.error(`    ❌ Error processing MONTHLY for purchase ${purchaseId}, upline ${ancestor_id}, level ${level}:`, error.message);
          errorCount++;
          // Continue with next upline even if this one fails
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing purchase ${purchaseId}, user ${userId}:`, error.message);
      errorCount++;
      skippedCount++;
      // Continue with next purchase
    }
  }

  // ============================================
  // Final Summary
  // ============================================
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 COMMISSION CREDIT SUMMARY FOR 20 DEC 2025');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📅 Date Processed: ${dateString}`);
  console.log(`📦 Total Purchases: ${allPurchases.length}`);
  console.log(`✅ Eligible Purchases: ${eligiblePurchases.length}`);
  console.log('');
  console.log('💰 Commissions Credited:');
  console.log(`   SELF:           ${selfCount} credits, Total: ₹${selfTotal.toFixed(2)}`);
  console.log(`   GLOBAL_HELPING: ${globalCount} credits, Total: ₹${globalTotal.toFixed(2)}`);
  console.log(`   MONTHLY:        ${monthlyCount} credits, Total: ₹${monthlyTotal.toFixed(2)}`);
  console.log(`   TOTAL:          ${selfCount + globalCount + monthlyCount} credits, Total: ₹${(selfTotal + globalTotal + monthlyTotal).toFixed(2)}`);
  console.log('');
  console.log(`⏭️  Skipped: ${skippedCount} purchases`);
  console.log(`❌ Errors: ${errorCount} errors`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Verification queries (commented out - run manually if needed)
  console.log('📋 Verification Queries (run manually in database):');
  console.log('');
  console.log('-- Check ledger entries for 20 Dec 2025');
  console.log(`SELECT 
  commission_type,
  COUNT(*) as count,
  SUM(amount) as total
FROM ledger_entries 
WHERE credited_at::date = '${dateString}'
GROUP BY commission_type;`);
  console.log('');
  console.log('-- Check wallet updates');
  console.log(`SELECT 
  user_id,
  other_balance,
  balance
FROM user_balances 
WHERE updated_at >= '${dateString}'
LIMIT 10;`);
  console.log('');
  console.log('-- Check wallet transactions');
  console.log(`SELECT COUNT(*) FROM wallet_transactions 
WHERE created_at::date >= '${dateString}';`);
  console.log('');

  return {
    date: dateString,
    totalPurchases: allPurchases.length,
    eligiblePurchases: eligiblePurchases.length,
    self: { count: selfCount, total: selfTotal },
    globalHelping: { count: globalCount, total: globalTotal },
    monthly: { count: monthlyCount, total: monthlyTotal },
    skipped: skippedCount,
    errors: errorCount,
  };
}

// Run the script
creditCommissionsFor20Dec2025()
  .then((result) => {
    console.log('✅ Script completed successfully!');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed with error:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

