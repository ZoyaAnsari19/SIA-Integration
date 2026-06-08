#!/usr/bin/env tsx
/**
 * Check how many users are affected by the manual assignment commission bug
 * Find all manual assignments with effective_global_ids and check their commissions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING AFFECTED USERS - Manual Assignment Commission Bug');
  console.log('='.repeat(80));

  // 1. Find all manual assignments
  console.log('\n📦 Finding all manual assignments...');
  
  const manualPurchases = await prisma.$queryRaw<any[]>`
    SELECT 
      p.id as purchase_id,
      p.user_id,
      p.package_id,
      p.amount,
      p.purchased_at,
      p.effective_global_ids,
      p.is_manual,
      p.payment_type,
      p.income,
      pk.name as package_name,
      pk.global_ids as package_global_ids
    FROM purchases p
    JOIN packages pk ON p.package_id = pk.id
    WHERE p.status = 'completed'
      AND (p.is_manual = true OR p.payment_type = 'admin_assignment')
      AND p.effective_global_ids IS NOT NULL
      AND p.effective_global_ids > 0
    ORDER BY p.purchased_at DESC
  `;

  console.log(`✅ Found ${manualPurchases.length} manual assignments with effective_global_ids\n`);

  if (manualPurchases.length === 0) {
    console.log('❌ No manual assignments found with effective_global_ids');
    await prisma.$disconnect();
    return;
  }

  // 2. Get user details
  const userIds = [...new Set(manualPurchases.map((p: any) => p.user_id.toString()))];
  const users = await prisma.users.findMany({
    where: {
      id: { in: userIds.map((id) => BigInt(id)) as any },
    },
    select: {
      id: true,
      display_id: true,
      name: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  // 3. Check commissions for each purchase
  console.log('='.repeat(80));
  console.log('📊 ANALYZING COMMISSIONS');
  console.log('='.repeat(80));

  let affectedCount = 0;
  let totalExpectedLoss = 0;
  const affectedPurchases: any[] = [];

  for (const purchase of manualPurchases) {
    const purchaseId = BigInt(purchase.purchase_id);
    const userId = BigInt(purchase.user_id);
    const user = userMap.get(purchase.user_id.toString());
    const effectiveGlobalIds = Number(purchase.effective_global_ids || 0);
    const packageGlobalIds = Number(purchase.package_global_ids || 0);

    // Get latest GLOBAL_HELPING commission
    const latestCommission = await prisma.ledger_entries.findFirst({
      where: {
        purchase_id: purchaseId,
        commission_type: 'GLOBAL_HELPING',
      },
      orderBy: { credited_at: 'desc' },
    });

    if (!latestCommission) {
      // No commission yet - might be assigned today
      console.log(`\n⚠️  Purchase ${purchase.purchase_id} (${user?.display_id || 'N/A'}): No commission yet`);
      continue;
    }

    const metadata = latestCommission.metadata as any;
    const actualUsedIds = metadata?.used_ids || 0;
    const expectedUsedIds = effectiveGlobalIds; // At minimum, should be effective_global_ids

    // Check if there's a mismatch
    if (actualUsedIds < expectedUsedIds) {
      affectedCount++;
      
      // Calculate daily loss
      const GLOBAL_MONTHLY_PER_ID = 6.25;
      const daysInMonth = 31; // Approximate
      const perIdDaily = GLOBAL_MONTHLY_PER_ID / daysInMonth;
      
      const expectedDaily = expectedUsedIds * perIdDaily;
      const actualDaily = actualUsedIds * perIdDaily;
      const dailyLoss = expectedDaily - actualDaily;

      affectedPurchases.push({
        purchase_id: purchase.purchase_id,
        user_id: purchase.user_id,
        user_display_id: user?.display_id || 'N/A',
        user_name: user?.name || 'N/A',
        package_name: purchase.package_name,
        package_global_ids: packageGlobalIds,
        effective_global_ids: effectiveGlobalIds,
        actual_used_ids: actualUsedIds,
        expected_used_ids: expectedUsedIds,
        difference: expectedUsedIds - actualUsedIds,
        daily_loss: dailyLoss,
        latest_commission_date: latestCommission.credited_at,
      });

      totalExpectedLoss += dailyLoss;
    }
  }

  // 4. Display results
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log('='.repeat(80));

  console.log(`\n✅ Total Manual Assignments: ${manualPurchases.length}`);
  console.log(`❌ Affected Purchases: ${affectedCount}`);
  console.log(`✅ Not Affected: ${manualPurchases.length - affectedCount}`);

  if (affectedCount > 0) {
    console.log(`\n💰 Estimated Daily Loss: ₹${totalExpectedLoss.toFixed(2)}/day`);
    console.log(`💰 Estimated Monthly Loss: ₹${(totalExpectedLoss * 30).toFixed(2)}/month`);

    console.log('\n' + '='.repeat(80));
    console.log('📋 AFFECTED PURCHASES DETAILS');
    console.log('='.repeat(80));

    for (const affected of affectedPurchases) {
      console.log(`\n🔴 Purchase ID: ${affected.purchase_id}`);
      console.log(`   User: ${affected.user_display_id} (${affected.user_name})`);
      console.log(`   Package: ${affected.package_name}`);
      console.log(`   Package Global IDs Cap: ${affected.package_global_ids}`);
      console.log(`   Effective Global IDs (Admin ne diya): ${affected.effective_global_ids}`);
      console.log(`   Actual Used IDs (Commission me): ${affected.actual_used_ids}`);
      console.log(`   Expected Used IDs (Minimum): ${affected.effective_global_ids}`);
      console.log(`   Difference: ${affected.difference} IDs missing`);
      console.log(`   Daily Loss: ₹${affected.daily_loss.toFixed(2)}`);
      console.log(`   Latest Commission Date: ${affected.latest_commission_date}`);
    }

    // Group by user
    const userGroups = new Map<string, any[]>();
    for (const affected of affectedPurchases) {
      const key = affected.user_display_id;
      if (!userGroups.has(key)) {
        userGroups.set(key, []);
      }
      userGroups.get(key)!.push(affected);
    }

    console.log('\n' + '='.repeat(80));
    console.log('👥 AFFECTED USERS SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nTotal Affected Users: ${userGroups.size}\n`);

    for (const [displayId, purchases] of userGroups.entries()) {
      const totalDailyLoss = purchases.reduce((sum, p) => sum + p.daily_loss, 0);
      console.log(`\n${displayId}:`);
      console.log(`  Affected Purchases: ${purchases.length}`);
      console.log(`  Total Daily Loss: ₹${totalDailyLoss.toFixed(2)}/day`);
      console.log(`  Total Monthly Loss: ₹${(totalDailyLoss * 30).toFixed(2)}/month`);
    }
  } else {
    console.log('\n✅ No affected purchases found! All commissions are correct.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ CHECK COMPLETE');
  console.log('='.repeat(80));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
