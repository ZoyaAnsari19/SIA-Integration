#!/usr/bin/env tsx
/**
 * Debug Self Income Script
 * 
 * This script helps diagnose why self income is not being credited.
 * It checks:
 * 1. If scheduled commissions exist for the user
 * 2. If the purchase has reached 2x
 * 3. If the user is active (has active purchases)
 * 4. If the user is disqualified
 * 5. Recent ledger entries for SELF commissions
 */

import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { isUserActive } from '../src/utils/business.js';

async function debugSelfIncome(userId?: string) {
  console.log('🔍 Debugging Self Income Issues...\n');

  // If userId provided, check specific user
  if (userId) {
    const userIdBigInt = BigInt(userId);
    console.log(`📊 Checking user ID: ${userId}\n`);

    // 1. Check user details
    const user = await prisma.users.findUnique({
      where: { id: userIdBigInt },
      select: {
        id: true,
        name: true,
        email: true,
        is_disqualified: true,
        display_id: true,
      },
    });

    if (!user) {
      console.log(`❌ User ${userId} not found`);
      return;
    }

    console.log('👤 User Details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Display ID: ${user.display_id || 'N/A'}`);
    console.log(`   Disqualified: ${user.is_disqualified ? '❌ YES' : '✅ NO'}\n`);

    // 2. Check purchases
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: userIdBigInt,
        status: 'completed',
      },
      orderBy: { purchased_at: 'desc' },
      include: {
        package: {
          select: {
            name: true,
            price: true,
            self_roi_percent: true,
          },
        },
      },
    });

    console.log(`📦 Purchases: ${purchases.length}`);
    for (const purchase of purchases) {
      const investment = Number(purchase.amount);
      const income = Number(purchase.income || 0);
      const doubleAmount = investment * 2;
      const is2xReached = income >= doubleAmount;
      const isActiveUntilValid = purchase.active_until >= new Date();

      console.log(`\n   Purchase ID: ${purchase.id}`);
      console.log(`   Package: ${purchase.package?.name || 'N/A'}`);
      console.log(`   Amount: ₹${investment.toFixed(2)}`);
      console.log(`   Income: ₹${income.toFixed(2)}`);
      console.log(`   2x Target: ₹${doubleAmount.toFixed(2)}`);
      console.log(`   2x Reached: ${is2xReached ? '❌ YES (STOPPED)' : '✅ NO (ACTIVE)'}`);
      console.log(`   Active Until: ${purchase.active_until.toISOString()}`);
      console.log(`   Active Until Valid: ${isActiveUntilValid ? '✅ YES' : '❌ NO (EXPIRED)'}`);
      console.log(`   Purchased At: ${purchase.purchased_at.toISOString()}`);

      // Check if scheduled commission exists
      const scheduled = await prisma.scheduled_commissions.findFirst({
        where: {
          purchase_id: purchase.id,
          commission_type: 'SELF',
        },
      });

      if (scheduled) {
        console.log(`   ✅ Scheduled SELF Commission Found:`);
        console.log(`      Monthly: ₹${Number(scheduled.monthly_amount).toFixed(2)}`);
        console.log(`      Daily: ₹${Number(scheduled.daily_amount).toFixed(2)}`);
        console.log(`      Start Date: ${scheduled.start_date.toISOString()}`);
        console.log(`      End Date: ${scheduled.end_date.toISOString()}`);
        console.log(`      Total Credited: ₹${Number(scheduled.total_credited || 0).toFixed(2)}`);
        console.log(`      Days Processed: ${scheduled.days_processed || 0}`);

        // Check if today is eligible
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(scheduled.start_date);
        startDate.setHours(0, 0, 0, 0);
        const isEligibleToday = startDate <= today;

        console.log(`      Eligible Today: ${isEligibleToday ? '✅ YES' : '❌ NO'}`);
      } else {
        console.log(`   ❌ NO Scheduled SELF Commission Found!`);
        console.log(`      This means SELF income will NOT be credited.`);
        console.log(`      Action: Need to re-run handlePurchase() for this purchase.`);
      }
    }

    // 3. Check if user is active (using isUserActive function)
    const userActive = await isUserActive(userIdBigInt);
    console.log(`\n✅ User Active (isUserActive): ${userActive ? 'YES' : '❌ NO'}`);
    console.log(`   Note: This checks active_until >= today, not 2x status`);

    // 4. Check hasActiveCourse (checks 2x status)
    const today = new Date();
    const hasActive = await CommissionService.hasActiveCourse(userIdBigInt, today);
    console.log(`✅ Has Active Course (2x check): ${hasActive ? 'YES' : '❌ NO'}`);
    console.log(`   Note: This checks if any purchase has NOT reached 2x`);

    // 5. Check recent SELF ledger entries
    const recentSelfEntries = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: userIdBigInt,
        commission_type: 'SELF',
      },
      orderBy: { credited_at: 'desc' },
      take: 10,
    });

    console.log(`\n💰 Recent SELF Income (Last 10):`);
    if (recentSelfEntries.length === 0) {
      console.log(`   ❌ NO SELF income entries found!`);
    } else {
      for (const entry of recentSelfEntries) {
        console.log(`   ₹${Number(entry.amount).toFixed(2)} on ${entry.credited_at.toISOString()}`);
      }
    }

    // 6. Check all scheduled SELF commissions for this user
    const allScheduledSelf = await prisma.scheduled_commissions.findMany({
      where: {
        receiver_user_id: userIdBigInt,
        commission_type: 'SELF',
      },
    });

    console.log(`\n📅 All Scheduled SELF Commissions: ${allScheduledSelf.length}`);
    for (const sched of allScheduledSelf) {
      const purchase = await prisma.purchases.findUnique({
        where: { id: sched.purchase_id! },
        select: { amount: true, income: true },
      });
      if (purchase) {
        const is2x = Number(purchase.income || 0) >= Number(purchase.amount) * 2;
        console.log(`   Purchase ${sched.purchase_id}: Monthly ₹${Number(sched.monthly_amount).toFixed(2)}, 2x: ${is2x ? 'REACHED' : 'NOT REACHED'}`);
      }
    }

  } else {
    // No userId provided - show general stats
    console.log('📊 General Self Income Statistics:\n');

    // Count scheduled SELF commissions
    const scheduledSelfCount = await prisma.scheduled_commissions.count({
      where: { commission_type: 'SELF' },
    });
    console.log(`📅 Scheduled SELF Commissions: ${scheduledSelfCount}`);

    // Count active purchases (not reached 2x)
    const activePurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
      },
    });

    let activeCount = 0;
    for (const purchase of activePurchases) {
      const is2x = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
      if (!is2x) activeCount++;
    }
    console.log(`📦 Active Purchases (not 2x): ${activeCount} / ${activePurchases.length}`);

    // Count recent SELF entries (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSelfCount = await prisma.ledger_entries.count({
      where: {
        commission_type: 'SELF',
        credited_at: { gte: sevenDaysAgo },
      },
    });
    console.log(`💰 SELF Income Entries (Last 7 Days): ${recentSelfCount}`);

    // Check for purchases without scheduled commissions
    const purchasesWithoutSchedules = await prisma.purchases.findMany({
      where: {
        status: 'completed',
      },
      include: {
        package: {
          select: {
            self_roi_percent: true,
          },
        },
      },
    });

    let missingSchedules = 0;
    for (const purchase of purchasesWithoutSchedules) {
      if (purchase.package?.self_roi_percent) {
        const scheduled = await prisma.scheduled_commissions.findFirst({
          where: {
            purchase_id: purchase.id,
            commission_type: 'SELF',
          },
        });
        if (!scheduled) {
          missingSchedules++;
        }
      }
    }
    console.log(`⚠️  Purchases Missing SELF Schedules: ${missingSchedules}`);
  }

  console.log('\n✅ Debug complete!');
}

// Get userId from command line args
const userId = process.argv[2];

debugSelfIncome(userId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

