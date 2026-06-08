import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Checking Countdown Issue - Top 5 Users');
  console.log('============================================================\n');

  const topUsers = [
    { displayId: 'SIA00770', name: 'Pramila Shankar Meshram' },
    { displayId: 'SIA00454', name: 'Nilima Sambashiv Awari' },
    { displayId: 'SIA00718', name: 'Gopal Dutt 3823sati' },
    { displayId: 'SIA00593', name: 'Hayasala gajanan nikode' },
    { displayId: 'SIA00583', name: 'Avinash prabhakar Gartulwar' },
  ];

  for (const userInfo of topUsers) {
    const user = await prisma.users.findUnique({
      where: { display_id: userInfo.displayId },
      select: { id: true },
    });

    if (!user) {
      console.log(`❌ User ${userInfo.displayId} not found\n`);
      continue;
    }

    // Get expired purchases for this user
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: user.id,
        status: 'completed',
      },
      select: {
        id: true,
        package_id: true,
        amount: true,
        income: true,
        purchased_at: true,
      } as any,
    });

    const expiredPurchases = [];
    for (const purchase of purchases) {
      const amt = Number(purchase.amount);
      const inc = Number((purchase as any).income || 0);
      if (inc >= amt * 2) {
        expiredPurchases.push(purchase);
      }
    }

    if (expiredPurchases.length === 0) {
      console.log(`⚠️  ${userInfo.displayId} - No expired packages\n`);
      continue;
    }

    console.log(`\n${userInfo.displayId} - ${userInfo.name}`);
    console.log(`Expired Packages: ${expiredPurchases.length}`);
    console.log('─'.repeat(60));

    // Check countdown for each expired package
    for (const purchase of expiredPurchases.slice(0, 2)) { // Check first 2
      const countdown = await PackageStatusService.calculateRenewalCountdown(
        purchase.id as unknown as bigint,
        user.id
      );

      // Also manually check last income date
      const lastIncome = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchase.id,
          receiver_user_id: user.id,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
        },
        orderBy: { credited_at: 'desc' },
        select: { credited_at: true, commission_type: true, amount: true },
      });

      const packageData = await prisma.packages.findUnique({
        where: { id: purchase.package_id },
        select: { name: true },
      });

      console.log(`\n  Package: ${packageData?.name || `#${purchase.package_id}`}`);
      console.log(`  Purchase ID: ${purchase.id}`);
      console.log(`  Amount: ₹${Number(purchase.amount).toFixed(2)}`);
      console.log(`  Income: ₹${Number((purchase as any).income || 0).toFixed(2)}`);
      console.log(`  Purchased: ${purchase.purchased_at.toISOString().split('T')[0]}`);

      if (lastIncome) {
        console.log(`  Last Income Date: ${lastIncome.credited_at.toISOString()}`);
        console.log(`  Last Income Type: ${lastIncome.commission_type}`);
        console.log(`  Last Income Amount: ₹${Number(lastIncome.amount).toFixed(2)}`);
        
        const expectedDeadline = new Date(lastIncome.credited_at);
        expectedDeadline.setDate(expectedDeadline.getDate() + 30);
        console.log(`  Expected Deadline: ${expectedDeadline.toISOString()}`);
      } else {
        console.log(`  ⚠️  No SELF/GLOBAL income found (using purchase date fallback)`);
        const fallbackDeadline = new Date(purchase.purchased_at);
        fallbackDeadline.setDate(fallbackDeadline.getDate() + 30);
        console.log(`  Fallback Deadline: ${fallbackDeadline.toISOString()}`);
      }

      if (countdown) {
        console.log(`  ✅ Countdown Result:`);
        console.log(`     Last Income Date: ${countdown.last_income_date || 'N/A'}`);
        console.log(`     Renewal Deadline: ${countdown.renewal_deadline}`);
        console.log(`     Countdown: ${countdown.countdown.days}d ${countdown.countdown.hours}h ${countdown.countdown.minutes}m ${countdown.countdown.seconds}s`);
        console.log(`     Can Renew: ${countdown.can_renew}`);
      } else {
        console.log(`  ❌ Countdown returned null`);
      }
    }
    console.log('');
  }

  console.log('============================================================');
  console.log('🔍 Checking if all users have same deadline...');
  console.log('============================================================\n');

  // Check if all users have same deadline (BUG CHECK)
  const allDeadlines = new Set<string>();
  for (const userInfo of topUsers) {
    const user = await prisma.users.findUnique({
      where: { display_id: userInfo.displayId },
      select: { id: true },
    });

    if (!user) continue;

    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: user.id,
        status: 'completed',
      },
      select: {
        id: true,
        amount: true,
        income: true,
      } as any,
    });

    for (const purchase of purchases) {
      const amt = Number(purchase.amount);
      const inc = Number((purchase as any).income || 0);
      if (inc >= amt * 2) {
        const countdown = await PackageStatusService.calculateRenewalCountdown(
          purchase.id as unknown as bigint,
          user.id
        );
        if (countdown) {
          allDeadlines.add(countdown.renewal_deadline);
        }
      }
    }
  }

  console.log(`Unique Deadlines Found: ${allDeadlines.size}`);
  if (allDeadlines.size === 1) {
    console.log(`❌ BUG DETECTED: All users have same deadline!`);
    console.log(`   Deadline: ${Array.from(allDeadlines)[0]}`);
  } else {
    console.log(`✅ Good: Different deadlines found`);
    console.log(`   Sample deadlines:`);
    Array.from(allDeadlines).slice(0, 5).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d}`);
    });
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
