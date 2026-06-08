import { boss } from '../config/pgboss.js';
import { CommissionService } from '../modules/commissions/commission.service';

export async function registerDailyCommission() {
  await boss.work('daily-commission', async () => {
    return CommissionService.creditDailyCommissions();
  });
}


