import { prisma } from '../src/config/prisma.js';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';

async function main() {
  console.log('============================================================');
  console.log('🧪 Testing Real-Time Countdown (Backend Calculated)');
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

  // Simulate multiple API calls (like different browsers)
  console.log('📱 Simulating API calls from different browsers:\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`--- Browser ${i} API Call ---`);
    const countdown = await PackageStatusService.calculateRenewalCountdown(
      purchaseId as unknown as bigint,
      user.id
    );

    if (countdown) {
      const now = new Date();
      const calculatedAt = new Date(countdown.calculated_at);
      const timeDiff = Math.floor((now.getTime() - calculatedAt.getTime()) / 1000);

      console.log(`Server Time (calculated_at): ${countdown.calculated_at}`);
      console.log(`Client Time (now): ${now.toISOString()}`);
      console.log(`Time Difference: ${timeDiff} seconds`);
      console.log(`Countdown (at calculation): ${countdown.countdown.days}d ${countdown.countdown.hours}h ${countdown.countdown.minutes}m ${countdown.countdown.seconds}s`);
      console.log(`Total Seconds: ${countdown.countdown.total_seconds}`);
      console.log(`Can Renew: ${countdown.can_renew}`);
      console.log(`\nFrontend should:`);
      console.log(`  1. Use total_seconds (${countdown.countdown.total_seconds}) as starting point`);
      console.log(`  2. Decrement every second: remaining = total_seconds - elapsed_seconds`);
      console.log(`  3. All browsers will show same countdown (based on server time)\n`);
    }
    
    // Small delay to simulate different request times
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('============================================================');
  console.log('✅ Key Points for Frontend:');
  console.log('============================================================\n');
  console.log('1. Backend calculates countdown at API call time');
  console.log('2. Frontend receives: total_seconds, calculated_at, renewal_deadline');
  console.log('3. Frontend should:');
  console.log('   - Start with total_seconds from API');
  console.log('   - Calculate elapsed time: (client_now - calculated_at)');
  console.log('   - Remaining = total_seconds - elapsed');
  console.log('   - Decrement remaining every second');
  console.log('4. This ensures all browsers show same countdown\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
