import { boss } from '../config/pgboss.js';
import { DisqualificationService } from '../modules/commissions/disqualification.service.js';

export async function registerDisqualificationCheck() {
  await boss.work('disqualification-check', async () => {
    console.log('🔍 Running daily disqualification check...');
    const result = await DisqualificationService.checkAndDisqualifyUsers();
    console.log(`✅ Disqualification check completed. Disqualified ${result.disqualified} users.`);
    return result;
  });
  console.log('✅ Disqualification check worker registered and listening...');
}

