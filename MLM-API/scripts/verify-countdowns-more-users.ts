import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Verifying Expired Package Countdowns for Multiple Users');
  console.log('============================================================\n');

  // 1. Pick 20 users who have at least 1 expired package
  const expiredPurchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    select: {
      id: true,
      user_id: true,
      amount: true,
      income: true,
    } as any,
  });

  const userIdsWithExpired = new Set<bigint>();
  for (const p of expiredPurchases) {
    const amt = Number(p.amount);
    const inc = Number((p as any).income || 0);
    if (inc >= amt * 2) {
      userIdsWithExpired.add(p.user_id as bigint);
    }
  }

  const sampleUserIds = Array.from(userIdsWithExpired).slice(0, 20);

  const users = await prisma.users.findMany({
    where: { id: { in: sampleUserIds } },
    select: { id: true, display_id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.id as bigint, u]));

  const allCountdowns: Array<{
    userDisplayId: string;
    purchaseId: string;
    deadline: string;
    lastIncomeDate: string | null;
  }> = [];

  for (const userId of sampleUserIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    const purchases = await prisma.purchases.findMany({
      where: { user_id: userId, status: 'completed' },
      select: {
        id: true,
        amount: true,
        income: true,
      } as any,
    });

    const expiredForUser = purchases.filter(p => {
      const amt = Number(p.amount);
      const inc = Number((p as any).income || 0);
      return inc >= amt * 2;
    });

    if (expiredForUser.length === 0) continue;

    console.log(`User ${user.display_id} (${user.name || 'N/A'}) - Expired packages: ${expiredForUser.length}`);

    for (const p of expiredForUser.slice(0, 3)) { // per user max 3 for brevity
      const countdown = await PackageStatusService.calculateRenewalCountdown(
        p.id as unknown as bigint,
        userId
      );

      if (!countdown) continue;

      console.log(`  Purchase ${p.id}:`);
      console.log(`    Amount: ₹${Number(p.amount).toFixed(2)}, Income: ₹${Number((p as any).income || 0).toFixed(2)}`);
      console.log(`    Last Income: ${countdown.last_income_date || 'N/A'}`);
      console.log(`    Deadline: ${countdown.renewal_deadline}`);
      console.log(`    Countdown (today se): ${countdown.countdown.days}d ${countdown.countdown.hours}h ${countdown.countdown.minutes}m\n`);

      allCountdowns.push({
        userDisplayId: user.display_id || user.id.toString(),
        purchaseId: p.id.toString(),
        deadline: countdown.renewal_deadline,
        lastIncomeDate: countdown.last_income_date,
      });
    }
    console.log('');
  }

  console.log('============================================================');
  console.log(`Total expired packages checked: ${allCountdowns.length}`);

  // 2. Check global uniqueness / patterns
  const uniqueDeadlines = new Set(allCountdowns.map(c => c.deadline));
  console.log(`Unique deadlines across all these packages: ${uniqueDeadlines.size}`);

  const byUser = new Map<string, Set<string>>();
  for (const c of allCountdowns) {
    if (!byUser.has(c.userDisplayId)) byUser.set(c.userDisplayId, new Set());
    byUser.get(c.userDisplayId)!.add(c.deadline);
  }

  console.log('\nPer-user deadline summary (sample):');
  for (const [userDisplayId, deadlines] of Array.from(byUser.entries()).slice(0, 10)) {
    console.log(`  ${userDisplayId}: ${deadlines.size} unique deadlines`);
  }

  console.log('\nNOTE: Agar kisi user ke sab expired packages ka last income ek hi date ke around aya, to us user ke sab packages ka deadline ~same hoga (ye expected hai).');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
