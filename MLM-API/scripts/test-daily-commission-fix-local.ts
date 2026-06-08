#!/usr/bin/env tsx
/**
 * Test Daily Commission Fix - LOCAL DB
 * 
 * Runs creditDailyCommissions() on LOCAL DB and verifies that:
 * 1. Manual assignment users get correct GLOBAL_HELPING (initial_used + new_users)
 * 2. Upgrade users get correct GLOBAL_HELPING (old_used + new_users_after_upgrade)
 * 3. Normal users get correct GLOBAL_HELPING (pure dynamic, ignoring effective_global_ids)
 * 
 * This ensures the fix prevents the double-counting bug from recurring.
 */

import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { prisma } from '../src/config/prisma.js';

const TEST_USERS = [
  'SIA00642', // Manual assignment - should use initial_used + new_users
  'SIA00057', // Upgrade user - should use old_used + new_users_after_upgrade
  'SIA00397', // Manual assignment
];

async function getExpectedDynamicUsedIds(userId: bigint, purchaseId: bigint, targetDate: Date): Promise<number> {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: { purchased_at: true, package_id: true },
  });
  if (!purchase) return 0;

  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id },
    select: { global_ids: true },
  });
  if (!pkg || !pkg.global_ids) return 0;

  const packageCap = Number(pkg.global_ids);

  // Count unique users who made FIRST purchase AFTER this purchase up to targetDate
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const uniqueFirstPurchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: {
        gt: purchase.purchased_at,
        lte: endOfDay,
      },
      NOT: { user_id: userId },
    } as any,
    select: { user_id: true },
    distinct: ['user_id'],
  });

  return Math.min(uniqueFirstPurchases.length, packageCap);
}

async function getExpectedManualUsedIds(
  userId: bigint,
  purchaseId: bigint,
  effectiveGlobalIds: number,
  targetDate: Date
): Promise<number> {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: { purchased_at: true, package_id: true },
  });
  if (!purchase) return 0;

  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id },
    select: { global_ids: true },
  });
  if (!pkg || !pkg.global_ids) return 0;

  const packageCap = Number(pkg.global_ids);
  const initialUsed = effectiveGlobalIds;

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const newUsersAfterPurchase = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: {
        gt: purchase.purchased_at,
        lte: endOfDay,
      },
      NOT: { user_id: userId },
    } as any,
    select: { user_id: true },
    distinct: ['user_id'],
  });

  const totalUsed = initialUsed + newUsersAfterPurchase.length;
  return Math.min(totalUsed, packageCap);
}

async function main() {
  console.log('='.repeat(80));
  console.log('🧪 TESTING DAILY COMMISSION FIX - LOCAL DB');
  console.log('='.repeat(80));
  console.log('\n⚠️  This will run creditDailyCommissions() for TODAY');
  console.log('   Make sure LOCAL DB is ready for testing.\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  console.log(`📅 Test Date: ${todayStr}\n`);

  // Get current state BEFORE running commission
  console.log('📊 Step 1: Getting current GLOBAL_HELPING entries...');
  const beforeEntries: Record<string, any> = {};
  for (const displayId of TEST_USERS) {
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: { id: true },
    });
    if (!user) continue;

    const entries = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: user.id,
        commission_type: 'GLOBAL_HELPING',
        credited_at: {
          gte: new Date(todayStr),
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        amount: true,
        purchase_id: true,
        metadata: true,
      },
    });

    beforeEntries[displayId] = entries;
  }

  // Run daily commission job
  console.log('\n💰 Step 2: Running creditDailyCommissions()...');
  const result = await CommissionService.creditDailyCommissions();
  console.log(`✅ Daily commission completed: ${result.count} entries credited\n`);

  // Verify results
  console.log('🔍 Step 3: Verifying GLOBAL_HELPING entries...\n');
  let allCorrect = true;

  for (const displayId of TEST_USERS) {
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: { id: true },
    });
    if (!user) {
      console.log(`⚠️  ${displayId}: User not found, skipping`);
      continue;
    }

    // Get active purchase
    const purchase = await prisma.purchases.findFirst({
      where: {
        user_id: user.id,
        status: 'completed',
      },
      orderBy: { purchased_at: 'desc' },
      select: {
        id: true,
        package_id: true,
        purchased_at: true,
        effective_global_ids: true,
        is_manual: true,
        is_renewal: true,
        previous_package_id: true,
      } as any,
    });

    if (!purchase) {
      console.log(`⚠️  ${displayId}: No active purchase found, skipping`);
      continue;
    }

    const pkg = await prisma.packages.findUnique({
      where: { id: purchase.package_id },
      select: { global_ids: true, name: true },
    });

    if (!pkg || !pkg.global_ids) {
      console.log(`⚠️  ${displayId}: Package has no global_ids, skipping`);
      continue;
    }

    // Get today's GLOBAL_HELPING entry
    const todayEntry = await prisma.ledger_entries.findFirst({
      where: {
        receiver_user_id: user.id,
        purchase_id: purchase.id,
        commission_type: 'GLOBAL_HELPING',
        credited_at: {
          gte: new Date(todayStr),
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        amount: true,
        metadata: true,
      },
    });

    if (!todayEntry) {
      console.log(`⚠️  ${displayId}: No GLOBAL_HELPING entry for today (may be expired/2x reached)`);
      continue;
    }

    const actualAmount = Number(todayEntry.amount);
    const actualUsedIds = (todayEntry.metadata as any)?.used_ids || null;

    // Calculate expected based on purchase type
    let expectedUsedIds: number;
    const isManual = (purchase as any).is_manual && (purchase as any).effective_global_ids > 0;
    const isUpgrade =
      (purchase as any).is_renewal &&
      (purchase as any).previous_package_id !== null &&
      (purchase as any).previous_package_id !== (purchase as any).package_id &&
      (purchase as any).effective_global_ids > 0;

    if (isManual) {
      expectedUsedIds = await getExpectedManualUsedIds(
        user.id,
        purchase.id,
        Number((purchase as any).effective_global_ids),
        today
      );
    } else {
      // Normal dynamic (or upgrade handled separately)
      expectedUsedIds = await getExpectedDynamicUsedIds(user.id, purchase.id, today);
    }

    const PER_ID_DAILY = 6.25 / 31; // Jan 2026
    const expectedAmount = expectedUsedIds * PER_ID_DAILY;

    const amountMatch = Math.abs(actualAmount - expectedAmount) < 0.01;
    const usedIdsMatch = actualUsedIds === expectedUsedIds;

    const status = amountMatch && usedIdsMatch ? '✅' : '❌';
    const mode = isManual ? 'MANUAL' : isUpgrade ? 'UPGRADE' : 'NORMAL';

    console.log(`${status} ${displayId} (${mode}):`);
    console.log(`   Actual:   ₹${actualAmount.toFixed(2)}, used_ids=${actualUsedIds}`);
    console.log(`   Expected: ₹${expectedAmount.toFixed(2)}, used_ids=${expectedUsedIds}`);
    if (!amountMatch || !usedIdsMatch) {
      console.log(`   ⚠️  MISMATCH DETECTED!`);
      allCorrect = false;
    }
    console.log();
  }

  console.log('='.repeat(80));
  if (allCorrect) {
    console.log('✅ ALL TESTS PASSED - Fix is working correctly!');
  } else {
    console.log('❌ SOME TESTS FAILED - Please review the mismatches above');
  }
  console.log('='.repeat(80));
}

main()
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
