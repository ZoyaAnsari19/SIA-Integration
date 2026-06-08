#!/usr/bin/env tsx
import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  const displayId = 'SIA00835';
  
  console.log(`\n🔍 Checking User: ${displayId} - Global IDs Issue\n`);
  console.log('='.repeat(80));
  
  // Find user
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { 
      id: true, 
      name: true, 
      display_id: true,
      is_disqualified: true,
    },
  });
  
  if (!user) {
    console.log(`❌ User ${displayId} not found`);
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User found:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Display ID: ${user.display_id}`);
  console.log(`   Disqualified: ${user.is_disqualified || false}`);
  console.log('');
  
  // Get all purchases
  const purchases = await prisma.purchases.findMany({
    where: { 
      user_id: user.id,
      status: 'completed',
    },
    orderBy: { purchased_at: 'desc' },
    select: {
      id: true,
      package_id: true,
      amount: true,
      purchased_at: true,
      status: true,
      income: true,
      is_renewal: true,
      previous_package_id: true,
      effective_global_ids: true,
      is_manual: true,
    } as any,
  });
  
  // Get package names
  const packageIds = [...new Set(purchases.map(p => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true, global_ids: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p]));
  
  console.log(`📦 Total Purchases: ${purchases.length}\n`);
  console.log('='.repeat(80));
  
  for (const purchase of purchases) {
    const purchaseId = purchase.id as unknown as bigint;
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchaseId);
    const investmentAmount = Number(purchase.amount);
    const currentIncome = Number((purchase as any).income || 0);
    const doubleAmount = investmentAmount * 2;
    const isExpired = isDoubleReached;
    
    const pkg = packageMap.get(purchase.package_id);
    const packageName = pkg?.name || 'N/A';
    const packageGlobalIds = pkg?.global_ids || 0;
    
    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${packageName} (ID: ${purchase.package_id})`);
    console.log(`   Amount: ₹${investmentAmount.toFixed(2)}`);
    console.log(`   Income: ₹${currentIncome.toFixed(2)}`);
    console.log(`   2x Target: ₹${doubleAmount.toFixed(2)}`);
    console.log(`   Progress: ${((currentIncome / doubleAmount) * 100).toFixed(2)}%`);
    console.log(`   Purchased At: ${purchase.purchased_at}`);
    console.log(`   Is Renewal: ${purchase.is_renewal || false}`);
    console.log(`   Previous Package ID: ${purchase.previous_package_id || 'N/A'}`);
    console.log(`   Is Manual: ${purchase.is_manual || false}`);
    console.log(`   Effective Global IDs: ${purchase.effective_global_ids !== null ? purchase.effective_global_ids : 'NULL'}`);
    console.log(`   Package Global IDs Cap: ${packageGlobalIds}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRED (reached 2x)' : '✅ ACTIVE (not reached 2x)'}`);
    
    // Get Global IDs Info
    if (!isExpired) {
      console.log(`\n   📊 Global IDs Calculation:`);
      try {
        const globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(purchaseId, user.id);
        if (globalIdsInfo) {
          console.log(`      Used IDs: ${globalIdsInfo.used_ids}`);
          console.log(`      Remaining IDs: ${globalIdsInfo.remaining_ids}`);
          console.log(`      Total Global Users: ${globalIdsInfo.used_ids}`);
          console.log(`      Cap Reached: ${globalIdsInfo.is_cap_reached ? '✅ YES' : '❌ NO'}`);
          if (globalIdsInfo.new_ids_after_cap !== null) {
            console.log(`      New IDs After Cap: ${globalIdsInfo.new_ids_after_cap}`);
          }
        } else {
          console.log(`      ⚠️ Could not calculate Global IDs info`);
        }
      } catch (error: any) {
        console.log(`      ❌ Error calculating Global IDs: ${error.message}`);
      }
    } else {
      console.log(`\n   ⚠️ Purchase expired - Global IDs calculation skipped`);
    }
    
    // Check recent first purchases that should be counted
    console.log(`\n   🔍 Checking Recent First Purchases (Last 7 Days):`);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Determine start date for counting
    let startDate: Date;
    if (purchase.is_renewal && purchase.previous_package_id) {
      const firstPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: user.id,
          package_id: purchase.previous_package_id,
          status: 'completed',
        },
        orderBy: { purchased_at: 'asc' },
        select: { purchased_at: true },
      });
      startDate = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase.purchased_at);
    } else {
      startDate = new Date(purchase.purchased_at);
    }
    
    const nowForQuery = new Date();
    nowForQuery.setHours(23, 59, 59, 999);
    
    const recentFirstPurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        is_renewal: false,
        purchased_at: { 
          gt: startDate,
          lte: nowForQuery,
          gte: sevenDaysAgo, // Last 7 days
        },
        NOT: { user_id: user.id },
      } as any,
      select: {
        id: true,
        user_id: true,
        package_id: true,
        purchased_at: true,
      },
      distinct: ['user_id'],
      orderBy: { purchased_at: 'desc' },
      take: 10,
    });
    
    const totalFirstPurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        is_renewal: false,
        purchased_at: { 
          gt: startDate,
          lte: nowForQuery,
        },
        NOT: { user_id: user.id },
      } as any,
      select: { user_id: true },
      distinct: ['user_id'],
    });
    
    console.log(`      Start Date for counting: ${startDate.toISOString()}`);
    console.log(`      Total First Purchases (since start): ${totalFirstPurchases.length}`);
    console.log(`      Recent First Purchases (last 7 days): ${recentFirstPurchases.length}`);
    
    if (recentFirstPurchases.length > 0) {
      console.log(`\n      Recent First Purchases:`);
      for (const fp of recentFirstPurchases) {
        const fpUser = await prisma.users.findUnique({
          where: { id: fp.user_id },
          select: { display_id: true, name: true },
        });
        const fpPkg = packageMap.get(fp.package_id);
        console.log(`        - ${fpUser?.display_id || fp.user_id} (${fpUser?.name || 'N/A'}) - ${fpPkg?.name || 'N/A'} - ${fp.purchased_at.toISOString()}`);
      }
    } else {
      console.log(`      ⚠️ No new first purchases in last 7 days`);
    }
    
    // Check if cap is reached
    const usedIds = totalFirstPurchases.length;
    const packageCap = Number(packageGlobalIds) || 0;
    const isCapReached = packageCap > 0 && usedIds >= packageCap;
    
    console.log(`\n   📊 Cap Analysis:`);
    console.log(`      Used IDs: ${usedIds}`);
    console.log(`      Package Cap: ${packageCap}`);
    console.log(`      Cap Reached: ${isCapReached ? '✅ YES (this is why count is stuck)' : '❌ NO'}`);
    if (isCapReached) {
      console.log(`      ⚠️ Cap reached - Global IDs count won't increase beyond ${packageCap}`);
      console.log(`      ⚠️ Commission will be capped at ${packageCap} IDs`);
    }
    
    // Check recent GLOBAL_HELPING commissions
    console.log(`\n   💰 Recent GLOBAL_HELPING Commissions (Last 7 Days):`);
    const recentGlobalCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        commission_type: 'GLOBAL_HELPING',
        credited_at: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { credited_at: 'desc' },
      select: {
        id: true,
        amount: true,
        credited_at: true,
        metadata: true,
      },
      take: 5,
    });
    
    if (recentGlobalCommissions.length > 0) {
      console.log(`      Found ${recentGlobalCommissions.length} GLOBAL_HELPING entries:`);
      for (const entry of recentGlobalCommissions) {
        const metadata = entry.metadata as any || {};
        const usedIds = metadata.used_ids || 'N/A';
        const packageCap = metadata.package_cap || 'N/A';
        console.log(`        - ₹${Number(entry.amount).toFixed(2)} on ${entry.credited_at.toISOString()}`);
        console.log(`          Used IDs: ${usedIds}, Package Cap: ${packageCap}`);
      }
    } else {
      console.log(`      ⚠️ No GLOBAL_HELPING commissions in last 7 days`);
      if (isExpired) {
        console.log(`      ℹ️ Reason: Purchase expired (reached 2x)`);
      } else if (isCapReached) {
        console.log(`      ℹ️ Reason: Cap reached (used IDs = ${usedIds} >= cap = ${packageCap})`);
      } else {
        console.log(`      ⚠️ This might be an issue - check daily commission job logs`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Check Complete\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);

