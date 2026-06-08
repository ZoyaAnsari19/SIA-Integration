import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Verifying Countdown is Fixed Across Calls');
  console.log('============================================================\n');

  const purchaseId = 471;
  const userId = BigInt(6); // SIA00608

  const results: string[] = [];

  // Simulate 5 API calls with delays
  for (let i = 1; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const countdown = await PackageStatusService.calculateRenewalCountdown(
      purchaseId as unknown as bigint,
      userId
    );

    if (countdown) {
      results.push(countdown.renewal_deadline);
      console.log(`Call ${i}: renewal_deadline = ${countdown.renewal_deadline}`);
    }
  }

  console.log('\n============================================================');
  
  // Check if all deadlines are the same
  const allSame = results.every(deadline => deadline === results[0]);
  
  if (allSame && results.length > 0) {
    console.log('✅ SUCCESS: renewal_deadline is FIXED (same in all calls)');
    console.log(`   Fixed Deadline: ${results[0]}`);
  } else {
    console.log('❌ ERROR: renewal_deadline is changing!');
    console.log('   This should NOT happen - deadline must be fixed');
  }
  
  console.log('============================================================\n');
  
  // Also check last income date
  const lastIncome = await prisma.ledger_entries.findFirst({
    where: {
      purchase_id: purchaseId,
      receiver_user_id: userId,
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
    },
    orderBy: { credited_at: 'desc' },
    select: { credited_at: true },
  });
  
  if (lastIncome) {
    const lastIncomeDate = new Date(lastIncome.credited_at);
    const deadline = new Date(lastIncomeDate);
    deadline.setDate(deadline.getDate() + 30);
    console.log(`Last Income Date: ${lastIncomeDate.toISOString()}`);
    console.log(`Expected Deadline: ${deadline.toISOString()}`);
    console.log(`Actual Deadline: ${results[0]}`);
    console.log(`Match: ${deadline.toISOString() === results[0] ? '✅' : '❌'}\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
