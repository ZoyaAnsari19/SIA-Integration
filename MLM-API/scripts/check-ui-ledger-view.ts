import { prisma } from '../src/config/prisma.js';

async function main() {
  const displayId = 'SIA00608';
  
  console.log('============================================================');
  console.log(`🔍 Checking UI Ledger View for ${displayId}`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true },
  });

  if (!user) return;

  // Get recent ledger entries (what UI would show)
  const recentEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
    },
    orderBy: { credited_at: 'desc' },
    take: 20,
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      idempotency_key: true,
      purchase_id: true,
    },
  });

  console.log('📋 Recent Ledger Entries (Last 20 - What UI Shows):\n');
  for (const e of recentEntries) {
    const purchaseInfo = e.purchase_id ? `Purchase ${e.purchase_id}` : 'N/A';
    const isReversal = e.idempotency_key?.startsWith('reversal:expired:');
    console.log(`   ${e.commission_type.padEnd(15)} ₹${Number(e.amount).toFixed(2).padStart(10)} | ${e.credited_at.toISOString().split('T')[0]} | ${purchaseInfo} ${isReversal ? ' [REVERSAL]' : ''}`);
  }

  console.log('\n📊 Summary:');
  const adminOps = recentEntries.filter(e => e.commission_type === 'ADMIN_OPS');
  const reversals = recentEntries.filter(e => e.idempotency_key?.startsWith('reversal:expired:'));
  
  console.log(`   Total entries shown: ${recentEntries.length}`);
  console.log(`   ADMIN_OPS entries: ${adminOps.length}`);
  console.log(`   Reversal entries: ${reversals.length}`);
  console.log(`   Other types: ${recentEntries.length - adminOps.length}\n`);

  // Check if UI filters ADMIN_OPS
  console.log('⚠️  Note: If UI filters ADMIN_OPS, reversal entries won\'t be visible');
  console.log('   But wallet balance should still be correct.\n');

  // Calculate what wallet balance should be
  const allCredits = await prisma.ledger_entries.findMany({
    where: { receiver_user_id: user.id },
    select: { amount: true, commission_type: true },
  });

  const calculatedBalance = allCredits.reduce((sum, e) => sum + Number(e.amount), 0);
  
  const actualBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true },
  });

  console.log('💰 Balance Check:');
  console.log(`   Calculated from all ledger entries: ₹${calculatedBalance.toFixed(2)}`);
  console.log(`   Actual wallet balance: ₹${Number(actualBalance?.balance || 0).toFixed(2)}`);
  console.log(`   Difference: ₹${Math.abs(calculatedBalance - Number(actualBalance?.balance || 0)).toFixed(2)}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
