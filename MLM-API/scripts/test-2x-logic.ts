#!/usr/bin/env tsx

/**
 * Test 2x Investment Logic
 * 
 * Verifies:
 * 1. How 2x is tracked (SELF + GLOBAL_HELPING only)
 * 2. Whether purchase.active_until is updated when 2x is reached
 * 3. Whether commissions stop after 2x
 */

import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function checkPurchase2xStatus(purchaseId: bigint) {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId }
  });
  
  if (!purchase) {
    console.log(`❌ Purchase ${purchaseId} not found`);
    return;
  }
  
  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id }
  });
  
  const investmentAmount = Number(purchase.amount);
  const doubleTarget = investmentAmount * 2;
  
  // Get SELF + GLOBAL_HELPING commissions only
  const [selfEarned, globalEarned] = await Promise.all([
    prisma.ledger_entries.aggregate({
      where: {
        purchase_id: purchaseId,
        receiver_user_id: purchase.user_id as unknown as bigint,
        commission_type: 'SELF',
      },
      _sum: { amount: true },
    }),
    prisma.ledger_entries.aggregate({
      where: {
        purchase_id: purchaseId,
        receiver_user_id: purchase.user_id as unknown as bigint,
        commission_type: 'GLOBAL_HELPING',
      },
      _sum: { amount: true },
    }),
  ]);
  
  const selfTotal = Number(selfEarned._sum.amount || 0);
  const globalTotal = Number(globalEarned._sum.amount || 0);
  const combinedTotal = selfTotal + globalTotal;
  const isReached = combinedTotal >= doubleTarget;
  const remaining = Math.max(0, doubleTarget - combinedTotal);
  const percentage = (combinedTotal / doubleTarget) * 100;
  
  console.log(`\n📊 Purchase ${purchaseId} (${pkg?.name || 'Unknown'} - ₹${investmentAmount})`);
  console.log(`   User ID: ${purchase.user_id}`);
  console.log(`   ──────────────────────────────────────────`);
  console.log(`   Investment: ₹${investmentAmount.toFixed(2)}`);
  console.log(`   2x Target: ₹${doubleTarget.toFixed(2)}`);
  console.log(`   ──────────────────────────────────────────`);
  console.log(`   SELF earned: ₹${selfTotal.toFixed(2)}`);
  console.log(`   GLOBAL_HELPING earned: ₹${globalTotal.toFixed(2)}`);
  console.log(`   Combined (SELF + GLOBAL): ₹${combinedTotal.toFixed(2)}`);
  console.log(`   ──────────────────────────────────────────`);
  console.log(`   Progress: ${percentage.toFixed(2)}% (₹${remaining.toFixed(2)} remaining)`);
  console.log(`   Status: ${isReached ? '✅ REACHED 2x' : '⏳ Not reached yet'}`);
  console.log(`   Active Until: ${purchase.active_until.toISOString()}`);
  console.log(`   Is Expired: ${purchase.active_until < new Date() ? '✅ Yes' : '❌ No'}`);
  
  // Check scheduled commissions
  const scheduled = await prisma.scheduled_commissions.findMany({
    where: {
      purchase_id: purchaseId,
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
    }
  });
  
  console.log(`   ──────────────────────────────────────────`);
  console.log(`   Scheduled Commissions: ${scheduled.length}`);
  scheduled.forEach(sc => {
    console.log(`     - ${sc.commission_type}: ₹${Number(sc.monthly_amount)}/month, Total Credited: ₹${Number(sc.total_credited)}`);
  });
  
  // Verify using the service function
  const serviceCheck = await CommissionService.isPurchaseDoubleReached(purchaseId);
  console.log(`   ──────────────────────────────────────────`);
  console.log(`   Service Check: ${serviceCheck ? '✅ REACHED 2x' : '⏳ Not reached'}`);
  
  return {
    purchaseId,
    investmentAmount,
    doubleTarget,
    selfTotal,
    globalTotal,
    combinedTotal,
    isReached,
    percentage,
    activeUntil: purchase.active_until,
    isExpired: purchase.active_until < new Date()
  };
}

async function main() {
  console.log('🧪 Testing 2x Investment Logic');
  console.log('================================\n');
  
  try {
    // Get top 5 purchases by combined earnings
    const topPurchases = await prisma.$queryRaw<Array<{
      purchase_id: bigint;
      invested: number;
      double_target: number;
      combined_earned: number;
      percentage: number;
    }>>`
      SELECT 
        p.id as purchase_id,
        p.amount as invested,
        (p.amount * 2) as double_target,
        COALESCE(SUM(CASE WHEN le.commission_type IN ('SELF', 'GLOBAL_HELPING') THEN le.amount ELSE 0 END), 0) as combined_earned,
        (COALESCE(SUM(CASE WHEN le.commission_type IN ('SELF', 'GLOBAL_HELPING') THEN le.amount ELSE 0 END), 0) / (p.amount * 2) * 100) as percentage
      FROM purchases p
      LEFT JOIN ledger_entries le ON le.purchase_id = p.id 
        AND le.receiver_user_id = p.user_id 
        AND le.commission_type IN ('SELF', 'GLOBAL_HELPING')
      WHERE p.status = 'completed'
      GROUP BY p.id, p.amount
      ORDER BY combined_earned DESC
      LIMIT 5
    `;
    
    console.log(`Found ${topPurchases.length} top purchases:\n`);
    
    for (const purchase of topPurchases) {
      await checkPurchase2xStatus(purchase.purchase_id);
    }
    
    // Check if any purchase has reached 2x
    console.log(`\n\n🔍 Checking for purchases that reached 2x...`);
    const reached2x = await prisma.$queryRaw<Array<{
      purchase_id: bigint;
      invested: number;
      combined_earned: number;
      active_until: Date;
    }>>`
      SELECT 
        p.id as purchase_id,
        p.amount as invested,
        COALESCE(SUM(CASE WHEN le.commission_type IN ('SELF', 'GLOBAL_HELPING') THEN le.amount ELSE 0 END), 0) as combined_earned,
        p.active_until
      FROM purchases p
      LEFT JOIN ledger_entries le ON le.purchase_id = p.id 
        AND le.receiver_user_id = p.user_id 
        AND le.commission_type IN ('SELF', 'GLOBAL_HELPING')
      WHERE p.status = 'completed'
      GROUP BY p.id, p.amount, p.active_until
      HAVING COALESCE(SUM(CASE WHEN le.commission_type IN ('SELF', 'GLOBAL_HELPING') THEN le.amount ELSE 0 END), 0) >= (p.amount * 2)
    `;
    
    if (reached2x.length > 0) {
      console.log(`\n✅ Found ${reached2x.length} purchase(s) that reached 2x:`);
      for (const p of reached2x) {
        console.log(`   Purchase ${p.purchase_id}: Earned ₹${Number(p.combined_earned).toFixed(2)}, Active Until: ${p.active_until.toISOString()}`);
        const isExpired = p.active_until < new Date();
        console.log(`   ${isExpired ? '✅ Correctly expired' : '❌ NOT expired (should be expired!)'}`);
      }
    } else {
      console.log(`\n⏳ No purchases have reached 2x yet.`);
    }
    
    console.log(`\n\n📋 2x Tracking Logic Summary:`);
    console.log(`   ──────────────────────────────────────────`);
    console.log(`   1. What counts: SELF + GLOBAL_HELPING commissions only`);
    console.log(`   2. What doesn't count: SPOT, MONTHLY commissions`);
    console.log(`   3. Calculation: Combined earned >= (purchase.amount × 2)`);
    console.log(`   4. When reached: purchase.active_until updated to today`);
    console.log(`   5. Effect: Daily SELF/GLOBAL commissions stop`);
    console.log(`   ──────────────────────────────────────────`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

