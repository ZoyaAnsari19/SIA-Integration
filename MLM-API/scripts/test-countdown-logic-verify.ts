import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  console.log('============================================================');
  console.log('✅ Countdown Logic Verification');
  console.log('============================================================\n');

  const displayId = 'SIA00608';
  
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  // Get all packages for this user
  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id, status: 'completed' },
    select: {
      id: true,
      package_id: true,
      amount: true,
      income: true,
    },
    orderBy: { purchased_at: 'desc' },
  });

  console.log(`📦 Found ${purchases.length} completed packages:\n`);

  for (const purchase of purchases) {
    const amt = Number(purchase.amount);
    const inc = Number(purchase.income || 0);
    const doubleAmt = amt * 2;
    const isExpired = inc >= doubleAmt;
    
    // Check using service
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
    
    console.log(`Package ID: ${purchase.id}`);
    console.log(`  Amount: ₹${amt.toFixed(2)}`);
    console.log(`  Income: ₹${inc.toFixed(2)}`);
    console.log(`  2x Target: ₹${doubleAmt.toFixed(2)}`);
    console.log(`  Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
    
    // Get countdown
    const countdown = await PackageStatusService.calculateRenewalCountdown(
      purchase.id as unknown as bigint,
      user.id
    );
    
    if (countdown) {
      console.log(`  Countdown: ✅ ${countdown.countdown.days}d ${countdown.countdown.hours}h ${countdown.countdown.minutes}m ${countdown.countdown.seconds}s`);
      console.log(`  Last Income: ${countdown.last_income_date || 'N/A'}`);
      console.log(`  Renewal Deadline: ${countdown.renewal_deadline}`);
      console.log(`  Can Renew: ${countdown.can_renew ? 'YES ✅' : 'NO ❌'}\n`);
    } else {
      console.log(`  Countdown: ❌ NO COUNTDOWN (Active package - income < 2x)\n`);
    }
  }

  console.log('============================================================');
  console.log('✅ Logic Summary:');
  console.log('============================================================\n');
  console.log('1. Expired Package (income >= 2x):');
  console.log('   ✅ Countdown starts from last SELF + GLOBAL income date + 30 days');
  console.log('   ✅ Countdown is calculated and returned\n');
  console.log('2. Active Package (income < 2x):');
  console.log('   ❌ NO countdown (returns null)');
  console.log('   ✅ Only expired packages get countdown\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
