#!/usr/bin/env tsx
/**
 * Daily Commission Worker
 * 
 * Processes scheduled commissions for TODAY (current date).
 * 
 * This script should be run daily at 00:05 IST via cron job:
 *   5 0 * * * cd /path/to/app && npx tsx scripts/run-daily-commission.ts
 * 
 * Per project-understanding.md Section "🕒 2. Daily Commission Worker"
 */

import { boss } from '../src/config/pgboss.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function runDailyCommission() {
  console.log('🚀 Starting PgBoss...');
  await boss.start();
  console.log('✅ PgBoss started');
  
  console.log('💰 Processing daily commissions for TODAY...');
  const result = await CommissionService.creditDailyCommissions();
  console.log('✅ Daily commissions processed:', result);
  
  await boss.stop();
  console.log('✅ PgBoss stopped');
}

runDailyCommission()
  .then(() => {
    console.log('✅ Daily commission job completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

