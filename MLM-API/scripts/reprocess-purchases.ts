import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function reprocessPurchases() {
  try {
    const purchases = await prisma.purchases.findMany({
      where: { 
        status: 'completed',
        active_until: { gte: new Date() }
      },
      orderBy: { purchased_at: 'asc' }
    });
    
    console.log(`Found ${purchases.length} active purchases to reprocess`);
    
    for (const purchase of purchases) {
      try {
        console.log(`\nProcessing Purchase ID: ${purchase.id}, User: ${purchase.user_id}`);
        const result = await CommissionService.handlePurchase(purchase.id as unknown as bigint);
        console.log(`  ✅ Processed: ${result.ok ? 'Success' : result.message}`);
      } catch (error: any) {
        console.error(`  ❌ Error processing purchase ${purchase.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ All purchases processed!`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessPurchases();

