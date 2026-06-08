import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { isUserActive } from '../src/utils/business.js';

const prisma = new PrismaClient();

interface MissingRoyaltyCase {
  referrer_id: string;
  referrer_name: string;
  referrer_display_id: string;
  referrer_email: string;
  referrer_has_active_package: boolean;
  buyer_id: string;
  buyer_name: string;
  buyer_display_id: string;
  buyer_has_active_package: boolean;
  purchase_id: string;
  purchase_date: string;
  purchase_amount: number;
  package_recurring_rate: number;
  expected_monthly_royalty: number;
  actual_monthly_royalty_received: number;
  purchase_2x_reached: boolean;
  days_since_purchase: number;
  reason: string;
}

async function checkActualMissingRoyalty() {
  console.log('🔍 Checking ACTUAL Missing Monthly Royalty (18 Dec 2025 - 23 Dec 2025)...\n');
  console.log('Note: This checks what actually happened (before fix), not what should happen.\n');

  // Date range: 18 Dec 2025 to 23 Dec 2025
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');
  const today = new Date();

  console.log(`📅 Purchase Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  // Get all purchases in this date range
  const purchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      purchased_at: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      purchased_at: true,
      income: true,
    } as any,
    orderBy: {
      purchased_at: 'asc',
    },
  });

  console.log(`✅ Found ${purchases.length} purchases in date range\n`);

  if (purchases.length === 0) {
    console.log('No purchases found in this date range.\n');
    return;
  }

  // Get all packages for recurring_rate_percent
  const packageIds = Array.from(new Set(purchases.map((p) => p.package_id)));
  const packages = await prisma.packages.findMany({
    where: {
      id: { in: packageIds },
    },
    select: {
      id: true,
      recurring_rate_percent: true,
    },
  });
  const packageMap = new Map(
    packages.map((p) => [p.id, Number(p.recurring_rate_percent || 0)])
  );

  // Get all buyer user IDs
  const buyerIds = Array.from(new Set(purchases.map((p) => p.user_id as unknown as bigint)));

  // Get buyer users with referrers
  const buyerUsers = await prisma.users.findMany({
    where: {
      id: { in: buyerIds },
      referrer_user_id: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      display_id: true,
      referrer_user_id: true,
    },
  });

  if (buyerUsers.length === 0) {
    console.log('No buyers with referrers found.\n');
    return;
  }

  // Get all referrer user IDs
  const referrerIds = Array.from(
    new Set(
      buyerUsers.map((u) => u.referrer_user_id as unknown as bigint)
    )
  );

  // Get referrer users
  const referrerUsers = await prisma.users.findMany({
    where: {
      id: { in: referrerIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      display_id: true,
    },
  });
  const referrerUserMap = new Map(
    referrerUsers.map((u) => [u.id.toString(), u])
  );
  const buyerUserMap = new Map(
    buyerUsers.map((u) => [u.id.toString(), u])
  );

  // Check active packages for all users
  const allUserIds = [...buyerIds, ...referrerIds];
  const allPurchases = await prisma.purchases.findMany({
    where: {
      user_id: { in: allUserIds },
      status: 'completed',
    },
    select: {
      id: true,
      user_id: true,
      amount: true,
      income: true,
    } as any,
  });

  const usersWithActivePackages = new Set<string>();
  for (const purchase of allPurchases) {
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(
      purchase.id as unknown as bigint
    );
    if (!isDoubleReached) {
      usersWithActivePackages.add(purchase.user_id.toString());
    }
  }

  const missingRoyaltyCases: MissingRoyaltyCase[] = [];

  // Process each purchase
  for (const purchase of purchases) {
    const buyerId = purchase.user_id.toString();
    const buyer = buyerUserMap.get(buyerId);

    if (!buyer || !buyer.referrer_user_id) {
      continue; // No referrer
    }

    const referrerId = buyer.referrer_user_id.toString();
    const referrer = referrerUserMap.get(referrerId);

    if (!referrer) {
      continue;
    }

    // Check if purchase reached 2x
    const isPurchase2x = await CommissionService.isPurchaseDoubleReached(
      purchase.id as unknown as bigint
    );

    // Check if buyer has active package
    const buyerHasActivePackage = usersWithActivePackages.has(buyerId);

    // Check if referrer has active package
    const referrerHasActivePackage = usersWithActivePackages.has(referrerId);

    // Get package recurring rate
    const recurringRate = packageMap.get(purchase.package_id) || 0.5; // Default 0.5%
    const expectedMonthly = (Number(purchase.amount) * recurringRate) / 100;

    // Get actual monthly royalty received for this purchase (from 18 Dec onwards)
    const monthlyRoyaltyEntries = await prisma.ledger_entries.findMany({
      where: {
        receiver_user_id: BigInt(referrerId),
        source_user_id: BigInt(buyerId),
        purchase_id: purchase.id as unknown as bigint,
        commission_type: 'MONTHLY',
        credited_at: {
          gte: startDate, // Only count from 18 Dec onwards
        },
      },
      select: {
        amount: true,
        credited_at: true,
      },
    });

    const actualMonthlyRoyalty = monthlyRoyaltyEntries.reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0
    );

    // Calculate days since purchase
    const daysSincePurchase = Math.floor(
      (today.getTime() - purchase.purchased_at.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine reason for missing royalty
    let reason = '';
    if (isPurchase2x) {
      reason = 'Purchase reached 2x (buyer has no active course)';
    } else if (!referrerHasActivePackage) {
      reason = 'Referrer has no active package';
    } else if (!buyerHasActivePackage) {
      reason = 'Buyer has no active package';
    } else if (actualMonthlyRoyalty === 0) {
      reason = 'Monthly royalty NOT credited (code issue - Level 0 eligibility check failed)';
    } else {
      reason = 'Royalty received';
    }

    // Only add if royalty is missing or less than expected
    if (actualMonthlyRoyalty === 0 && expectedMonthly > 0 && !isPurchase2x && referrerHasActivePackage && buyerHasActivePackage) {
      missingRoyaltyCases.push({
        referrer_id: referrerId,
        referrer_name: referrer.name || 'N/A',
        referrer_email: referrer.email || 'N/A',
        referrer_display_id: referrer.display_id || 'N/A',
        referrer_has_active_package: referrerHasActivePackage,
        buyer_id: buyerId,
        buyer_name: buyer.name || 'N/A',
        buyer_display_id: buyer.display_id || 'N/A',
        buyer_has_active_package: buyerHasActivePackage,
        purchase_id: purchase.id.toString(),
        purchase_amount: Number(purchase.amount),
        purchase_date: purchase.purchased_at.toISOString().split('T')[0],
        package_recurring_rate: recurringRate,
        expected_monthly_royalty: expectedMonthly,
        actual_monthly_royalty_received: actualMonthlyRoyalty,
        purchase_2x_reached: isPurchase2x,
        days_since_purchase: daysSincePurchase,
        reason,
      });
    }
  }

  console.log('📊 Summary:\n');
  console.log(`   Total purchases checked: ${purchases.length}`);
  console.log(`   Purchases with referrers: ${buyerUsers.length}`);
  console.log(`   Missing monthly royalty cases (due to code issue): ${missingRoyaltyCases.length}\n`);

  // Group by reason
  const byReason = new Map<string, number>();
  missingRoyaltyCases.forEach((u) => {
    const count = byReason.get(u.reason) || 0;
    byReason.set(u.reason, count + 1);
  });

  console.log('📋 Breakdown by Reason:\n');
  byReason.forEach((count, reason) => {
    console.log(`   ${reason}: ${count} cases`);
  });

  // Calculate total missing amount
  const totalMissingAmount = missingRoyaltyCases.reduce(
    (sum, u) => sum + u.expected_monthly_royalty,
    0
  );

  // Calculate estimated missing amount (based on days since purchase)
  const estimatedMissingAmount = missingRoyaltyCases.reduce((sum, u) => {
    // Estimate: daily amount × days since purchase
    const dailyAmount = u.expected_monthly_royalty / 30; // Approximate
    const estimated = dailyAmount * Math.min(u.days_since_purchase, 30); // Max 1 month
    return sum + estimated;
  }, 0);

  console.log('\n💰 Financial Impact:\n');
  console.log(`   Expected Monthly Royalty (per month): ₹${totalMissingAmount.toFixed(2)}`);
  console.log(`   Estimated Missing Amount (till today): ₹${estimatedMissingAmount.toFixed(2)}`);
  console.log(`   Days since first purchase: ${Math.max(...missingRoyaltyCases.map(u => u.days_since_purchase), 0)} days\n`);

  console.log('\n' + '='.repeat(100));
  console.log('❌ Missing Monthly Royalty Cases (Code Issue - Before Fix):\n');

  // Show all cases
  for (const user of missingRoyaltyCases) {
    console.log(`\n🔴 Referrer: ${user.referrer_name} (${user.referrer_display_id})`);
    console.log(`   Email: ${user.referrer_email}`);
    console.log(`   Has Active Package: ${user.referrer_has_active_package ? '✅' : '❌'}`);
    console.log(`   Buyer: ${user.buyer_name} (${user.buyer_display_id})`);
    console.log(`   Buyer Has Active Package: ${user.buyer_has_active_package ? '✅' : '❌'}`);
    console.log(`   Purchase ID: ${user.purchase_id}`);
    console.log(`   Purchase Date: ${user.purchase_date}`);
    console.log(`   Days Since Purchase: ${user.days_since_purchase} days`);
    console.log(`   Purchase Amount: ₹${user.purchase_amount.toFixed(2)}`);
    console.log(`   Package Recurring Rate: ${user.package_recurring_rate}%`);
    console.log(`   Expected Monthly Royalty: ₹${user.expected_monthly_royalty.toFixed(2)}/month`);
    console.log(`   Actually Received: ₹${user.actual_monthly_royalty_received.toFixed(2)}`);
    console.log(`   Purchase 2x Reached: ${user.purchase_2x_reached ? '✅ Yes' : '❌ No'}`);
    console.log(`   Reason: ${user.reason}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log(`\n📝 Total Missing Monthly Royalty Cases (Code Issue): ${missingRoyaltyCases.length}\n`);
  console.log(`✅ Fix Applied: Level 0 eligibility check now skipped\n`);
  console.log(`📅 Next Steps: Run daily commission job to credit missing royalties\n`);
}

async function main() {
  try {
    await checkActualMissingRoyalty();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

