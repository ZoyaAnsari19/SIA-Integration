import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { isUserActive, getUplines } from '../src/utils/business.js';

const prisma = new PrismaClient();

async function verifyAllMissingCredited() {
  console.log('🔍 Verifying All Missing Monthly Royalty Credits (18-23 Dec 2025)...\n');

  // Date range: 18 Dec 2025 to 23 Dec 2025
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  // Get all packages
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
    packages.map((p) => [p.id, p])
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
      display_id: true,
      email: true,
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

  interface MissingCase {
    referrer_id: string;
    referrer_name: string;
    referrer_display_id: string;
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

  const missingCases: MissingCase[] = [];
  const creditedCases: MissingCase[] = [];

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
    const pkg = packageMap.get(purchase.package_id);
    if (!pkg) continue;

    const recurringRate = Number(pkg.recurring_rate_percent) || 0.5; // Default 0.5%
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

    // Determine reason
    let reason = '';
    if (isPurchase2x) {
      reason = 'Purchase reached 2x (buyer has no active course)';
    } else if (!referrerHasActivePackage) {
      reason = 'Referrer has no active package';
    } else if (!buyerHasActivePackage) {
      reason = 'Buyer has no active package';
    } else if (actualMonthlyRoyalty === 0) {
      reason = 'Monthly royalty NOT credited (code issue)';
    } else {
      reason = 'Royalty received';
    }

    const caseData: MissingCase = {
      referrer_id: referrerId,
      referrer_name: referrer.name || 'N/A',
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
    };

    // Only add if royalty is missing or less than expected
    if (actualMonthlyRoyalty === 0 && expectedMonthly > 0 && !isPurchase2x && referrerHasActivePackage && buyerHasActivePackage) {
      missingCases.push(caseData);
    } else if (actualMonthlyRoyalty > 0 && !isPurchase2x && referrerHasActivePackage && buyerHasActivePackage) {
      creditedCases.push(caseData);
    }
  }

  console.log('='.repeat(100));
  console.log('📊 VERIFICATION SUMMARY:\n');
  console.log(`   Total Purchases Checked: ${purchases.length}`);
  console.log(`   Purchases with Referrers: ${buyerUsers.length}`);
  console.log(`   Missing Monthly Royalty Cases: ${missingCases.length}`);
  console.log(`   Credited Monthly Royalty Cases: ${creditedCases.length}\n`);

  // Group missing cases by referrer
  const missingByReferrer = new Map<string, { count: number; total: number; referrer: any }>();
  missingCases.forEach((c) => {
    const existing = missingByReferrer.get(c.referrer_id) || {
      count: 0,
      total: 0,
      referrer: referrerUserMap.get(c.referrer_id),
    };
    existing.count += 1;
    existing.total += c.expected_monthly_royalty;
    missingByReferrer.set(c.referrer_id, existing);
  });

  // Group credited cases by referrer
  const creditedByReferrer = new Map<string, { count: number; total: number; referrer: any }>();
  creditedCases.forEach((c) => {
    const existing = creditedByReferrer.get(c.referrer_id) || {
      count: 0,
      total: 0,
      referrer: referrerUserMap.get(c.referrer_id),
    };
    existing.count += 1;
    existing.total += c.actual_monthly_royalty_received;
    creditedByReferrer.set(c.referrer_id, existing);
  });

  if (missingCases.length > 0) {
    console.log('❌ STILL MISSING MONTHLY ROYALTY:\n');
    console.log('   Top Missing Users:\n');
    const sortedMissing = Array.from(missingByReferrer.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    for (const [referrerId, data] of sortedMissing) {
      const referrer = data.referrer;
      console.log(`   - ${referrer?.name || 'N/A'} (${referrer?.display_id || 'N/A'})`);
      console.log(`     Missing: ${data.count} purchases, ₹${data.total.toFixed(2)}/month expected`);
    }
  } else {
    console.log('✅ ALL MISSING MONTHLY ROYALTIES HAVE BEEN CREDITED!\n');
  }

  console.log('\n✅ CREDITED USERS SUMMARY:\n');
  const sortedCredited = Array.from(creditedByReferrer.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  console.log(`   Total Users Credited: ${creditedByReferrer.size}`);
  console.log(`   Total Amount Credited: ₹${Array.from(creditedByReferrer.values()).reduce((sum, d) => sum + d.total, 0).toFixed(2)}\n`);

  if (sortedCredited.length > 0) {
    console.log('   Top Credited Users:\n');
    for (const [referrerId, data] of sortedCredited) {
      const referrer = data.referrer;
      console.log(`   - ${referrer?.name || 'N/A'} (${referrer?.display_id || 'N/A'})`);
      console.log(`     Credited: ${data.count} purchases, ₹${data.total.toFixed(2)} received`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('\n📝 FINAL STATUS:\n');
  if (missingCases.length === 0) {
    console.log('✅ SUCCESS: All eligible users have received monthly royalty credits!');
    console.log(`   - Total Users Credited: ${creditedByReferrer.size}`);
    console.log(`   - Total Purchases Credited: ${creditedCases.length}`);
    console.log(`   - Total Amount Credited: ₹${Array.from(creditedByReferrer.values()).reduce((sum, d) => sum + d.total, 0).toFixed(2)}`);
  } else {
    console.log('⚠️  WARNING: Some users still missing monthly royalty!');
    console.log(`   - Missing Users: ${missingByReferrer.size}`);
    console.log(`   - Missing Purchases: ${missingCases.length}`);
    console.log(`   - Missing Amount: ₹${missingCases.reduce((sum, c) => sum + c.expected_monthly_royalty, 0).toFixed(2)}/month`);
  }
  console.log('');
}

async function main() {
  try {
    await verifyAllMissingCredited();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

