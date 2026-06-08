import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🧪 Testing Renewal Countdown Logic');
  console.log('============================================================\n');

  // Test with SIA00608's expired package (Purchase 471)
  const displayId = 'SIA00608';
  const purchaseId = 471;

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`📦 Testing Purchase ${purchaseId} for user ${displayId}\n`);

  // Check if purchase is expired
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: {
      amount: true,
      income: true,
      status: true,
    },
  });

  if (!purchase) {
    console.log('❌ Purchase not found');
    return;
  }

  const isExpired = purchase.status === 'completed' && 
    Number(purchase.income || 0) >= Number(purchase.amount) * 2;

  console.log(`Package Status:`);
  console.log(`  Amount: ₹${Number(purchase.amount).toFixed(2)}`);
  console.log(`  Income: ₹${Number(purchase.income || 0).toFixed(2)}`);
  console.log(`  Status: ${purchase.status}`);
  console.log(`  Is Expired: ${isExpired}\n`);

  if (!isExpired) {
    console.log('⚠️  Package is not expired, countdown will return null');
    return;
  }

  // Find last SELF + GLOBAL_HELPING income
  const lastIncome = await prisma.ledger_entries.findFirst({
    where: {
      purchase_id: purchaseId,
      receiver_user_id: user.id,
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
    },
    orderBy: { credited_at: 'desc' },
    select: { 
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
    },
  });

  console.log(`Last SELF/GLOBAL Income:`);
  if (lastIncome) {
    console.log(`  Entry ID: ${lastIncome.id}`);
    console.log(`  Type: ${lastIncome.commission_type}`);
    console.log(`  Amount: ₹${Number(lastIncome.amount).toFixed(2)}`);
    console.log(`  Date: ${lastIncome.credited_at.toISOString()}\n`);
  } else {
    console.log(`  ❌ No SELF/GLOBAL income found (will use purchase date as fallback)\n`);
  }

  // Calculate countdown
  const countdown = await PackageStatusService.calculateRenewalCountdown(
    purchaseId as unknown as bigint,
    user.id
  );

  console.log(`============================================================`);
  console.log(`📊 Countdown Result:`);
  console.log(`============================================================\n`);

  if (countdown) {
    console.log(`Last Income Date: ${countdown.last_income_date || 'N/A (using purchase date)'}`);
    console.log(`Renewal Deadline: ${countdown.renewal_deadline}`);
    console.log(`\nCountdown:`);
    console.log(`  Days: ${countdown.countdown.days}`);
    console.log(`  Hours: ${countdown.countdown.hours}`);
    console.log(`  Minutes: ${countdown.countdown.minutes}`);
    console.log(`  Seconds: ${countdown.countdown.seconds}`);
    console.log(`  Total Seconds: ${countdown.countdown.total_seconds}`);
    console.log(`\nCan Renew: ${countdown.can_renew ? '✅ YES' : '❌ NO (countdown expired)'}\n`);
  } else {
    console.log('❌ Countdown calculation returned null\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
