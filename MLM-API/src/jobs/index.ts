import { boss } from '../config/pgboss.js';
import { registerPurchaseWorker } from './purchase-commission.js';
import { registerDailyCommission } from './daily-commission.js';
import { registerEligibilityCheck } from './eligibility-check.js';
import { registerReconcileLedger } from './reconcile-ledger.js';
import { registerDisqualificationCheck } from './disqualification-check.js';
import { registerDbBackupBunny } from './db-backup-bunny.js';

export async function startJobs() {
  console.log('🚀 Starting PgBoss...');
  await boss.start();
  console.log('✅ PgBoss started');

  // Create queues with retry configuration
  console.log('📋 Creating job queues...');
  
  // Helper function to create queue with error handling
  const createQueueSafe = async (queueName: string, options?: any) => {
    try {
      if (options) {
        await boss.createQueue(queueName, options);
      } else {
        await boss.createQueue(queueName);
      }
      console.log(`  ✅ Queue '${queueName}' created`);
    } catch (error: any) {
      // If queue already exists, that's fine
      if (error?.code === '42P07' || error?.message?.includes('already exists')) {
        console.log(`  ℹ️  Queue '${queueName}' already exists (skipping)`);
      } else {
        console.error(`  ❌ Error creating queue '${queueName}':`, error);
        throw error;
      }
    }
  };
  
  await createQueueSafe('purchase-commission', {
    retryLimit: 3,
    retryDelay: 30, // 30 seconds
    retryBackoff: true,
  });
  await createQueueSafe('daily-commission');
  await createQueueSafe('eligibility-check');
  await createQueueSafe('reconcile-ledger');
  await createQueueSafe('disqualification-check');
  await createQueueSafe('db-backup-bunny');
  console.log('✅ Queues ready');

  console.log('📝 Registering workers...');
  await registerPurchaseWorker();
  console.log('  ✅ Purchase worker registered');
  await registerDailyCommission();
  console.log('  ✅ Daily commission worker registered');

  // Schedule for daily at 00:52 UTC (6:22 AM IST) - Same for both production and local
  const dailyCron = '52 0 * * *';
  try {
    await boss.schedule('daily-commission', dailyCron);
    console.log(`  ✅ Daily commission scheduled (daily at 00:52 UTC / 6:22 AM IST)`);
  } catch (error: any) {
    console.log(`  ℹ️  Daily commission schedule may already exist (continuing...)`);
  }

  await registerEligibilityCheck();
  console.log('  ✅ Eligibility check worker registered');
  
  // Schedule for daily at 00:55 UTC (6:25 AM IST) - Same for both production and local
  const eligibilityCron = '55 0 * * *';
  try {
    await boss.schedule('eligibility-check', eligibilityCron);
    console.log(`  ✅ Eligibility check scheduled (daily at 00:55 UTC / 6:25 AM IST - processes SPOT commissions)`);
  } catch (error: any) {
    console.log(`  ℹ️  Eligibility check schedule may already exist (continuing...)`);
  }
  
  // Schedule daily DB backup at 23:30 UTC (5:00 AM IST): pg_dump -> gzip -> Bunny Storage (runs on API server)
  await registerDbBackupBunny();
  try {
    await boss.schedule('db-backup-bunny', '30 23 * * *');
    console.log('  ✅ DB backup to Bunny scheduled (daily at 23:30 UTC / 5:00 AM IST)');
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      console.log('  ℹ️  DB backup schedule may already exist (continuing...)');
    } else {
      console.error('  ❌ DB backup schedule error:', error);
    }
  }

  await registerReconcileLedger();
  console.log('  ✅ Reconcile ledger worker registered');
  await registerDisqualificationCheck();
  console.log('  ✅ Disqualification check worker registered');
  console.log('✅ All workers registered successfully');
}
