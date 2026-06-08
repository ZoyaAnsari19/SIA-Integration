#!/usr/bin/env tsx
/**
 * Check user SIA00608's packages and income on production database
 * Verify if expired packages are receiving income
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00608';
  
  console.log(`\n🔍 Checking User: ${displayId} - Package Income Issue\n`);
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
    } as any,
  });
  
  // Get package names
  const packageIds = [...new Set(purchases.map(p => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true, price: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p]));
  
  console.log(`📦 Total Purchases: ${purchases.length}\n`);
  console.log('='.repeat(80));
  
  // Import CommissionService to check if purchase reached 2x
  const { CommissionService } = await import('../src/modules/commissions/commission.service.js');
  
  for (const purchase of purchases) {
    const purchaseId = purchase.id as unknown as bigint;
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchaseId);
    const investmentAmount = Number(purchase.amount);
    const currentIncome = Number((purchase as any).income || 0);
    const doubleAmount = investmentAmount * 2;
    const isExpired = isDoubleReached;
    
    const pkg = packageMap.get(purchase.package_id);
    const packageName = pkg?.name || 'N/A';
    
    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${packageName} (ID: ${purchase.package_id})`);
    console.log(`   Amount: ₹${investmentAmount.toFixed(2)}`);
    console.log(`   Income: ₹${currentIncome.toFixed(2)}`);
    console.log(`   2x Target: ₹${doubleAmount.toFixed(2)}`);
    console.log(`   Progress: ${((currentIncome / doubleAmount) * 100).toFixed(2)}%`);
    console.log(`   Purchased At: ${purchase.purchased_at}`);
    console.log(`   Is Renewal: ${purchase.is_renewal || false}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRED (reached 2x)' : '✅ ACTIVE (not reached 2x)'}`);
    
    // Check recent commissions for this purchase
    console.log(`\n   💰 Recent Commissions (Last 7 Days):`);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        credited_at: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { credited_at: 'desc' },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
      },
    });
    
    if (recentCommissions.length > 0) {
      console.log(`      Found ${recentCommissions.length} commission entries:`);
      
      const byType = recentCommissions.reduce((acc, comm) => {
        const type = comm.commission_type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(comm);
        return acc;
      }, {} as Record<string, typeof recentCommissions>);
      
      for (const [type, entries] of Object.entries(byType)) {
        const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
        console.log(`      - ${type}: ${entries.length} entries, Total: ₹${total.toFixed(2)}`);
        
        if (isExpired && type === 'MONTHLY') {
          console.log(`        ⚠️  WARNING: EXPIRED package receiving MONTHLY commissions!`);
          console.log(`        ⚠️  This should NOT happen - expired packages should not get MONTHLY income`);
        }
        
        // Show latest 3 entries
        for (const entry of entries.slice(0, 3)) {
          console.log(`          • ₹${Number(entry.amount).toFixed(2)} on ${entry.credited_at.toISOString()}`);
        }
      }
    } else {
      console.log(`      ⚠️ No commissions in last 7 days`);
      if (isExpired) {
        console.log(`      ℹ️ Reason: Purchase expired (reached 2x)`);
      }
    }
    
    // Check all-time commission summary
    const allCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
      },
      select: {
        commission_type: true,
        amount: true,
      },
    });
    
    const allByType = allCommissions.reduce((acc, comm) => {
      const type = comm.commission_type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += Number(comm.amount);
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n   📊 All-Time Commission Summary:`);
    for (const [type, total] of Object.entries(allByType)) {
      console.log(`      - ${type}: ₹${total.toFixed(2)}`);
    }
    
    // Check if expired package is receiving income
    if (isExpired) {
      const expiredCommissions = await prisma.ledger_entries.findMany({
        where: {
          purchase_id: purchaseId,
          credited_at: {
            gt: new Date(purchase.purchased_at.getTime() + (currentIncome >= doubleAmount ? 0 : 86400000)), // After purchase or after reaching 2x
          },
        },
        select: {
          commission_type: true,
          amount: true,
          credited_at: true,
        },
        orderBy: { credited_at: 'desc' },
        take: 10,
      });
      
      if (expiredCommissions.length > 0) {
        console.log(`\n   ⚠️  EXPIRED PACKAGE RECEIVING INCOME:`);
        const expiredByType = expiredCommissions.reduce((acc, comm) => {
          const type = comm.commission_type;
          if (!acc[type]) acc[type] = { count: 0, total: 0 };
          acc[type].count++;
          acc[type].total += Number(comm.amount);
          return acc;
        }, {} as Record<string, { count: number; total: number }>);
        
        for (const [type, data] of Object.entries(expiredByType)) {
          console.log(`      - ${type}: ${data.count} entries, Total: ₹${data.total.toFixed(2)}`);
          if (type === 'MONTHLY') {
            console.log(`        ❌ BUG: Expired package should NOT receive MONTHLY commissions!`);
          }
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Check Complete\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);

