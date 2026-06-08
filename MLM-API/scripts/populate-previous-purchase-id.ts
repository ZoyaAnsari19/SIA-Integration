import { prisma } from '../src/config/prisma.js';

/**
 * Migration Script: Populate previous_purchase_id for Old Upgrades
 * 
 * This script finds all existing purchases that are upgrades (have previous_package_id
 * but previous_purchase_id is NULL) and populates the previous_purchase_id by finding
 * the expired purchase that was upgraded from.
 * 
 * Logic:
 * 1. Find all purchases with previous_package_id IS NOT NULL AND previous_purchase_id IS NULL
 * 2. For each, find the expired purchase (same user, package_id = previous_package_id, income >= 2x)
 * 3. Update the purchase with the found expired purchase ID
 * 
 * Note: This is a best-effort migration. If multiple expired purchases exist for the same
 * package_id, we select the most recent one (closest to upgrade date).
 */

async function main() {
  console.log('============================================================');
  console.log('🔄 Migration: Populate previous_purchase_id for Old Upgrades');
  console.log('============================================================\n');

  try {
    // Step 1: Find all purchases with previous_package_id but no previous_purchase_id
    console.log('📊 Step 1: Finding old upgrades (previous_package_id set, previous_purchase_id NULL)...\n');
    
    const oldUpgrades = await prisma.purchases.findMany({
      where: {
        previous_package_id: { not: null },
        previous_purchase_id: null,
        status: 'completed',
      },
      select: {
        id: true,
        user_id: true,
        package_id: true,
        previous_package_id: true,
        purchased_at: true,
        amount: true,
        income: true,
      } as any,
      orderBy: { purchased_at: 'asc' }, // Process oldest first
    });

    console.log(`✅ Found ${oldUpgrades.length} old upgrades to process\n`);

    if (oldUpgrades.length === 0) {
      console.log('✨ No old upgrades found. Migration complete!\n');
      return;
    }

    // Step 2: For each old upgrade, find the expired purchase
    console.log('📊 Step 2: Finding expired purchases for each upgrade...\n');

    let successCount = 0;
    let notFoundCount = 0;
    let multipleFoundCount = 0;
    let skippedCount = 0;

    const results: Array<{
      upgradeId: bigint;
      userId: bigint;
      packageId: number;
      previousPackageId: number;
      foundExpiredId: bigint | null;
      status: string;
    }> = [];

    for (const upgrade of oldUpgrades) {
      const upgradeId = upgrade.id as unknown as bigint;
      const userId = upgrade.user_id as unknown as bigint;
      const packageId = upgrade.package_id;
      const previousPackageId = upgrade.previous_package_id!;
      const upgradeDate = upgrade.purchased_at;

      console.log(`\n🔍 Processing upgrade purchase ${upgradeId}:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Package ID: ${packageId}`);
      console.log(`   Previous Package ID: ${previousPackageId}`);
      console.log(`   Upgrade Date: ${upgradeDate.toISOString()}`);

      // Find expired purchases for this user with the previous_package_id
      // Expired = income >= amount * 2
      const expiredPurchases = await prisma.purchases.findMany({
        where: {
          user_id: userId,
          package_id: previousPackageId,
          status: 'completed',
          purchased_at: { lt: upgradeDate }, // Must be older than upgrade
        },
        select: {
          id: true,
          amount: true,
          income: true,
          purchased_at: true,
        } as any,
        orderBy: { purchased_at: 'desc' }, // Most recent first
      });

      // Filter to only expired purchases (income >= 2x)
      const expired = expiredPurchases.filter(p => {
        const amt = Number(p.amount);
        const inc = Number((p as any).income || 0);
        return inc >= amt * 2;
      });

      if (expired.length === 0) {
        console.log(`   ⚠️  No expired purchase found for package ${previousPackageId}`);
        notFoundCount++;
        results.push({
          upgradeId,
          userId,
          packageId,
          previousPackageId,
          foundExpiredId: null,
          status: 'NOT_FOUND',
        });
        continue;
      }

      if (expired.length > 1) {
        console.log(`   ⚠️  Multiple expired purchases found (${expired.length}). Using most recent one.`);
        multipleFoundCount++;
      }

      // Use the most recent expired purchase (closest to upgrade date)
      const expiredPurchase = expired[0];
      const expiredId = expiredPurchase.id as unknown as bigint;

      console.log(`   ✅ Found expired purchase ${expiredId} (income: ${Number((expiredPurchase as any).income)}, amount: ${Number(expiredPurchase.amount)})`);

      // Step 3: Update the upgrade purchase with previous_purchase_id
      try {
        await prisma.purchases.update({
          where: { id: upgradeId },
          data: {
            previous_purchase_id: expiredId,
          },
        });

        console.log(`   ✨ Updated purchase ${upgradeId} with previous_purchase_id = ${expiredId}`);
        successCount++;
        results.push({
          upgradeId,
          userId,
          packageId,
          previousPackageId,
          foundExpiredId: expiredId,
          status: 'SUCCESS',
        });
      } catch (error: any) {
        console.log(`   ❌ Error updating purchase ${upgradeId}: ${error.message}`);
        skippedCount++;
        results.push({
          upgradeId,
          userId,
          packageId,
          previousPackageId,
          foundExpiredId: expiredId,
          status: 'ERROR',
        });
      }
    }

    // Step 4: Summary
    console.log('\n============================================================');
    console.log('📊 Migration Summary');
    console.log('============================================================\n');
    console.log(`Total old upgrades found: ${oldUpgrades.length}`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⚠️  Not found (no expired purchase): ${notFoundCount}`);
    console.log(`⚠️  Multiple expired found (used most recent): ${multipleFoundCount}`);
    console.log(`❌ Errors/Skipped: ${skippedCount}`);
    console.log('\n');

    // Show detailed results for not found cases
    if (notFoundCount > 0) {
      console.log('⚠️  Upgrades without expired purchase (NOT_FOUND):');
      results
        .filter(r => r.status === 'NOT_FOUND')
        .forEach(r => {
          console.log(`   - Purchase ${r.upgradeId} (User ${r.userId}, Package ${r.packageId}, Previous Package ${r.previousPackageId})`);
        });
      console.log('\n');
    }

    // Show detailed results for multiple found cases
    if (multipleFoundCount > 0) {
      console.log('⚠️  Upgrades with multiple expired purchases (used most recent):');
      results
        .filter(r => r.status === 'SUCCESS' && multipleFoundCount > 0)
        .slice(0, 5) // Show first 5
        .forEach(r => {
          console.log(`   - Purchase ${r.upgradeId} (User ${r.userId}, Package ${r.packageId}, Previous Package ${r.previousPackageId}) → Expired Purchase ${r.foundExpiredId}`);
        });
      console.log('\n');
    }

    console.log('✨ Migration complete!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
