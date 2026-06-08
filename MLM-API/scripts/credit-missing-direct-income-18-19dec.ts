import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';
import { newIdempotencyKey } from '../src/utils/idempotency.js';

/**
 * Script to credit all missing direct income (Level 0 SPOT commissions)
 * for purchases made between 18-19 Dec 2025
 * 
 * This fixes the issue where direct income was not credited due to buyer
 * active check failing on first purchase.
 */

async function creditMissingDirectIncomes() {
  console.log('🚀 Starting missing direct income credit for 18-19 Dec 2025...\n');

  const startDate = new Date('2025-12-18T00:00:00Z');
  const endDate = new Date('2025-12-20T00:00:00Z'); // Up to 19 Dec 23:59:59

  try {
    // Get all purchases with referrers between 18-19 Dec 2025
    const purchases = await prisma.purchases.findMany({
      where: {
        purchased_at: {
          gte: startDate,
          lt: endDate,
        },
        status: 'completed',
        is_renewal: false,
      },
    });

    console.log(`✅ Found ${purchases.length} purchases to check\n`);

    let creditedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalAmount = 0;

    for (const purchase of purchases) {
      // Get buyer details
      const buyer = await prisma.users.findUnique({
        where: { id: purchase.user_id },
        select: { id: true, display_id: true, name: true, referrer_user_id: true },
      });

      if (!buyer) {
        console.log(`⚠️  Purchase ${purchase.id}: Buyer not found`);
        skippedCount++;
        continue;
      }

      if (!buyer.referrer_user_id) {
        console.log(`⚠️  Purchase ${purchase.id}: Buyer ${buyer.display_id} has no referrer`);
        skippedCount++;
        continue;
      }

      // Get referrer details
      const referrer = await prisma.users.findUnique({
        where: { id: buyer.referrer_user_id },
        select: { id: true, display_id: true, name: true },
      });

      if (!referrer) {
        console.log(`⚠️  Purchase ${purchase.id}: No referrer found for buyer ${buyer.display_id}`);
        skippedCount++;
        continue;
      }

      // Check if direct income already exists
      const existingCommission = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchase.id,
          receiver_user_id: referrer.id,
          source_user_id: buyer.id,
          commission_type: 'SPOT',
          metadata: {
            path: ['level'],
            equals: 0,
          },
        },
      });

      if (existingCommission) {
        console.log(`⏭️  Purchase ${purchase.id}: Direct income already credited to ${referrer.display_id}`);
        skippedCount++;
        continue;
      }

      // Calculate expected direct income (5% of purchase amount)
      const spotPercent = 5.0; // Level 0 is always 5%
      const amount = Number(purchase.amount) * (spotPercent / 100);

      // Generate idempotency key
      const purchaseTimestamp = Math.floor(new Date(purchase.purchased_at).getTime() / 1000);
      const idempotencyKey = `spot:${purchase.id}:${referrer.id.toString()}:${purchaseTimestamp}`;

      // Double-check with idempotency key
      const existingByKey = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: idempotencyKey },
      });

      if (existingByKey) {
        console.log(`⏭️  Purchase ${purchase.id}: Commission exists with idempotency key`);
        skippedCount++;
        continue;
      }

      try {
        // Credit the direct income
        console.log(`\n💳 Crediting direct income for Purchase ${purchase.id}:`);
        console.log(`   Buyer: ${buyer.display_id} (${buyer.name})`);
        console.log(`   Referrer: ${referrer.display_id} (${referrer.name})`);
        console.log(`   Amount: ₹${amount.toFixed(2)} (5% of ₹${purchase.amount})`);

        const ledger = await addLedgerAndWallet({
          receiverId: referrer.id as unknown as bigint,
          sourceId: buyer.id as unknown as bigint,
          purchaseId: purchase.id as unknown as bigint,
          amount,
          type: 'SPOT',
          metadata: {
            level: 0,
            depth: 1,
            is_reinvestment: false,
            wallet_type: 'spot_balance',
          },
          idempotencyKey,
          creditedAt: purchase.purchased_at, // Use purchase date for credited_at
        });

        console.log(`   ✅ Credited! Ledger Entry ID: ${ledger.id}`);
        creditedCount++;
        totalAmount += amount;

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Total Purchases Checked: ${purchases.length}`);
    console.log(`   ✅ Credited: ${creditedCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   💰 Total Amount Credited: ₹${totalAmount.toFixed(2)}`);
    console.log(`${'='.repeat(60)}`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
creditMissingDirectIncomes()
  .then(() => {
    console.log(`\n🎉 Script completed successfully!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 Script failed:`, error);
    process.exit(1);
  });

