import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function processPurchases() {
  try {
    // Get all completed purchases that haven't been processed
    const purchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
      },
      orderBy: {
        purchased_at: 'asc',
      },
    });

    console.log(`Found ${purchases.length} purchases to process`);

    for (const purchase of purchases) {
      console.log(`\nProcessing Purchase ID: ${purchase.id}, User: ${purchase.user_id}`);
      try {
        const result = await CommissionService.handlePurchase(purchase.id as unknown as bigint);
        console.log(`  ✅ Processed: ${result.ok ? 'Success' : result.message}`);
      } catch (error: any) {
        console.error(`  ❌ Error processing purchase ${purchase.id}:`, error.message);
      }
    }

    // Recalculate eligibility to release pending commissions
    console.log('\n🔄 Recalculating eligibility...');
    await CommissionService.recalculateEligibility();
    console.log('✅ Eligibility recalculated');

    console.log('\n✅ All purchases processed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

processPurchases();

