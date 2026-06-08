/**
 * Fix Spot Balance based on 13 Jan 2026 baseline + Purchases after 13 Jan
 * 
 * Logic:
 * 1. Get spot_balance on 13 Jan 2026 (from backup or calculate from ledger)
 * 2. Find all purchases (new, reinvestment, renew) after 13 Jan 2026
 * 3. Calculate SPOT commissions each user should receive from these purchases
 * 4. Expected current balance = 13Jan_balance + all_SPOT_after_13Jan
 * 5. Update user_balances.spot_balance in local DB
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateCommissionPaise, paiseToRupees } from '../src/utils/paise.js';
import { isUserActive, getUplines, checkEligibility } from '../src/utils/business.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5442/mlm_commission?schema=public'
    }
  }
});

const CUTOFF_DATE = new Date('2026-01-13 23:59:59');

interface SpotCalculation {
  userId: bigint;
  displayId: string;
  name: string;
  spotBalance13Jan: number;
  spotCreditsFromPurchases: number;
  expectedCurrentBalance: number;
  actualCurrentBalance: number;
  difference: number;
}

async function getSpotBalanceOn13Jan(userId: bigint): Promise<number> {
  // Calculate spot balance from ledger up to 13 Jan 2026
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
      credited_at: { lte: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
    FROM ledger_entries
    WHERE receiver_user_id = ${userId}
      AND metadata->>'spot_deducted' IS NOT NULL
      AND credited_at <= ${CUTOFF_DATE}
  `;

  const adminOpsDebit = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      commission_type: 'ADMIN_OPS',
      metadata: { path: ['wallet_type'], equals: 'spot_balance' },
      amount: { lt: 0 },
      credited_at: { lte: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const credits = Number(spotCredits._sum.amount || 0);
  const deductions = Number(spotDeductions[0]?.total || 0);
  const debits = Math.abs(Number(adminOpsDebit._sum.amount || 0));

  return credits - deductions - debits;
}

async function isReinvestment(purchaseId: bigint, userId: bigint): Promise<boolean> {
  // Check if user has any previous completed purchases
  const previousPurchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      id: { not: purchaseId },
      status: 'completed'
    },
    orderBy: { purchased_at: 'desc' },
    take: 1
  });
  
  return previousPurchases.length > 0;
}

async function hasActiveCourse(userId: bigint, date: Date): Promise<boolean> {
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      status: 'completed'
    }
  });

  for (const purchase of purchases) {
    const pkg = await prisma.packages.findUnique({ where: { id: purchase.package_id } });
    if (!pkg) continue;

    const totalEarned = await prisma.ledger_entries.aggregate({
      where: {
        receiver_user_id: userId,
        purchase_id: purchase.id,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
        amount: { gt: 0 }
      },
      _sum: { amount: true }
    });

    const totalEarnedAmount = Number(totalEarned._sum.amount || 0);
    const twoXInvestment = Number(purchase.amount) * 2;

    if (totalEarnedAmount < twoXInvestment) {
      return true; // Has at least one active course
    }
  }

  return false; // No active courses
}

async function calculateSpotFromPurchases(userId: bigint, purchases: any[]): Promise<number> {
  let totalSpot = 0;

  for (const purchase of purchases) {
    const buyerId = purchase.user_id as unknown as bigint;
    const pkg = await prisma.packages.findUnique({ where: { id: purchase.package_id } });
    if (!pkg) continue;

    // Get buyer's referrer
    const buyer = await prisma.users.findUnique({
      where: { id: buyerId },
      select: { referrer_user_id: true }
    });

    if (!buyer?.referrer_user_id) continue;

    const referrerId = buyer.referrer_user_id as unknown as bigint;

    // Check if this purchase should give SPOT to userId
    // 1. Direct referrer SPOT (Level 0)
    if (referrerId === userId) {
      const referrerHasActive = await hasActiveCourse(referrerId, new Date());
      if (referrerHasActive && pkg.direct_spot_percent) {
        const spotPercent = Number(pkg.direct_spot_percent);
        const spotPaise = calculateCommissionPaise(Number(purchase.amount), spotPercent);
        const spotAmount = paiseToRupees(spotPaise);
        totalSpot += spotAmount;
      }
    }

    // 2. Team SPOT (Level 1-9)
    const uplines = await getUplines(buyerId, 9);
    const isReinvest = await isReinvestment(purchase.id as unknown as bigint, buyerId);

    for (const { ancestor_id, depth } of uplines) {
      if (ancestor_id !== userId) continue;
      if (depth <= 1) continue; // Direct referrer already handled

      const levelForCommission = depth - 1;
      const eligible = await checkEligibility(ancestor_id, levelForCommission);
      if (!eligible) continue;

      const uplineHasActive = await hasActiveCourse(ancestor_id, new Date());
      if (!uplineHasActive) continue;

      // Get spot percent from levels table
      const levelData = await prisma.levels.findUnique({ where: { level: levelForCommission } });
      let spotPercent = 0;
      
      if (levelData?.spot_commission_percent) {
        spotPercent = Number(levelData.spot_commission_percent);
      } else {
        const spotRule = await prisma.commission_rules.findFirst({ 
          where: { type: 'LEVEL_SPOT', level: levelForCommission } 
        });
        spotPercent = Number(spotRule?.percent ?? 0);
      }

      if (spotPercent > 0) {
        let teamSpotAmount = (Number(purchase.amount) * spotPercent) / 100;

        // Apply 50% reduction for Level 1+ (depth 2+) on reinvestments
        if (isReinvest && depth >= 2) {
          teamSpotAmount = teamSpotAmount * 0.5;
        }

        totalSpot += teamSpotAmount;
      }
    }
  }

  return totalSpot;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 Fix Spot Balance (13 Jan 2026 baseline + Purchases after 13 Jan)');
  console.log('='.repeat(80));
  console.log();

  try {
    // Get all purchases after 13 Jan 2026 (fetch once, use for all users)
    console.log('📦 Fetching purchases after 13 Jan 2026...');
    const allPurchases = await prisma.purchases.findMany({
      where: {
        purchased_at: { gt: CUTOFF_DATE },
        status: 'completed'
      },
      orderBy: { purchased_at: 'asc' }
    });
    console.log(`✅ Found ${allPurchases.length} purchases after 13 Jan 2026`);
    console.log();

    // Get all users
    const users = await prisma.users.findMany({
      where: { display_id: { not: null } },
      select: { id: true, display_id: true, name: true },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Found ${users.length} users`);
    console.log();

    // Calculate expected balances
    console.log('📊 Calculating expected spot balances...');
    const calculations: SpotCalculation[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      if (i % 100 === 0) {
        console.log(`   Processing ${i + 1}/${users.length}...`);
      }

      const spotBalance13Jan = await getSpotBalanceOn13Jan(user.id);
      const spotCreditsFromPurchases = await calculateSpotFromPurchases(user.id, allPurchases);
      
      const currentBalance = await prisma.user_balances.findUnique({
        where: { user_id: user.id },
        select: { spot_balance: true }
      });

      const actualCurrentBalance = Number(currentBalance?.spot_balance || 0);
      const expectedCurrentBalance = spotBalance13Jan + spotCreditsFromPurchases;
      const difference = expectedCurrentBalance - actualCurrentBalance;

      if (Math.abs(difference) > 0.01) { // Only include if difference > 1 paisa
        calculations.push({
          userId: user.id,
          displayId: user.display_id || '',
          name: user.name || '',
          spotBalance13Jan,
          spotCreditsFromPurchases,
          expectedCurrentBalance,
          actualCurrentBalance,
          difference
        });
      }
    }

    console.log(`\n✅ Calculated expected balances for ${users.length} users`);
    console.log(`📊 Found ${calculations.length} users with mismatches`);
    console.log();

    if (calculations.length === 0) {
      console.log('✅ No mismatches found! All balances are correct.');
      return;
    }

    // Show top 30 mismatches
    calculations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    console.log('Top 30 Mismatches:');
    console.log('-'.repeat(140));
    console.log('Display ID | Name | 13Jan Balance | Purchases SPOT | Expected | Actual | Difference');
    console.log('-'.repeat(140));
    
    for (const calc of calculations.slice(0, 30)) {
      console.log(
        `${calc.displayId.padEnd(10)} | ${(calc.name || '').substring(0, 20).padEnd(20)} | ` +
        `₹${calc.spotBalance13Jan.toFixed(2).padStart(10)} | ` +
        `₹${calc.spotCreditsFromPurchases.toFixed(2).padStart(10)} | ` +
        `₹${calc.expectedCurrentBalance.toFixed(2).padStart(10)} | ` +
        `₹${calc.actualCurrentBalance.toFixed(2).padStart(10)} | ` +
        `₹${calc.difference.toFixed(2).padStart(10)}`
      );
    }

    console.log();
    const totalDiff = calculations.reduce((sum, c) => sum + Math.abs(c.difference), 0);
    console.log(`📊 Total absolute difference: ₹${totalDiff.toFixed(2)}`);
    console.log();

    // Ask for confirmation
    console.log('⚠️  About to update spot_balance for all users with mismatches...');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update balances
    let updated = 0;
    
    for (const calc of calculations) {
      const currentBalance = await prisma.user_balances.findUnique({
        where: { user_id: calc.userId },
        select: { balance: true, other_balance: true }
      });

      const currentTotal = Number(currentBalance?.balance || 0);
      const currentOther = Number(currentBalance?.other_balance || 0);
      
      // New total = other_balance (unchanged) + new spot_balance
      const newTotal = currentOther + calc.expectedCurrentBalance;
      const totalDiff = newTotal - currentTotal;

      await prisma.user_balances.update({
        where: { user_id: calc.userId },
        data: {
          spot_balance: calc.expectedCurrentBalance,
          balance: newTotal,
          updated_at: new Date()
        }
      });
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${calculations.length}...`);
      }
    }

    console.log(`\n✅ Updated ${updated} users`);
    console.log();

    // Final summary
    console.log('📊 Final Summary:');
    console.log(`   Total users processed: ${users.length}`);
    console.log(`   Users corrected: ${updated}`);
    console.log(`   Total absolute difference corrected: ₹${totalDiff.toFixed(2)}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
