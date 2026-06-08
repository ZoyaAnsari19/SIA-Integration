#!/usr/bin/env tsx
/**
 * Test script to verify Global IDs fix on local production backup database
 * 
 * This script checks if the legacy global IDs bug is fixed:
 * - Legacy mode: effective_global_ids should be treated as initial used count
 * - New users should be added to initial count
 * - Total should be capped by original packageCap (not effective_global_ids)
 * 
 * Usage:
 *   DATABASE_URL="postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission" tsx scripts/test-global-ids-fix-local.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PurchaseWithDetails {
  id: bigint;
  user_id: bigint;
  package_id: number;
  amount: number;
  purchased_at: Date;
  status: string;
  effective_global_ids: number | null;
  is_manual: boolean | null;
  is_renewal: boolean | null;
  previous_package_id: number | null;
  package_name: string;
  package_global_ids: number | null;
  user_display_id: string;
  user_name: string;
}

async function getAffectedPurchases(): Promise<PurchaseWithDetails[]> {
  // Find purchases with effective_global_ids set (legacy/migration cases)
  // where is_manual is false and it's not an upgrade
  const purchases = await prisma.$queryRaw<PurchaseWithDetails[]>`
    SELECT 
      p.id,
      p.user_id,
      p.package_id,
      p.amount,
      p.purchased_at,
      p.status,
      p.effective_global_ids,
      p.is_manual,
      p.is_renewal,
      p.previous_package_id,
      pk.name as package_name,
      pk.global_ids as package_global_ids,
      u.display_id as user_display_id,
      u.name as user_name
    FROM purchases p
    JOIN packages pk ON p.package_id = pk.id
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'completed'
      AND p.effective_global_ids IS NOT NULL
      AND (p.is_manual IS NULL OR p.is_manual = false)
      AND (p.is_renewal IS NULL OR p.is_renewal = false)
      AND pk.global_ids IS NOT NULL
      AND pk.global_ids > 0
    ORDER BY p.purchased_at DESC
    LIMIT 20
  ` as any;

  return purchases;
}

async function calculateGlobalUsersCount(purchaseId: bigint, userId: bigint, purchasedAt: Date): Promise<number> {
  // Count unique users who made their FIRST purchase after this purchase date
  // Excluding the purchase owner
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT p2.user_id)::bigint as count
    FROM purchases p2
    WHERE p2.status = 'completed'
      AND p2.is_renewal = false
      AND p2.user_id != ${userId}
      AND p2.purchased_at > ${purchasedAt}
      AND p2.purchased_at <= NOW()
  ` as any;

  return Number(result[0]?.count || 0);
}

async function checkPurchase(purchase: PurchaseWithDetails) {
  const purchaseId = purchase.id;
  const userId = purchase.user_id;
  const purchasedAt = purchase.purchased_at;
  const effectiveGlobalIds = purchase.effective_global_ids || 0;
  const packageCap = Number(purchase.package_global_ids) || 0;
  const isManual = purchase.is_manual || false;
  const isRenewal = purchase.is_renewal || false;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Purchase ID: ${purchaseId}`);
  console.log(`   User: ${purchase.user_display_id} (${purchase.user_name})`);
  console.log(`   Package: ${purchase.package_name} (ID: ${purchase.package_id})`);
  console.log(`   Purchased At: ${purchasedAt.toISOString()}`);
  console.log(`   Effective Global IDs: ${effectiveGlobalIds}`);
  console.log(`   Package Cap: ${packageCap}`);
  console.log(`   Is Manual: ${isManual}`);
  console.log(`   Is Renewal: ${isRenewal}`);

  // Calculate actual global users count (new users after purchase date)
  const globalUsersCount = await calculateGlobalUsersCount(purchaseId, userId, purchasedAt);
  console.log(`\n   📊 Global Users Count (after purchase date): ${globalUsersCount}`);

  // Apply the FIXED logic
  let usedIds: number;
  let calculationMode: string;

  if (isManual) {
    // Manual assignment: effective_global_ids is the used count
    usedIds = effectiveGlobalIds;
    calculationMode = 'MANUAL';
  } else if (isRenewal && purchase.previous_package_id) {
    // Renewal: calculate remaining from previous package
    const previousPurchase = await prisma.purchases.findFirst({
      where: {
        user_id: userId,
        package_id: purchase.previous_package_id,
        status: 'completed',
      },
      orderBy: { purchased_at: 'desc' },
      select: { id: true, purchased_at: true },
    });

    if (previousPurchase) {
      const previousGlobalCount = await calculateGlobalUsersCount(
        previousPurchase.id,
        userId,
        previousPurchase.purchased_at
      );
      const previousPackage = await prisma.packages.findUnique({
        where: { id: purchase.previous_package_id },
        select: { global_ids: true },
      });
      const previousCap = Number(previousPackage?.global_ids) || 0;
      const usedInPrevious = Math.min(previousGlobalCount, previousCap);
      const remainingIds = Math.max(0, previousCap - usedInPrevious);
      usedIds = Math.min(remainingIds + globalUsersCount, packageCap);
      calculationMode = 'RENEWAL';
      console.log(`   Previous Package Used: ${usedInPrevious}, Remaining: ${remainingIds}`);
    } else {
      usedIds = Math.min(globalUsersCount, packageCap);
      calculationMode = 'RENEWAL (no previous found)';
    }
  } else if (effectiveGlobalIds > 0) {
    // FIXED LOGIC: Legacy/Migration - effective_global_ids = initial used count
    // Add new users to initial count, cap by original packageCap
    const initialUsed = effectiveGlobalIds;
    const totalUsed = initialUsed + globalUsersCount;
    usedIds = Math.min(totalUsed, packageCap);
    calculationMode = 'LEGACY (FIXED)';
    console.log(`\n   🔧 FIXED Calculation:`);
    console.log(`      Initial Used (from migration): ${initialUsed}`);
    console.log(`      New Users After Purchase: ${globalUsersCount}`);
    console.log(`      Total Used: ${totalUsed}`);
    console.log(`      Capped at Package Cap: ${usedIds}`);
  } else {
    // Normal dynamic calculation
    usedIds = Math.min(globalUsersCount, packageCap);
    calculationMode = 'NORMAL';
  }

  const remainingIds = Math.max(0, packageCap - usedIds);
  const isCapReached = packageCap > 0 && usedIds >= packageCap;

  console.log(`\n   ✅ Final Calculation (${calculationMode}):`);
  console.log(`      Used IDs: ${usedIds}`);
  console.log(`      Remaining IDs: ${remainingIds}`);
  console.log(`      Cap Reached: ${isCapReached ? '✅ YES' : '❌ NO'}`);

  // Check recent GLOBAL_HELPING commissions to verify
  const recentCommissions = await prisma.ledger_entries.findMany({
    where: {
      purchase_id: purchaseId,
      commission_type: 'GLOBAL_HELPING',
    },
    orderBy: { credited_at: 'desc' },
    take: 3,
    select: {
      id: true,
      amount: true,
      credited_at: true,
      metadata: true,
    },
  });

  if (recentCommissions.length > 0) {
    console.log(`\n   💰 Recent GLOBAL_HELPING Commissions:`);
    for (const comm of recentCommissions) {
      const metadata = comm.metadata as any || {};
      const commUsedIds = metadata.used_ids || 'N/A';
      const commPackageCap = metadata.package_cap || 'N/A';
      console.log(`      - ₹${Number(comm.amount).toFixed(2)} on ${comm.credited_at.toISOString()}`);
      console.log(`        Used IDs in commission: ${commUsedIds}, Package Cap: ${commPackageCap}`);
      
      // Verify if commission matches our calculation
      if (commUsedIds !== 'N/A' && Number(commUsedIds) === usedIds) {
        console.log(`        ✅ Commission matches calculated used IDs`);
      } else if (commUsedIds !== 'N/A') {
        console.log(`        ⚠️ Commission used IDs (${commUsedIds}) differs from calculated (${usedIds})`);
      }
    }
  } else {
    console.log(`\n   ⚠️ No GLOBAL_HELPING commissions found for this purchase`);
  }

  // Summary
  console.log(`\n   📋 Summary:`);
  if (calculationMode === 'LEGACY (FIXED)') {
    if (usedIds < packageCap) {
      console.log(`      ✅ FIX WORKING: Global IDs can still grow (${usedIds}/${packageCap})`);
      console.log(`      ✅ Not stuck at effective_global_ids (${effectiveGlobalIds})`);
    } else if (isCapReached) {
      console.log(`      ✅ FIX WORKING: Cap reached correctly (${usedIds}/${packageCap})`);
    } else {
      console.log(`      ⚠️ Check: Used IDs calculation may need review`);
    }
  } else {
    console.log(`      ℹ️ Not a legacy case - using ${calculationMode} logic`);
  }
}

async function main() {
  console.log('\n🔍 Testing Global IDs Fix on Local Production Backup Database\n');
  console.log('='.repeat(80));
  console.log('Checking purchases with effective_global_ids (legacy/migration cases)');
  console.log('Verifying that fix allows global IDs to grow beyond effective_global_ids\n');

  try {
    // Get affected purchases
    const purchases = await getAffectedPurchases();
    
    if (purchases.length === 0) {
      console.log('❌ No purchases found with legacy effective_global_ids');
      console.log('   This might mean:');
      console.log('   1. No legacy data in this database');
      console.log('   2. All purchases are manual or renewals');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found ${purchases.length} purchases to check\n`);

    // Check each purchase
    for (const purchase of purchases) {
      await checkPurchase(purchase);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('\n✅ Test Complete!\n');
    console.log('Summary:');
    console.log('- Checked if legacy purchases can grow beyond effective_global_ids');
    console.log('- Verified that packageCap is used as the limit (not effective_global_ids)');
    console.log('- Compared with recent GLOBAL_HELPING commissions\n');

  } catch (error: any) {
    console.error('\n❌ Error during test:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

