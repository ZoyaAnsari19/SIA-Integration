/**
 * Calculate and Fix Spot Balance based on 5 Jan 2026 baseline
 * 
 * Logic:
 * 1. Get spot_balance on 5 Jan 2026 (calculated from ledger up to 5 Jan)
 * 2. Get all purchases after 5 Jan 2026 (reinvestment, renew, new)
 * 3. Calculate SPOT commissions each user should receive from these purchases
 * 4. Expected current balance = 5Jan_balance + all_SPOT_after_5Jan
 * 5. Compare with actual current balance and fix if needed
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateCommissionPaise, paiseToRupees } from '../src/utils/paise.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5442/mlm_commission?schema=public'
    }
  }
});

const CUTOFF_DATE = new Date('2026-01-05 00:00:00');

interface SpotCalculation {
  userId: bigint;
  displayId: string;
  name: string;
  spotBalance5Jan: number;
  spotCreditsAfter5Jan: number;
  spotDeductionsAfter5Jan: number;
  expectedCurrentBalance: number;
  actualCurrentBalance: number;
  difference: number;
}

async function getSpotBalanceOn5Jan(userId: bigint): Promise<number> {
  // Calculate spot balance from ledger up to 5 Jan 2026
  const spotCredits = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      OR: [
        { commission_type: 'SPOT', amount: { gt: 0 } },
        { 
          commission_type: 'ADMIN_OPS',
          metadata: { path: ['wallet_type'], equals: 'spot_balance' },
          amount: { gt: 0 }
        }
      ],
      credited_at: { lt: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
    FROM ledger_entries
    WHERE receiver_user_id = ${userId}
      AND metadata->>'spot_deducted' IS NOT NULL
      AND credited_at < ${CUTOFF_DATE}
  `;

  const adminOpsDebit = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      commission_type: 'ADMIN_OPS',
      metadata: { path: ['wallet_type'], equals: 'spot_balance' },
      amount: { lt: 0 },
      credited_at: { lt: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const credits = Number(spotCredits._sum.amount || 0);
  const deductions = Number(spotDeductions[0]?.total || 0);
  const debits = Math.abs(Number(adminOpsDebit._sum.amount || 0));

  return credits - deductions - debits;
}

async function calculateSpotFromPurchase(purchaseId: bigint): Promise<Array<{ userId: bigint; amount: number }>> {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId }
  });

  if (!purchase || purchase.status !== 'completed') {
    return [];
  }

  // Get package details
  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id }
  });

  if (!pkg) {
    return [];
  }

  const results: Array<{ userId: bigint; amount: number }> = [];

  // 1. Direct referrer SPOT (Level 0)
  const buyer = await prisma.users.findUnique({
    where: { id: purchase.user_id },
    select: { referrer_user_id: true }
  });

  if (buyer?.referrer_user_id) {
    const referrer = await prisma.users.findUnique({
      where: { id: buyer.referrer_user_id }
    });

    if (referrer) {
      // Check if referrer has active course (simplified check - at least one completed purchase)
      const referrerPurchases = await prisma.purchases.findMany({
        where: {
          user_id: buyer.referrer_user_id,
          status: 'completed'
        }
      });

      const hasActiveCourse = referrerPurchases.some((p: any) => {
        const monthlyAmount = Number(pkg.self_monthly || 0);
        const totalReceived = Number(p.income || 0);
        const totalExpected = monthlyAmount * (pkg.validity_months || 12);
        return totalReceived < totalExpected * 2;
      });

      if (hasActiveCourse && pkg.direct_spot_percent) {
        const spotPercent = Number(pkg.direct_spot_percent);
        const spotPaise = calculateCommissionPaise(Number(purchase.amount), spotPercent);
        const amount = paiseToRupees(spotPaise);
        
        results.push({
          userId: buyer.referrer_user_id,
          amount
        });
      }
    }
  }

  // 2. Team SPOT (Level 1-9) - simplified calculation
  // Get upline tree
  const uplines = await prisma.$queryRaw<Array<{ ancestor_id: bigint; depth: number }>>`
    SELECT ancestor_id, depth
    FROM user_tree_paths
    WHERE descendant_id = ${purchase.user_id}
      AND depth BETWEEN 1 AND 9
      AND ancestor_id != ${purchase.user_id}
    ORDER BY depth ASC
  `;

  for (const upline of uplines) {
    const level = upline.depth;
    const uplineUser = await prisma.users.findUnique({
      where: { id: upline.ancestor_id },
      include: { purchases: { where: { status: 'completed' } } }
    });

    if (!uplineUser) continue;

    // Check if upline has active course
    const uplinePurchases = await prisma.purchases.findMany({
      where: {
        user_id: upline.ancestor_id,
        status: 'completed'
      }
    });

    const hasActiveCourse = uplinePurchases.some((p: any) => {
      const monthlyAmount = Number(pkg.self_monthly || 0);
      const totalReceived = Number(p.income || 0);
      const totalExpected = monthlyAmount * (pkg.validity_months || 12);
      return totalReceived < totalExpected * 2;
    });

    if (!hasActiveCourse) continue;

    // Get level spot commission percent
    const levelData = await prisma.levels.findUnique({
      where: { level: level },
      select: { spot_commission_percent: true }
    });

    if (!levelData?.spot_commission_percent) continue;

    let spotPercent = Number(levelData.spot_commission_percent);

    // Check if this is reinvestment (reduces SPOT to 50%)
    const isReinvestment = purchase.is_renewal && purchase.previous_package_id !== null;
    if (isReinvestment && level >= 2) {
      spotPercent = spotPercent / 2;
    }

    const spotPaise = calculateCommissionPaise(Number(purchase.amount), spotPercent);
    const amount = paiseToRupees(spotPaise);

    results.push({
      userId: upline.ancestor_id,
      amount
    });
  }

  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 Calculate and Fix Spot Balance (5 Jan 2026 baseline)');
  console.log('='.repeat(80));
  console.log();

  try {
    // Get all users
    const users = await prisma.users.findMany({
      where: { display_id: { not: null } },
      select: { id: true, display_id: true, name: true },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Found ${users.length} users`);
    console.log();

    // Get all purchases after 5 Jan 2026
    const purchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        purchased_at: { gte: CUTOFF_DATE }
      },
      orderBy: { purchased_at: 'asc' }
    });

    console.log(`📦 Found ${purchases.length} purchases after 5 Jan 2026`);
    console.log();

    // Pre-calculate SPOT for all purchases
    console.log('🔄 Calculating SPOT commissions for all purchases...');
    const purchaseSpotMap = new Map<bigint, number>(); // userId -> total spot

    for (const purchase of purchases) {
      const spotCredits = await calculateSpotFromPurchase(purchase.id);
      for (const credit of spotCredits) {
        const current = purchaseSpotMap.get(credit.userId) || 0;
        purchaseSpotMap.set(credit.userId, current + credit.amount);
      }
      if (purchases.indexOf(purchase) % 50 === 0) {
        console.log(`   Processed ${purchases.indexOf(purchase) + 1}/${purchases.length} purchases...`);
      }
    }

    console.log(`✅ Calculated SPOT for ${purchaseSpotMap.size} users`);
    console.log();

    // Calculate expected balances
    console.log('📊 Calculating expected spot balances...');
    const calculations: SpotCalculation[] = [];

    for (const user of users) {
      const spotBalance5Jan = await getSpotBalanceOn5Jan(user.id);
      const spotCreditsAfter5Jan = purchaseSpotMap.get(user.id) || 0;
      
      // Get spot deductions after 5 Jan
      const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
        FROM ledger_entries
        WHERE receiver_user_id = ${user.id}
          AND metadata->>'spot_deducted' IS NOT NULL
          AND credited_at >= ${CUTOFF_DATE}
      `;

      const spotDeductionsAfter5Jan = Number(spotDeductions[0]?.total || 0);

      // Get admin ops spot debit after 5 Jan
      const adminOpsDebit = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: user.id,
          commission_type: 'ADMIN_OPS',
          metadata: { path: ['wallet_type'], equals: 'spot_balance' },
          amount: { lt: 0 },
          credited_at: { gte: CUTOFF_DATE }
        },
        _sum: { amount: true }
      });

      const adminOpsDebitAfter5Jan = Math.abs(Number(adminOpsDebit._sum.amount || 0));

      const expectedCurrentBalance = spotBalance5Jan + spotCreditsAfter5Jan - spotDeductionsAfter5Jan - adminOpsDebitAfter5Jan;

      // Get actual current balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: user.id },
        select: { spot_balance: true }
      });

      const actualCurrentBalance = Number(balance?.spot_balance || 0);
      const difference = actualCurrentBalance - expectedCurrentBalance;

      calculations.push({
        userId: user.id,
        displayId: user.display_id || '',
        name: user.name || '',
        spotBalance5Jan,
        spotCreditsAfter5Jan,
        spotDeductionsAfter5Jan: spotDeductionsAfter5Jan + adminOpsDebitAfter5Jan,
        expectedCurrentBalance,
        actualCurrentBalance,
        difference
      });
    }

    // Filter users with mismatch
    const mismatches = calculations.filter(c => Math.abs(c.difference) > 0.01);
    
    console.log(`⚠️  Found ${mismatches.length} users with mismatch`);
    console.log();

    // Show top 20 mismatches
    mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    console.log('Top 20 Mismatches:');
    console.log('-'.repeat(120));
    console.log('Display ID | Name | 5Jan Balance | Credits After | Deductions | Expected | Actual | Difference');
    console.log('-'.repeat(120));
    
    for (const m of mismatches.slice(0, 20)) {
      console.log(
        `${m.displayId.padEnd(12)} | ${(m.name || '').slice(0, 20).padEnd(20)} | ` +
        `${m.spotBalance5Jan.toFixed(2).padStart(12)} | ${m.spotCreditsAfter5Jan.toFixed(2).padStart(13)} | ` +
        `${m.spotDeductionsAfter5Jan.toFixed(2).padStart(11)} | ${m.expectedCurrentBalance.toFixed(2).padStart(9)} | ` +
        `${m.actualCurrentBalance.toFixed(2).padStart(7)} | ${m.difference.toFixed(2).padStart(10)}`
      );
    }
    console.log();

    // Ask for confirmation before updating
    console.log(`\n⚠️  Ready to update ${mismatches.length} users in LOCAL DB`);
    console.log('   This will set spot_balance = expectedCurrentBalance for each user');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update balances
    console.log('\n🔄 Updating spot balances...');
    let updated = 0;
    
    for (const m of mismatches) {
      await prisma.user_balances.upsert({
        where: { user_id: m.userId },
        update: {
          spot_balance: m.expectedCurrentBalance,
          balance: {
            increment: m.difference // Adjust total balance too
          },
          updated_at: new Date()
        },
        create: {
          user_id: m.userId,
          balance: m.expectedCurrentBalance,
          spot_balance: m.expectedCurrentBalance,
          other_balance: 0
        }
      });
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${mismatches.length}...`);
      }
    }

    console.log(`\n✅ Updated ${updated} users`);
    console.log();

    // Summary
    const totalDiff = mismatches.reduce((sum, m) => sum + Math.abs(m.difference), 0);
    console.log('📊 Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Users with mismatch: ${mismatches.length}`);
    console.log(`   Total absolute difference: ₹${totalDiff.toFixed(2)}`);
    console.log(`   Average difference: ₹${(totalDiff / mismatches.length).toFixed(2)}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
