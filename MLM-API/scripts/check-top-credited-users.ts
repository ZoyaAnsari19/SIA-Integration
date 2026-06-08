import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getTopCreditedUsers() {
  console.log('🔍 Finding Top 5 Users by Monthly Royalty Credited (18-23 Dec 2025)...\n');

  // Date range: 18 Dec 2025 to 23 Dec 2025
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');

  console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  // Get all MONTHLY ledger entries in this date range that were backfilled by our script
  const monthlyEntries = await prisma.ledger_entries.findMany({
    where: {
      commission_type: 'MONTHLY',
      credited_at: {
        gte: startDate,
        lte: endDate,
      },
      metadata: {
        path: ['backfilled'],
        equals: true,
      },
    },
    select: {
      receiver_user_id: true,
      amount: true,
      credited_at: true,
      metadata: true,
    },
  });

  console.log(`✅ Found ${monthlyEntries.length} monthly royalty entries in date range\n`);

  // Group by user and sum amounts
  const userTotals = new Map<string, { total: number; count: number; userId: string }>();

  for (const entry of monthlyEntries) {
    const userId = entry.receiver_user_id.toString();
    const amount = Number(entry.amount);

    if (userTotals.has(userId)) {
      const existing = userTotals.get(userId)!;
      existing.total += amount;
      existing.count += 1;
    } else {
      userTotals.set(userId, {
        total: amount,
        count: 1,
        userId,
      });
    }
  }

  // Convert to array and sort by total
  const sortedUsers = Array.from(userTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5); // Top 5

  // Get user details
  const userIds = sortedUsers.map(u => BigInt(u.userId));
  const users = await prisma.users.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      display_id: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id.toString(), u]));

  console.log('🏆 Top 5 Users by Monthly Royalty Credited:\n');
  console.log('='.repeat(100));

  for (let i = 0; i < sortedUsers.length; i++) {
    const userData = sortedUsers[i];
    const user = userMap.get(userData.userId);

    console.log(`\n${i + 1}. ${user?.name || 'N/A'} (${user?.display_id || 'N/A'})`);
    console.log(`   Email: ${user?.email || 'N/A'}`);
    console.log(`   User ID: ${userData.userId}`);
    console.log(`   Total Credited: ₹${userData.total.toFixed(2)}`);
    console.log(`   Total Entries: ${userData.count} entries`);
    console.log(`   Average per Entry: ₹${(userData.total / userData.count).toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log(`\n📊 Summary:`);
  console.log(`   Total Users Credited: ${userTotals.size}`);
  console.log(`   Total Entries: ${monthlyEntries.length}`);
  console.log(`   Total Amount Credited: ₹${Array.from(userTotals.values()).reduce((sum, u) => sum + u.total, 0).toFixed(2)}`);
}

async function main() {
  try {
    await getTopCreditedUsers();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

