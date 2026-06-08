import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

/**
 * Script to credit missing Level 1 SPOT commissions
 * Purchase 1545: SIA00748 (₹1,00,000) - SIA00300 should get Level 1 SPOT (₹2,500)
 * Purchase 1549: SIA01887 (₹1,00,000) - SIA00573 should get Level 1 SPOT (₹2,500)
 */

async function creditSpotCommissions() {
  console.log('🚀 Starting Level 1 SPOT commission credit for Purchases 1545 & 1549...\n');

  // Commission details
  const commissions = [
    {
      purchaseId: 1545n,
      buyerId: 748n, // SIA00748
      buyerDisplayId: 'SIA00748',
      receiverId: 281n, // SIA00300
      receiverDisplayId: 'SIA00300',
      level: 1,
      depth: 2,
      amount: 2500.0, // 2.5% of ₹1,00,000
      spotPercent: 2.5,
    },
    {
      purchaseId: 1549n,
      buyerId: 1887n, // SIA01887
      buyerDisplayId: 'SIA01887',
      receiverId: 554n, // SIA00573
      receiverDisplayId: 'SIA00573',
      level: 1,
      depth: 2,
      amount: 2500.0, // 2.5% of ₹1,00,000
      spotPercent: 2.5,
    },
  ];

  try {
    let creditedCount = 0;
    let skippedCount = 0;

    // Process each commission
    for (const comm of commissions) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing Purchase ${comm.purchaseId}: ${comm.receiverDisplayId} (Level ${comm.level})`);
      console.log(`${'='.repeat(60)}`);

      // Verify purchase exists
      const purchase = await prisma.purchases.findUnique({
        where: { id: comm.purchaseId },
      });

      if (!purchase) {
        console.error(`❌ Purchase ${comm.purchaseId} not found`);
        skippedCount++;
        continue;
      }

      // Get buyer details
      const buyer = await prisma.users.findUnique({
        where: { id: purchase.user_id },
        select: { id: true, display_id: true, name: true },
      });

      if (!buyer) {
        console.error(`❌ Buyer ${purchase.user_id} not found`);
        skippedCount++;
        continue;
      }

      const purchaseDate = purchase.purchased_at;

      console.log(`✅ Purchase found: ID ${comm.purchaseId}`);
      console.log(`   Buyer: ${buyer.display_id} (${buyer.name})`);
      console.log(`   Amount: ₹${purchase.amount}`);
      console.log(`   Purchase Date: ${purchaseDate}`);

      // Verify receiver exists
      const receiver = await prisma.users.findUnique({
        where: { id: comm.receiverId },
        select: { id: true, display_id: true, name: true },
      });

      if (!receiver) {
        console.error(`❌ Receiver ${comm.receiverId} (${comm.receiverDisplayId}) not found`);
        skippedCount++;
        continue;
      }

      console.log(`✅ Receiver found: ${receiver.display_id} (${receiver.name})`);

      // Generate idempotency key
      const purchaseTimestamp = Math.floor(purchaseDate.getTime() / 1000);
      const idempotencyKey = `teamspot:${comm.depth}:${comm.purchaseId}:${comm.receiverId.toString()}:${purchaseTimestamp}`;
      
      console.log(`🔑 Idempotency Key: ${idempotencyKey}`);

      // Check if commission already exists
      const existingByKey = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: idempotencyKey },
      });

      if (existingByKey) {
        console.log(`⚠️  Commission already exists with this idempotency key!`);
        console.log(`   Ledger Entry ID: ${existingByKey.id}`);
        console.log(`   Amount: ₹${existingByKey.amount}`);
        skippedCount++;
        continue;
      }

      // Also check by purchase, receiver, and level
      const existingCommissions = await prisma.ledger_entries.findMany({
        where: {
          purchase_id: comm.purchaseId,
          receiver_user_id: comm.receiverId,
          source_user_id: purchase.user_id,
          commission_type: 'SPOT',
        },
      });

      const existingForLevel = existingCommissions.find((entry) => {
        const meta = entry.metadata as any;
        return meta?.level === comm.level && meta?.depth === comm.depth;
      });

      if (existingForLevel) {
        console.log(`⚠️  Commission already exists!`);
        console.log(`   Ledger Entry ID: ${existingForLevel.id}`);
        console.log(`   Amount: ₹${existingForLevel.amount}`);
        skippedCount++;
        continue;
      }

      // Credit the commission
      console.log(`\n💳 Crediting SPOT commission...`);
      console.log(`   Amount: ₹${comm.amount}`);
      console.log(`   Level: ${comm.level} (depth ${comm.depth})`);
      console.log(`   Spot Percent: ${comm.spotPercent}%`);

      const ledger = await addLedgerAndWallet({
        receiverId: comm.receiverId,
        sourceId: purchase.user_id as bigint,
        purchaseId: comm.purchaseId,
        amount: comm.amount,
        type: 'SPOT',
        metadata: {
          level: comm.level,
          depth: comm.depth,
          is_reinvestment: false,
          wallet_type: 'spot_balance',
          credited_by_script: true, // Mark as credited by script
        },
        idempotencyKey,
        creditedAt: purchaseDate, // Use purchase date for credited_at
      });

      console.log(`\n✅ SPOT commission credited successfully!`);
      console.log(`   Ledger Entry ID: ${ledger.id}`);
      console.log(`   Amount: ₹${ledger.amount}`);
      console.log(`   Credited At: ${ledger.credited_at}`);

      // Verify wallet balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: comm.receiverId },
        select: { balance: true, spot_balance: true, other_balance: true },
      });

      if (balance) {
        console.log(`\n💰 Wallet Balance for ${receiver.display_id}:`);
        console.log(`   Total Balance: ₹${Number(balance.balance)}`);
        console.log(`   SPOT Balance: ₹${Number(balance.spot_balance)}`);
        console.log(`   Other Balance: ₹${Number(balance.other_balance)}`);
      }

      creditedCount++;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   ✅ Credited: ${creditedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
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
creditSpotCommissions()
  .then(() => {
    console.log(`\n🎉 Script completed successfully!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 Script failed:`, error);
    process.exit(1);
  });

