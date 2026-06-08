import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { prisma } from '../src/config/prisma.js';

async function triggerDailyCommission() {
  console.log('🚀 Triggering daily commission job...\n');
  
  try {
    const result = await CommissionService.creditDailyCommissions();
    console.log('\n✅ Daily commission job completed successfully!');
    console.log(`📊 Result:`, result);
  } catch (error: any) {
    console.error('\n❌ Error running daily commission:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

triggerDailyCommission()
  .then(() => {
    console.log('\n🎉 Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

