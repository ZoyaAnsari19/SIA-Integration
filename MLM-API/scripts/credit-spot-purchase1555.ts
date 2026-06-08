import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';
import { newIdempotencyKey } from '../src/utils/idempotency.js';

/**
 * Script to credit missing SPOT commissions for Purchase ID: 1555
 * Buyer: SIA01818 (₹7,500)
 * Missing commissions:
 * 1. SIA00300 (Level 2) - ₹187.50
 * 2. SIA00509 (Direct/Level 0) - ₹375
 */

async function creditSpotCommissions() {
  console.log('🚀 Starting SPOT commission credit for Purchase 1555...\n');

  const purchaseId = 1555n;
  const buyerId = 1799n; // SIA01818
  const purchaseAmount = 7500.0;

  // Commission details
  const commissions = [
    {
      receiverId: 281n, // SIA00300
      receiverDisplayId: 'SIA00300',
      level: 2,
      depth: 3,
      amount: 187.50, // 2.5% of ₹7,500
      spotPercent: 2.5,
    },
    {
      receiverId: 490n, // SIA00509
      receiverDisplayId: 'SIA00509',
      level: 0,
      depth: 1,
      amount: 375.0, // 5% of ₹7,500
      spotPercent: 5.0,
    },
  ];

  try {
    // Verify purchase exists
    const purchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new Error(`Purchase ${purchaseId} not found`);
    }

    // Get buyer details
    const buyer = await prisma.users.findUnique({
      where: { id: purchase.user_id },
      select: { id: true, display_id: true, name: true },
    });

    if (!buyer) {
      throw new Error(`Buyer ${purchase.user_id} not found`);
    }

    console.log(`✅ Purchase found: ID ${purchaseId}`);
    console.log(`   Buyer: ${buyer.display_id} (${buyer.name})`);
    console.log(`   Amount: ₹${purchase.amount}`);
    console.log(`   Purchase Date: ${purchase.purchased_at}\n`);

    const purchaseDate = purchase.purchased_at;

    // Process each commission
    for (const comm of commissions) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing: ${comm.receiverDisplayId} (Level ${comm.level})`);
      console.log(`${'='.repeat(60)}`);

      // Verify receiver exists
      const receiver = await prisma.users.findUnique({
        where: { id: comm.receiverId },
        select: { id: true, display_id: true, name: true },
      });

      if (!receiver) {
        console.error(`❌ Receiver ${comm.receiverId} (${comm.receiverDisplayId}) not found`);
        continue;
      }

      console.log(`✅ Receiver found: ${receiver.display_id} (${receiver.name})`);

      // Check if commission already exists
      const existingCommissions = await prisma.ledger_entries.findMany({
        where: {
          purchase_id: purchaseId,
          receiver_user_id: comm.receiverId,
          source_user_id: buyerId,
          commission_type: 'SPOT',
        },
      });

      // Check if any existing commission has the correct level in metadata
      const existingForLevel = existingCommissions.find((entry) => {
        const meta = entry.metadata as any;
        return meta?.level === comm.level || (comm.level === 0 && meta?.depth === 1);
      });

      if (existingForLevel) {
        console.log(`⚠️  Commission already exists!`);
        console.log(`   Ledger Entry ID: ${existingForLevel.id}`);
        console.log(`   Amount: ₹${existingForLevel.amount}`);
        console.log(`   Credited At: ${existingForLevel.credited_at}`);
        continue;
      }

      // Generate idempotency key
      const purchaseTimestamp = Math.floor(purchaseDate.getTime() / 1000);
      const idempotencyKey = comm.level === 0
        ? `spot:${purchaseId}:${comm.receiverId.toString()}:${purchaseTimestamp}`
        : `teamspot:${comm.depth}:${purchaseId}:${comm.receiverId.toString()}:${purchaseTimestamp}`;
      
      console.log(`🔑 Idempotency Key: ${idempotencyKey}`);

      // Double-check with idempotency key
      const existingByKey = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: idempotencyKey },
      });

      if (existingByKey) {
        console.log(`⚠️  Commission already exists with this idempotency key!`);
        console.log(`   Ledger Entry ID: ${existingByKey.id}`);
        continue;
      }

      // Credit the commission
      console.log(`\n💳 Crediting SPOT commission...`);
      console.log(`   Amount: ₹${comm.amount}`);
      console.log(`   Level: ${comm.level} (depth ${comm.depth})`);

      const ledger = await addLedgerAndWallet({
        receiverId: comm.receiverId,
        sourceId: buyerId,
        purchaseId,
        amount: comm.amount,
        type: 'SPOT',
        metadata: {
          level: comm.level,
          depth: comm.depth,
          is_reinvestment: false,
          wallet_type: 'spot_balance',
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
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ All commissions processed!`);
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

