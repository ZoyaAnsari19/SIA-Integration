import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Verifying Each Package Has Unique Countdown');
  console.log('============================================================\n');

  // Get all expired packages from top 5 users
  const topUsers = ['SIA00770', 'SIA00454', 'SIA00718', 'SIA00593', 'SIA00583'];
  
  const allCountdowns: Array<{
    userId: string;
    purchaseId: string;
    deadline: string;
    lastIncomeDate: string | null;
  }> = [];

  for (const displayId of topUsers) {
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
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
          allCountdowns.push({
            userId: displayId,
            purchaseId: purchase.id.toString(),
            deadline: countdown.renewal_deadline,
            lastIncomeDate: countdown.last_income_date,
          });
        }
      }
    }
  }

  console.log(`Total Expired Packages Checked: ${allCountdowns.length}\n`);

  // Group by deadline
  const deadlineGroups = new Map<string, string[]>();
  for (const c of allCountdowns) {
    if (!deadlineGroups.has(c.deadline)) {
      deadlineGroups.set(c.deadline, []);
    }
    deadlineGroups.get(c.deadline)!.push(`${c.userId}-${c.purchaseId}`);
  }

  console.log(`Unique Deadlines: ${deadlineGroups.size}\n`);

  if (deadlineGroups.size === 1) {
    console.log('❌ BUG: All packages have SAME deadline!');
    console.log(`   Deadline: ${Array.from(deadlineGroups.keys())[0]}`);
    console.log(`   Affected Packages: ${Array.from(deadlineGroups.values())[0].join(', ')}`);
  } else {
    console.log('✅ Good: Different deadlines found\n');
    
    // Show groups with multiple packages
    let hasDuplicates = false;
    for (const [deadline, packages] of deadlineGroups.entries()) {
      if (packages.length > 1) {
        hasDuplicates = true;
        console.log(`⚠️  Deadline ${deadline} shared by ${packages.length} packages:`);
        packages.forEach(p => console.log(`   - ${p}`));
        console.log('');
      }
    }

    if (!hasDuplicates) {
      console.log('✅ All packages have unique deadlines');
    }
  }

  // Check last income dates
  console.log('\n============================================================');
  console.log('Last Income Dates Analysis:');
  console.log('============================================================\n');

  const lastIncomeDates = new Set<string>();
  for (const c of allCountdowns) {
    if (c.lastIncomeDate) {
      const dateOnly = c.lastIncomeDate.split('T')[0]; // Just the date part
      lastIncomeDates.add(dateOnly);
    }
  }

  console.log(`Unique Last Income Dates: ${lastIncomeDates.size}`);
  console.log(`Dates: ${Array.from(lastIncomeDates).join(', ')}`);

  if (lastIncomeDates.size === 1) {
    console.log('\n⚠️  WARNING: All packages got last income on same date!');
    console.log(`   This is why deadlines are similar (all +30 days from same date)`);
    console.log(`   This is CORRECT behavior - not a bug`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
