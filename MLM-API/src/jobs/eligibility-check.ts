import { boss } from '../config/pgboss.js';
import { CommissionService } from '../modules/commissions/commission.service';

export async function registerEligibilityCheck() {
  await boss.work('eligibility-check', async (job) => {
    console.log(`🔄 Running scheduled eligibility check (Job ID: ${job?.id || 'manual'})`);
    const startTime = Date.now();
    
    try {
      const result = await CommissionService.recalculateEligibility();
      const duration = Date.now() - startTime;
      console.log(`✅ Eligibility check completed in ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Eligibility check failed after ${duration}ms:`, error.message);
      throw error; // Will be retried by PgBoss if configured
    }
  });
}


