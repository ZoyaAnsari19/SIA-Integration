#!/usr/bin/env tsx
/**
 * Test PackageStatusService.calculateGlobalIdsInfo fix on local production backup
 * 
 * This directly tests the service that the UI uses
 */

import { PrismaClient } from '@prisma/client';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Testing PackageStatusService.calculateGlobalIdsInfo Fix\n');
  console.log('='.repeat(80));
  console.log('Testing the service that UI uses to display Global IDs\n');

  try {
    // Test SIA00835's most recent purchase (ID 1562)
    const userId = await prisma.users.findUnique({
      where: { display_id: 'SIA00835' },
      select: { id: true },
    });

    if (!userId) {
      console.log('❌ User SIA00835 not found');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ User found: SIA00835 (ID: ${userId.id})\n`);

    // Get purchase ID 1562 (most recent active purchase)
    const purchase = await prisma.purchases.findUnique({
      where: { id: BigInt(1562) },
      select: {
        id: true,
        user_id: true,
        package_id: true,
        purchased_at: true,
        effective_global_ids: true,
        is_manual: true,
        is_renewal: true,
        status: true,
      },
    });

    if (!purchase) {
      console.log('❌ Purchase 1562 not found');
      await prisma.$disconnect();
      return;
    }

    const pkg = await prisma.packages.findUnique({
      where: { id: purchase.package_id },
      select: { name: true, global_ids: true },
    });

    console.log(`📦 Purchase Details:`);
    console.log(`   Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'} (ID: ${purchase.package_id})`);
    console.log(`   Package Cap: ${pkg?.global_ids || 0}`);
    console.log(`   Effective Global IDs: ${purchase.effective_global_ids}`);
    console.log(`   Is Manual: ${purchase.is_manual || false}`);
    console.log(`   Is Renewal: ${purchase.is_renewal || false}`);
    console.log(`   Purchased At: ${purchase.purchased_at}\n`);

    console.log('🔧 Calling PackageStatusService.calculateGlobalIdsInfo...\n');

    // Call the service that UI uses
    const globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(
      purchase.id,
      purchase.user_id as unknown as bigint
    );

    if (!globalIdsInfo) {
      console.log('❌ Service returned null (purchase might be expired)');
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Service Response:');
    console.log(`   Used IDs: ${globalIdsInfo.used_ids}`);
    console.log(`   Remaining IDs: ${globalIdsInfo.remaining_ids}`);
    console.log(`   Package Cap: ${globalIdsInfo.package_cap}`);
    console.log(`   Cap Reached: ${globalIdsInfo.is_cap_reached ? '✅ YES' : '❌ NO'}`);
    console.log(`   Total Global Users: ${globalIdsInfo.total_global_users}`);
    console.log(`   Inactive contributors (2× on first purchase in window): ${globalIdsInfo.inactive_global_contributors}\n`);

    // Verify the fix
    const expectedUsed = 210; // Based on test script calculation
    const effectiveGlobalIds = purchase.effective_global_ids || 0;

    console.log('📊 Verification:');
    console.log(`   Effective Global IDs (initial): ${effectiveGlobalIds}`);
    console.log(`   Current Used IDs: ${globalIdsInfo.used_ids}`);
    console.log(`   Expected (approx): ${expectedUsed}\n`);

    if (globalIdsInfo.used_ids > effectiveGlobalIds) {
      console.log('✅ FIX WORKING: Used IDs is growing beyond effective_global_ids!');
      console.log(`   ✅ Not stuck at ${effectiveGlobalIds}`);
      console.log(`   ✅ Currently at ${globalIdsInfo.used_ids}`);
    } else if (globalIdsInfo.used_ids === effectiveGlobalIds) {
      console.log('❌ FIX NOT WORKING: Used IDs is still stuck at effective_global_ids');
      console.log(`   ❌ Should be higher than ${effectiveGlobalIds}`);
    } else {
      console.log('⚠️ Used IDs is less than effective_global_ids (unexpected)');
    }

    if (globalIdsInfo.used_ids >= expectedUsed - 10 && globalIdsInfo.used_ids <= expectedUsed + 10) {
      console.log(`\n✅ Used IDs matches expected range (${expectedUsed - 10}-${expectedUsed + 10})`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

