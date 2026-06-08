import { PrismaClient } from '@prisma/client';

// Production database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

async function verifyProductionCredited() {
  console.log('🔍 Verifying Production DB - Missing Monthly Royalty Credits (18-23 Dec 2025)...\n');

  // Date range: 18 Dec 2025 to 23 Dec 2025
  const startDate = new Date('2025-12-18T00:00:00.000Z');
  const endDate = new Date('2025-12-23T23:59:59.999Z');

  console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  // Get all MONTHLY ledger entries in this date range
  const monthlyEntries = await prisma.ledger_entries.findMany({
    where: {
      commission_type: 'MONTHLY',
      credited_at: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      receiver_user_id: true,
      source_user_id: true,
      amount: true,
      credited_at: true,
      metadata: true,
      idempotency_key: true,
    },
    orderBy: {
      credited_at: 'desc',
    },
    take: 50,
  });

  console.log(`✅ Found ${monthlyEntries.length} monthly royalty entries in date range (showing latest 50)\n`);

  // Check backfilled entries
  const backfilledEntries = monthlyEntries.filter(e => {
    const metadata = e.metadata as any;
    return metadata?.backfilled === true;
  });

  console.log(`📊 Backfilled Entries: ${backfilledEntries.length}`);
  console.log(`📊 Regular Entries: ${monthlyEntries.length - backfilledEntries.length}\n`);

  // Group by receiver
  const byReceiver = new Map<string, { count: number; total: number }>();
  monthlyEntries.forEach(e => {
    const receiverId = e.receiver_user_id.toString();
    const existing = byReceiver.get(receiverId) || { count: 0, total: 0 };
    existing.count += 1;
    existing.total += Number(e.amount);
    byReceiver.set(receiverId, existing);
  });

  console.log('📋 Top Receivers:\n');
  const sortedReceivers = Array.from(byReceiver.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  for (const [receiverId, data] of sortedReceivers) {
    const user = await prisma.users.findUnique({
      where: { id: BigInt(receiverId) },
      select: { name: true, display_id: true },
    });
    console.log(`   ${user?.name || 'N/A'} (${user?.display_id || 'N/A'}) - ${data.count} entries, ₹${data.total.toFixed(2)}`);
  }

  // Check for VINOD BAGADE (SIA00748) - User ID 729
  const vinodEntries = monthlyEntries.filter(e => e.receiver_user_id.toString() === '729');
  console.log(`\n🔍 VINOD BAGADE (SIA00748) Entries: ${vinodEntries.length}`);
  if (vinodEntries.length > 0) {
    const vinodTotal = vinodEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    console.log(`   Total Amount: ₹${vinodTotal.toFixed(2)}`);
    console.log(`   Latest Entry: ${vinodEntries[0].credited_at.toISOString()}`);
    const vinodBackfilled = vinodEntries.filter(e => {
      const metadata = e.metadata as any;
      return metadata?.backfilled === true;
    });
    console.log(`   Backfilled Entries: ${vinodBackfilled.length}`);
  }

  // Check purchases from 18-23 Dec
  const purchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      purchased_at: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      user_id: true,
      amount: true,
      purchased_at: true,
    } as any,
  });

  console.log(`\n📊 Purchases in Date Range: ${purchases.length}`);

  // Check if monthly royalty exists for these purchases
  let missingCount = 0;
  for (const purchase of purchases.slice(0, 10)) {
    const buyerId = purchase.user_id as unknown as bigint;
    const buyer = await prisma.users.findUnique({
      where: { id: buyerId },
      select: { referrer_user_id: true },
    });

    if (buyer?.referrer_user_id) {
      const referrerId = buyer.referrer_user_id as unknown as bigint;
      const monthlyForPurchase = await prisma.ledger_entries.findFirst({
        where: {
          receiver_user_id: referrerId,
          source_user_id: buyerId,
          purchase_id: purchase.id as unknown as bigint,
          commission_type: 'MONTHLY',
          credited_at: {
            gte: startDate,
          },
        },
      });

      if (!monthlyForPurchase) {
        missingCount++;
        console.log(`   ⚠️  Purchase ${purchase.id}: No monthly royalty found for referrer ${referrerId}`);
      }
    }
  }

  if (missingCount > 0) {
    console.log(`\n❌ Found ${missingCount} purchases with missing monthly royalty!`);
  } else {
    console.log(`\n✅ All checked purchases have monthly royalty entries.`);
  }

  console.log('\n' + '='.repeat(100));
}

async function main() {
  try {
    const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ Error: PRODUCTION_DATABASE_URL or DATABASE_URL not set!');
      process.exit(1);
    }
    
    console.log('🔗 Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
    console.log('');
    
    await verifyProductionCredited();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

