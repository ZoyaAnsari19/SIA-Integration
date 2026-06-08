import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🧪 Testing Full API Response (Simulating my-packages route)');
  console.log('============================================================\n');

  // Test with SIA00770 (has 4 expired packages)
  const displayId = 'SIA00770';
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id, status: 'completed' },
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

  const packageIds = Array.from(new Set(purchases.map(p => p.package_id)));
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p.name]));

  const items = await Promise.all(
    purchases.map(async (p) => {
      const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
      const isActive = p.status === 'completed' && !isDoubleReached;
      const isExpired = p.status === 'completed' && isDoubleReached;

      let renewalCountdown = null;
      if (isExpired) {
        try {
          renewalCountdown = await PackageStatusService.calculateRenewalCountdown(p.id, user.id);
        } catch (error) {
          console.error(`Error calculating countdown for purchase ${p.id}:`, error);
        }
      }

      return {
        id: p.id.toString(),
        package_name: packageMap.get(p.package_id) ?? null,
        amount: Number(p.amount),
        income: Number(p.income || 0),
        is_active: isActive,
        is_expired: isExpired,
        renewal_countdown: renewalCountdown,
      };
    })
  );

  const expiredItems = items.filter(item => item.is_expired);

  console.log(`${displayId} - Expired Packages: ${expiredItems.length}\n`);

  for (let i = 0; i < expiredItems.length; i++) {
    const item = expiredItems[i];
    console.log(`Package ${i + 1}:`);
    console.log(`  ID: ${item.id}`);
    console.log(`  Name: ${item.package_name}`);
    console.log(`  Amount: ₹${item.amount}`);
    console.log(`  Income: ₹${item.income}`);
    
    if (item.renewal_countdown) {
      console.log(`  ✅ renewal_countdown:`);
      console.log(`     Deadline: ${item.renewal_countdown.renewal_deadline}`);
      console.log(`     Countdown: ${item.renewal_countdown.countdown.days}d ${item.renewal_countdown.countdown.hours}h ${item.renewal_countdown.countdown.minutes}m`);
    } else {
      console.log(`  ❌ renewal_countdown is NULL!`);
    }
    console.log('');
  }

  // Check if all deadlines are same
  const deadlines = expiredItems
    .map(item => item.renewal_countdown?.renewal_deadline)
    .filter(Boolean) as string[];

  const uniqueDeadlines = new Set(deadlines);
  console.log(`Unique Deadlines: ${uniqueDeadlines.size}`);
  if (uniqueDeadlines.size === 1 && deadlines.length > 1) {
    console.log(`⚠️  WARNING: All packages have same deadline!`);
    console.log(`   Deadline: ${Array.from(uniqueDeadlines)[0]}`);
  } else {
    console.log(`✅ Good: Different deadlines found`);
    deadlines.forEach((d, i) => {
      console.log(`   ${i + 1}. ${d}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
