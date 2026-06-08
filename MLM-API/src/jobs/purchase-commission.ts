import { boss } from '../config/pgboss.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export async function registerPurchaseWorker() {
  await boss.work('purchase-commission', { teamSize: 5, teamConcurrency: 2 }, async (jobs) => {
    console.log(`🎯 Processing ${jobs.length} purchase-commission job(s)`);
    
    // PgBoss sends jobs as an array
    for (const job of jobs) {
      try {
        console.log(`  Job ID: ${job.id}, Data:`, job.data);
        const { purchaseId } = job.data as { purchaseId: string };
        if (!purchaseId) {
          throw new Error('purchaseId is missing from job data');
        }
        console.log(`  Processing Purchase ID: ${purchaseId}`);
        await CommissionService.handlePurchase(BigInt(purchaseId));
        console.log(`  ✅ Purchase ${purchaseId} processed successfully`);
      } catch (error) {
        console.error(`  ❌ Error processing job ${job.id}:`, error);
        throw error; // Will trigger retry
      }
    }
  });
  console.log('✅ Purchase commission worker registered and listening...');
}


