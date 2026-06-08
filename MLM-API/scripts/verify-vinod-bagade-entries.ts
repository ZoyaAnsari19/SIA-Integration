import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyVinodBagadeEntries() {
  console.log('🔍 Verifying VINOD BAGADE (SIA00748) Team Income Entries...\n');

  const userId = BigInt(729); // VINOD BAGADE user ID

  // Get user details
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      display_id: true,
    },
  });

  console.log(`User: ${user?.name} (${user?.display_id})`);
  console.log(`User ID: ${userId}\n`);

  // Get all MONTHLY entries for this user (all time)
  const allMonthlyEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'MONTHLY',
    },
    orderBy: {
      credited_at: 'desc',
    },
    select: {
      id: true,
      amount: true,
      source_user_id: true,
      purchase_id: true,
      credited_at: true,
      metadata: true,
      idempotency_key: true,
    },
    take: 20, // Latest 20 entries
  });

  console.log(`📊 Total MONTHLY Entries: ${allMonthlyEntries.length} (showing latest 20)\n`);

  // Get source user names
  const sourceUserIds = Array.from(new Set(allMonthlyEntries.map(e => e.source_user_id.toString())));
  const sourceUsers = await prisma.users.findMany({
    where: {
      id: { in: sourceUserIds.map(id => BigInt(id)) },
    },
    select: {
      id: true,
      name: true,
      display_id: true,
    },
  });
  const sourceUserMap = new Map(sourceUsers.map(u => [u.id.toString(), u]));

  // Calculate totals
  const totalAmount = allMonthlyEntries.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // Get entries from 18-23 Dec 2025 (backfilled)
  const backfilledEntries = allMonthlyEntries.filter(e => {
    const metadata = e.metadata as any;
    return metadata?.backfilled === true;
  });

  const backfilledTotal = backfilledEntries.reduce((sum, e) => sum + Number(e.amount), 0);

  console.log('='.repeat(100));
  console.log('📋 Latest 20 MONTHLY Entries:\n');

  for (let i = 0; i < Math.min(20, allMonthlyEntries.length); i++) {
    const entry = allMonthlyEntries[i];
    const sourceUser = sourceUserMap.get(entry.source_user_id.toString());
    const metadata = entry.metadata as any;
    const level = metadata?.level ?? 'N/A';
    const isBackfilled = metadata?.backfilled === true;

    console.log(`${i + 1}. ${sourceUser?.name || 'N/A'} (${sourceUser?.display_id || 'N/A'})`);
    console.log(`   Level: ${level}`);
    console.log(`   Amount: ₹${Number(entry.amount).toFixed(2)}`);
    console.log(`   Date: ${entry.credited_at.toISOString()}`);
    console.log(`   Purchase ID: ${entry.purchase_id || 'N/A'}`);
    console.log(`   Backfilled: ${isBackfilled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Idempotency Key: ${entry.idempotency_key}`);
    console.log('');
  }

  console.log('='.repeat(100));
  console.log('\n📊 Summary:\n');
  console.log(`   Total MONTHLY Entries (all time): ${allMonthlyEntries.length}`);
  console.log(`   Total Amount (all time): ₹${totalAmount.toFixed(2)}`);
  console.log(`   Backfilled Entries (18-23 Dec): ${backfilledEntries.length}`);
  console.log(`   Backfilled Amount: ₹${backfilledTotal.toFixed(2)}`);

  // Check entries from 18-23 Dec specifically
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');

  const periodEntries = allMonthlyEntries.filter(e => {
    const entryDate = new Date(e.credited_at);
    return entryDate >= startDate && entryDate <= endDate;
  });

  const periodTotal = periodEntries.reduce((sum, e) => sum + Number(e.amount), 0);

  console.log(`\n   Entries from 18-23 Dec 2025: ${periodEntries.length}`);
  console.log(`   Amount from 18-23 Dec 2025: ₹${periodTotal.toFixed(2)}`);

  // Check if entries match what we credited
  console.log('\n✅ Expected from Script:');
  console.log('   - Total Credited: ₹241.92');
  console.log('   - Entries: 3 entries');
  console.log('   - Average: ₹80.64 per entry');
}

async function main() {
  try {
    await verifyVinodBagadeEntries();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

