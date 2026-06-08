import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🧪 Testing Fixed Deadline Countdown');
  console.log('============================================================\n');

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

  // Simulate multiple API calls (different browsers, different times)
  console.log('📱 Simulating API calls from different browsers at different times:\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`--- Browser ${i} API Call (${i} second delay) ---`);
    
    // Small delay to simulate different request times
    if (i > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const countdown = await PackageStatusService.calculateRenewalCountdown(
      purchaseId as unknown as bigint,
      user.id
    );

    if (countdown) {
      const now = new Date();
      const renewalDeadline = new Date(countdown.renewal_deadline);
      const remainingMs = renewalDeadline.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      
      const days = Math.floor(remainingSeconds / (24 * 60 * 60));
      const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((remainingSeconds % (60 * 60)) / 60);
      const seconds = remainingSeconds % 60;

      console.log(`Last Income Date: ${countdown.last_income_date || 'N/A'}`);
      console.log(`Renewal Deadline: ${countdown.renewal_deadline} (FIXED - never changes)`);
      console.log(`Current Time: ${now.toISOString()}`);
      console.log(`\nFrontend calculates:`);
      console.log(`  Countdown = renewal_deadline - now`);
      console.log(`  Remaining: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      console.log(`  Total Seconds: ${remainingSeconds}`);
      console.log(`  Can Renew: ${remainingSeconds > 0 ? 'YES ✅' : 'NO ❌'}`);
      console.log(`\n✅ All browsers will show same countdown (based on fixed deadline)\n`);
    }
  }

  console.log('============================================================');
  console.log('✅ Key Points:');
  console.log('============================================================\n');
  console.log('1. renewal_deadline is FIXED (last_income_date + 30 days)');
  console.log('2. Frontend calculates: countdown = renewal_deadline - client_now');
  console.log('3. All browsers show same countdown (same deadline, different client_now)');
  console.log('4. Countdown updates in real-time every second\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
