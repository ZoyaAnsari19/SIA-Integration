#!/usr/bin/env tsx
/**
 * Calculate expected vs actual income for SIA00514 user's affected packages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00514';
const AFFECTED_PURCHASE_IDS = [1779, 1778, 1777]; // SIA00514's affected purchases

async function main() {
  console.log('='.repeat(80));
  console.log('💰 CALCULATING EXPECTED vs ACTUAL INCOME - SIA00514');
  console.log('='.repeat(80));

  // Get user
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('\n❌ User not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ User: ${user.display_id} (${user.name})`);

  // Get affected purchases
  const purchases = await prisma.purchases.findMany({
    where: {
      id: { in: AFFECTED_PURCHASE_IDS.map((id) => BigInt(id)) as any },
    },
  });

  // Get package details
  const packageIds = [...new Set(purchases.map((p) => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: {
      id: true,
      name: true,
      price: true,
      global_ids: true,
      self_roi_percent: true,
    },
  });

  const packageMap = new Map(packages.map((p) => [p.id, p]));

  console.log(`\n📦 Affected Purchases: ${purchases.length}`);

  const GLOBAL_MONTHLY_PER_ID = 6.25;

  console.log('\n' + '='.repeat(80));
  console.log('📊 EXPECTED vs ACTUAL INCOME ANALYSIS');
  console.log('='.repeat(80));

  let totalExpectedLoss = 0;
  let totalActualIncome = 0;
  let totalExpectedIncome = 0;

  for (const purchase of purchases) {
    const pkg = packageMap.get(purchase.package_id);
    const effectiveGlobalIds = Number((purchase as any).effective_global_ids || 0);
    const purchasedAt = purchase.purchased_at;
    const packageGlobalIds = Number(pkg?.global_ids || 0);
    const selfRoiPercent = Number(pkg?.self_roi_percent || 0);

    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'}`);
    console.log(`   Amount: ₹${purchase.amount}`);
    console.log(`   Purchased At: ${purchasedAt.toISOString().split('T')[0]}`);
    console.log(`   Effective Global IDs (Admin ne diya): ${effectiveGlobalIds}`);
    console.log(`   Package Global IDs Cap: ${packageGlobalIds}`);

    // Get all GLOBAL_HELPING commissions
    const globalCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: 'GLOBAL_HELPING',
      },
      orderBy: { credited_at: 'asc' },
    });

    // Get all SELF commissions
    const selfCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: 'SELF',
      },
      orderBy: { credited_at: 'asc' },
    });

    // Calculate actual income
    const actualGlobalIncome = globalCommissions.reduce((sum, e) => sum + Number(e.amount), 0);
    const actualSelfIncome = selfCommissions.reduce((sum, e) => sum + Number(e.amount), 0);
    const actualTotalIncome = actualGlobalIncome + actualSelfIncome;

    // Calculate expected income
    // Count days from purchase date to today (or expiry date)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Count new users who joined after purchase date
    const newUsers = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        is_renewal: false,
        purchased_at: {
          gt: purchasedAt,
          lte: today,
        },
        NOT: { user_id: user.id },
      } as any,
      select: { user_id: true },
      distinct: ['user_id'],
    });

    const newUsersCount = newUsers.length;
    const expectedUsedIds = Math.min(effectiveGlobalIds + newUsersCount, packageGlobalIds);
    const actualUsedIds = globalCommissions.length > 0 
      ? (globalCommissions[globalCommissions.length - 1].metadata as any)?.used_ids || 0
      : 0;

    // Calculate days
    const daysSincePurchase = Math.ceil(
      (today.getTime() - purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate expected daily amounts
    const daysInMonth = 31; // Approximate
    const perIdDaily = GLOBAL_MONTHLY_PER_ID / daysInMonth;
    const expectedGlobalDaily = expectedUsedIds * perIdDaily;
    const expectedGlobalTotal = expectedGlobalDaily * daysSincePurchase;

    // SELF ROI
    const selfMonthly = pkg?.price && selfRoiPercent 
      ? Number(pkg.price) * selfRoiPercent / 100 
      : 0;
    const selfDaily = selfMonthly / daysInMonth;
    const expectedSelfTotal = selfDaily * daysSincePurchase;
    const expectedTotalIncome = expectedGlobalTotal + expectedSelfTotal;

    // Loss calculation
    const loss = expectedTotalIncome - actualTotalIncome;

    console.log(`\n   📊 ACTUAL INCOME:`);
    console.log(`      GLOBAL_HELPING: ₹${actualGlobalIncome.toFixed(2)} (${globalCommissions.length} entries)`);
    console.log(`      SELF: ₹${actualSelfIncome.toFixed(2)} (${selfCommissions.length} entries)`);
    console.log(`      TOTAL: ₹${actualTotalIncome.toFixed(2)}`);

    console.log(`\n   📊 EXPECTED INCOME:`);
    console.log(`      Initial Used IDs: ${effectiveGlobalIds}`);
    console.log(`      New Users Joined: ${newUsersCount}`);
    console.log(`      Expected Used IDs: ${expectedUsedIds}`);
    console.log(`      Actual Used IDs (in commission): ${actualUsedIds}`);
    console.log(`      Days Since Purchase: ${daysSincePurchase}`);
    console.log(`      Expected GLOBAL_HELPING: ₹${expectedGlobalTotal.toFixed(2)}`);
    console.log(`      Expected SELF: ₹${expectedSelfTotal.toFixed(2)}`);
    console.log(`      Expected TOTAL: ₹${expectedTotalIncome.toFixed(2)}`);

    console.log(`\n   💰 LOSS:`);
    console.log(`      Total Loss: ₹${loss.toFixed(2)}`);
    console.log(`      Daily Loss: ₹${(loss / daysSincePurchase).toFixed(2)}/day`);

    totalActualIncome += actualTotalIncome;
    totalExpectedIncome += expectedTotalIncome;
    totalExpectedLoss += loss;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n💰 TOTAL INCOME:`);
  console.log(`   Actual Income: ₹${totalActualIncome.toFixed(2)}`);
  console.log(`   Expected Income: ₹${totalExpectedIncome.toFixed(2)}`);
  console.log(`   Total Loss: ₹${totalExpectedLoss.toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ CALCULATION COMPLETE');
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
