import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  console.log('============================================================');
  console.log('📊 Top 5 Users with Expired Packages');
  console.log('============================================================\n');

  // Get all completed purchases
  const purchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      income: true,
      purchased_at: true,
    } as any,
    orderBy: { purchased_at: 'desc' },
  });

  // Find expired purchases (income >= 2x)
  const expiredPurchases: Array<{
    purchaseId: bigint;
    userId: bigint;
    packageId: number;
    amount: number;
    income: number;
    purchasedAt: Date;
    expiredAt: Date; // Approximate - when 2x was reached
  }> = [];

  for (const purchase of purchases) {
    const amt = Number(purchase.amount);
    const inc = Number((purchase as any).income || 0);
    const doubleAmt = amt * 2;

    if (inc >= doubleAmt) {
      // Find when 2x was reached (last income date)
      const lastIncome = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchase.id,
          receiver_user_id: purchase.user_id,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
        },
        orderBy: { credited_at: 'desc' },
        select: { credited_at: true },
      });

      expiredPurchases.push({
        purchaseId: purchase.id as unknown as bigint,
        userId: purchase.user_id,
        packageId: purchase.package_id,
        amount: amt,
        income: inc,
        purchasedAt: purchase.purchased_at,
        expiredAt: lastIncome?.credited_at || purchase.purchased_at,
      });
    }
  }

  // Group by user and count expired packages
  const userExpiredMap = new Map<bigint, {
    userId: bigint;
    expiredCount: number;
    totalInvestment: number;
    totalIncome: number;
    packages: typeof expiredPurchases;
  }>();

  for (const expired of expiredPurchases) {
    if (!userExpiredMap.has(expired.userId)) {
      userExpiredMap.set(expired.userId, {
        userId: expired.userId,
        expiredCount: 0,
        totalInvestment: 0,
        totalIncome: 0,
        packages: [],
      });
    }

    const userData = userExpiredMap.get(expired.userId)!;
    userData.expiredCount++;
    userData.totalInvestment += expired.amount;
    userData.totalIncome += expired.income;
    userData.packages.push(expired);
  }

  // Convert to array and sort by expired count (descending)
  const usersWithExpired = Array.from(userExpiredMap.values())
    .sort((a, b) => b.expiredCount - a.expiredCount)
    .slice(0, 5);

  // Get user details
  const userIds = usersWithExpired.map(u => u.userId);
  const users = await prisma.users.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      display_id: true,
      name: true,
      email: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  console.log('Top 5 Users with Expired Packages:\n');

  for (let i = 0; i < usersWithExpired.length; i++) {
    const userData = usersWithExpired[i];
    const user = userMap.get(userData.userId);

    console.log(`${i + 1}. ${user?.display_id || 'N/A'} - ${user?.name || 'Unknown'}`);
    console.log(`   Email: ${user?.email || 'N/A'}`);
    console.log(`   Expired Packages: ${userData.expiredCount}`);
    console.log(`   Total Investment: ₹${userData.totalInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Income Earned: ₹${userData.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`   Packages:`);
    
    for (const pkg of userData.packages) {
      const packageData = await prisma.packages.findUnique({
        where: { id: pkg.packageId },
        select: { name: true },
      });

      console.log(`      - ${packageData?.name || `Package #${pkg.packageId}`}`);
      console.log(`        Amount: ₹${pkg.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      console.log(`        Income: ₹${pkg.income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      console.log(`        Purchased: ${pkg.purchasedAt.toISOString().split('T')[0]}`);
      console.log(`        Expired (approx): ${pkg.expiredAt.toISOString().split('T')[0]}`);
    }
    console.log('');
  }

  console.log('============================================================');
  console.log(`Total Expired Packages: ${expiredPurchases.length}`);
  console.log(`Total Users with Expired Packages: ${userExpiredMap.size}`);
  console.log('============================================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
