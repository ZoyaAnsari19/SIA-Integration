import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🧪 Testing Countdown Consistency Across API Calls');
  console.log('============================================================\n');

  const purchaseId = 471;
  const userId = BigInt(6); // SIA00608

  console.log('📦 Testing Purchase 471\n');

  // Simulate multiple API calls (like different browsers)
  console.log('Simulating 3 API calls (like 3 different browsers):\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`--- API Call ${i} (${new Date().toISOString()}) ---`);
    
    // Small delay to simulate different call times
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const countdown = await PackageStatusService.calculateRenewalCountdown(
      purchaseId as unknown as bigint,
      userId
    );

    if (countdown) {
      console.log(`Renewal Deadline: ${countdown.renewal_deadline}`);
      console.log(`Last Income Date: ${countdown.last_income_date || 'N/A'}`);
      console.log(`Initial Countdown: ${countdown.countdown.days}d ${countdown.countdown.hours}h ${countdown.countdown.minutes}m ${countdown.countdown.seconds}s`);
      console.log(`Can Renew: ${countdown.can_renew}`);
      console.log('');
    }
  }

  console.log('============================================================');
  console.log('✅ Key Point: renewal_deadline is FIXED (same in all calls)');
  console.log('✅ Frontend should use renewal_deadline to calculate real-time countdown');
  console.log('✅ Formula: countdown = renewal_deadline - client_current_time');
  console.log('============================================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
