import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  const displayId = 'SIA00608';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('============================================================');
  console.log(`🔍 Local DB Test for ${displayId} (Expired 2500 Package) - Today Only`);
  console.log('Date (IST, 00:00 start):', today.toISOString());
  console.log('============================================================\n');

  // Find user
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  // Get purchases to identify expired 2500 package (purchase 471 in prod, but look up dynamically)
  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id, status: 'completed' },
    orderBy: { purchased_at: 'asc' },
    select: { id: true, amount: true },
  });

  const expiredCandidate = purchases.find(p => Number(p.amount) === 2500);
  if (!expiredCandidate) {
    console.log('⚠️ No 2500 purchase found for user; nothing to test');
    return;
  }

  const purchaseId = expiredCandidate.id as any as bigint;
  console.log(`Using purchase ID ${purchaseId} as 2500 package under test.\n`);

  // Helper to fetch today's ledger entries for this purchase
  async function fetchTodayEntries() {
    return prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        credited_at: { gte: today },
      },
      orderBy: { credited_at: 'asc' },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
      },
    });
  }

  const before = await fetchTodayEntries();
  console.log(`📊 BEFORE creditDailyCommissions(): Today entries for purchase ${purchaseId}: ${before.length}`);
  for (const e of before) {
    console.log(`  - ${e.commission_type} ₹${Number(e.amount).toFixed(2)} at ${e.credited_at.toISOString()}`);
  }
  console.log('');

  console.log('🚀 Running CommissionService.creditDailyCommissions() ...');
  await CommissionService.creditDailyCommissions();
  console.log('✅ creditDailyCommissions() finished.\n');

  const after = await fetchTodayEntries();
  console.log(`📊 AFTER creditDailyCommissions(): Today entries for purchase ${purchaseId}: ${after.length}`);
  for (const e of after) {
    console.log(`  - ${e.commission_type} ₹${Number(e.amount).toFixed(2)} at ${e.credited_at.toISOString()}`);
  }

  const newCount = after.length - before.length;
  if (newCount > 0) {
    console.log(`\n❌ BUG: ${newCount} new entries were created today for EXPIRED 2500 package (should be 0).`);
  } else {
    console.log('\n✅ PASS: No new entries created today for EXPIRED 2500 package. Fix working in local DB.');
  }
}

main()
  .catch(err => {
    console.error('Error in test script:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
