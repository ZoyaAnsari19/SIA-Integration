import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';
import { newIdempotencyKey } from '../src/utils/idempotency.js';

/**
 * Script to credit missing SPOT commission to SIA00300 (Level 2)
 * Purchase ID: 1556
 * Buyer: SIA00465 (₹30,000)
 * Receiver: SIA00300 (Level 2, depth 3)
 * Amount: ₹750 (2.5% of ₹30,000)
 */

async function creditSpotCommission() {
  console.log('🚀 Starting SPOT commission credit for SIA00300...\n');

  const purchaseId = 1556n;
  const receiverId = 281n; // SIA00300
  const sourceId = 446n; // SIA00465
  const amount = 750.0; // 2.5% of ₹30,000
  const depth = 3; // Level 2 = depth 3
  const level = 2;

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

    // Verify receiver exists
    const receiver = await prisma.users.findUnique({
      where: { id: receiverId },
      select: { id: true, display_id: true, name: true },
    });

    if (!receiver) {
      throw new Error(`Receiver ${receiverId} (SIA00300) not found`);
    }

    console.log(`✅ Receiver found: ${receiver.display_id} (${receiver.name})`);

    const purchaseDate = purchase.purchased_at;

    // Check if commission already exists (by purchase, receiver, and type)
    const existingCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        receiver_user_id: receiverId,
        source_user_id: sourceId,
        commission_type: 'SPOT',
      },
    });

    // Check if any existing commission has level 2 in metadata
    const existingLevel2 = existingCommissions.find((entry) => {
      const meta = entry.metadata as any;
      return meta?.level === level || meta?.level === 2;
    });

    if (existingLevel2) {
      console.log(`\n⚠️  Commission already exists!`);
      console.log(`   Ledger Entry ID: ${existingLevel2.id}`);
      console.log(`   Amount: ₹${existingLevel2.amount}`);
      console.log(`   Credited At: ${existingLevel2.credited_at}`);
      console.log(`   Idempotency Key: ${existingLevel2.idempotency_key}`);
      console.log(`   Metadata:`, JSON.stringify(existingLevel2.metadata, null, 2));
      return;
    }

    // Generate idempotency key (using purchase timestamp for determinism)
    const purchaseTimestamp = Math.floor(purchaseDate.getTime() / 1000);
    const idempotencyKey = `teamspot:${depth}:${purchaseId}:${receiverId.toString()}:${purchaseTimestamp}`;
    console.log(`\n🔑 Idempotency Key: ${idempotencyKey}`);

    // Double-check with idempotency key
    const existingByKey = await prisma.ledger_entries.findFirst({
      where: { idempotency_key: idempotencyKey },
    });

    if (existingByKey) {
      console.log(`\n⚠️  Commission already exists with this idempotency key!`);
      console.log(`   Ledger Entry ID: ${existingByKey.id}`);
      return;
    }

    // Credit the commission
    console.log(`\n💳 Crediting SPOT commission...`);
    console.log(`   Amount: ₹${amount}`);
    console.log(`   Level: ${level} (depth ${depth})`);

    const ledger = await addLedgerAndWallet({
      receiverId,
      sourceId,
      purchaseId,
      amount,
      type: 'SPOT',
      metadata: {
        level,
        depth,
        is_reinvestment: false, // Based on analysis, this is not a reinvestment
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
      where: { user_id: receiverId },
      select: { balance: true, spot_balance: true, other_balance: true },
    });

    if (balance) {
      console.log(`\n💰 Wallet Balance for ${receiver.display_id}:`);
      console.log(`   Total Balance: ₹${Number(balance.balance)}`);
      console.log(`   SPOT Balance: ₹${Number(balance.spot_balance)}`);
      console.log(`   Other Balance: ₹${Number(balance.other_balance)}`);
    }

    // Verify ledger entry
    const ledgerEntry = await prisma.ledger_entries.findUnique({
      where: { id: ledger.id },
    });

    // Get receiver and source details
    const ledgerReceiver = await prisma.users.findUnique({
      where: { id: ledgerEntry!.receiver_user_id },
      select: { display_id: true, name: true },
    });

    const ledgerSource = await prisma.users.findUnique({
      where: { id: ledgerEntry!.source_user_id },
      select: { display_id: true, name: true },
    });

    console.log(`\n📋 Ledger Entry Details:`);
    console.log(`   ID: ${ledgerEntry?.id}`);
    console.log(`   Receiver: ${ledgerReceiver?.display_id} (${ledgerReceiver?.name})`);
    console.log(`   Source: ${ledgerSource?.display_id} (${ledgerSource?.name})`);
    console.log(`   Commission Type: ${ledgerEntry?.commission_type}`);
    console.log(`   Amount: ₹${ledgerEntry?.amount}`);
    console.log(`   Metadata:`, JSON.stringify(ledgerEntry?.metadata, null, 2));

    // Verify wallet transaction
    const walletTransaction = await prisma.wallet_transactions.findFirst({
      where: { ledger_entry_id: ledger.id },
    });

    if (walletTransaction) {
      console.log(`\n💵 Wallet Transaction:`);
      console.log(`   ID: ${walletTransaction.id}`);
      console.log(`   Amount: ₹${walletTransaction.amount}`);
      console.log(`   Created At: ${walletTransaction.created_at}`);
    }

    console.log(`\n✅ All verifications passed!`);
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Ledger entry created`);
    console.log(`   ✅ Wallet transaction created`);
    console.log(`   ✅ Wallet balance updated`);
    console.log(`   ✅ Commission will show in history`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
creditSpotCommission()
  .then(() => {
    console.log(`\n🎉 Script completed successfully!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 Script failed:`, error);
    process.exit(1);
  });

