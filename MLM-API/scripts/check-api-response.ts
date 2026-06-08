import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Checking API Response - renewal_countdown field');
  console.log('============================================================\n');

  // Simulate what the API endpoint does
  const userId = BigInt(6); // SIA00608
  const statusFilter = 'expired';

  const where: any = { user_id: userId, status: 'completed' };
  const purchases = await prisma.purchases.findMany({
    where,
    orderBy: { purchased_at: 'desc' },
    select: {
      id: true,
      package_id: true,
      amount: true,
      income: true,
      purchased_at: true,
      status: true,
    } as any,
  });

  // Get package names
  const packageIds = Array.from(new Set(purchases.map(p => p.package_id)));
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p.name]));

  const items = await Promise.all(
    purchases.map(async (p) => {
      // Check if expired
      const amt = Number(p.amount);
      const inc = Number((p as any).income || 0);
      const isExpired = p.status === 'completed' && inc >= amt * 2;

      if (!isExpired) return null;

      // Calculate renewal countdown
      let renewalCountdown = null;
      try {
        renewalCountdown = await PackageStatusService.calculateRenewalCountdown(
          p.id as unknown as bigint,
          userId
        );
      } catch (error) {
        console.error(`Error calculating countdown for purchase ${p.id}:`, error);
      }

      return {
        id: p.id.toString(),
        package_name: packageMap.get(p.package_id) ?? null,
        amount: Number(p.amount),
        income: Number((p as any).income || 0),
        is_expired: isExpired,
        renewal_countdown: renewalCountdown,
      };
    })
  );

  const expiredItems = items.filter(item => item !== null && item.is_expired);

  console.log(`Found ${expiredItems.length} expired packages\n`);

  for (const item of expiredItems.slice(0, 3)) {
    console.log(`Package: ${item?.package_name}`);
    console.log(`ID: ${item?.id}`);
    console.log(`Amount: ₹${item?.amount}`);
    console.log(`Income: ₹${item?.income}`);
    console.log(`Renewal Countdown:`);
    if (item?.renewal_countdown) {
      console.log(`  ✅ Present:`);
      console.log(`     Last Income: ${item.renewal_countdown.last_income_date || 'N/A'}`);
      console.log(`     Deadline: ${item.renewal_countdown.renewal_deadline}`);
      console.log(`     Countdown: ${item.renewal_countdown.countdown.days}d ${item.renewal_countdown.countdown.hours}h`);
      console.log(`     Can Renew: ${item.renewal_countdown.can_renew}`);
    } else {
      console.log(`  ❌ MISSING - renewal_countdown is null!`);
    }
    console.log('');
  }

  // Check top 5 users
  console.log('============================================================');
  console.log('Checking Top 5 Users API Response...');
  console.log('============================================================\n');

  const topUsers = ['SIA00770', 'SIA00454', 'SIA00718', 'SIA00593', 'SIA00583'];
  
  for (const displayId of topUsers) {
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: { id: true },
    });

    if (!user) continue;

    const userPurchases = await prisma.purchases.findMany({
      where: { user_id: user.id, status: 'completed' },
      select: {
        id: true,
        amount: true,
        income: true,
      } as any,
      take: 1, // Just check one expired package
    });

    for (const purchase of userPurchases) {
      const amt = Number(purchase.amount);
      const inc = Number((purchase as any).income || 0);
      if (inc >= amt * 2) {
        const countdown = await PackageStatusService.calculateRenewalCountdown(
          purchase.id as unknown as bigint,
          user.id
        );
        
        console.log(`${displayId}:`);
        if (countdown) {
          console.log(`  ✅ renewal_countdown present`);
          console.log(`     Deadline: ${countdown.renewal_deadline}`);
        } else {
          console.log(`  ❌ renewal_countdown is null!`);
        }
        break;
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
