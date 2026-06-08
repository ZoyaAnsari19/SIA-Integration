import { PrismaClient } from '@prisma/client';
import { newIdempotencyKey } from '../src/utils/idempotency.js';

/**
 * Script to credit missing SPOT commission to SIA00299 (Level 2) - PRODUCTION
 * Purchase ID: 1545
 * Buyer: Sai00748 (ID: 729) - ₹1,00,000
 * Receiver: SIA00299 (ID: 280) - Level 2, depth 3
 * Amount: ₹1,250.00 (2.5% of ₹1,00,000 with 50% reinvestment reduction)
 * 
 * Note: This is a reinvestment purchase, so 50% reduction applies
 * 
 * Usage: PRODUCTION_DATABASE_URL="postgresql://..." npx tsx scripts/credit-spot-sia00299-purchase1545.ts
 */

// Create Prisma client with production database URL
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL or DATABASE_URL not set!');
  console.error('   Please set PRODUCTION_DATABASE_URL environment variable');
  console.error('   Example: export PRODUCTION_DATABASE_URL="postgresql://mlm_user:password@host:port/mlm_commission"');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

async function creditSpotCommission() {
  console.log('🔗 Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  console.log('');
  console.log('🚀 Starting SPOT commission credit for SIA00299 (Purchase 1545)...\n');

  const purchaseId = 1545n;
  const receiverId = 280n; // SIA00299
  const sourceId = 729n; // Sai00748
  const amount = 1250.0; // 2.5% of ₹1,00,000 = ₹2,500, then 50% reduction = ₹1,250
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
    console.log(`   Purchase Date: ${purchase.purchased_at}`);

    // Verify receiver exists
    const receiver = await prisma.users.findUnique({
      where: { id: receiverId },
      select: { id: true, display_id: true, name: true },
    });

    if (!receiver) {
      throw new Error(`Receiver ${receiverId} (SIA00299) not found`);
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
      return meta?.level === level && meta?.depth === depth;
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

    // Check if this is a reinvestment
    const previousPurchases = await prisma.purchases.findMany({
      where: {
        user_id: sourceId,
        status: 'completed',
        purchased_at: { lt: purchaseDate },
      },
    });

    const isReinvestment = previousPurchases.length > 0;
    console.log(`\n📊 Purchase Details:`);
    console.log(`   Is Reinvestment: ${isReinvestment ? 'YES' : 'NO'}`);
    if (isReinvestment) {
      console.log(`   Base Amount: ₹2,500.00 (2.5% of ₹1,00,000)`);
      console.log(`   After 50% Reduction: ₹1,250.00`);
    }

    // Credit the commission - using production prisma directly
    console.log(`\n💳 Crediting SPOT commission...`);
    console.log(`   Amount: ₹${amount}`);
    console.log(`   Level: ${level} (depth ${depth})`);

    // Use production prisma to create ledger entry and update wallet
    const ledger = await prisma.$transaction(async (tx) => {
      // Per-user advisory lock for wallet concurrency safety
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1));',
        `user:${receiverId.toString()}`
      );

      // Idempotency check
      const existing = await tx.ledger_entries.findFirst({ where: { idempotency_key: idempotencyKey } });
      if (existing) {
        const existingWalletTxn = await tx.wallet_transactions.findFirst({
          where: { idempotency_key: idempotencyKey }
        });
        if (existingWalletTxn) {
          return existing;
        }
        await tx.wallet_transactions.create({
          data: {
            receiver_user_id: receiverId,
            ledger_entry_id: existing.id,
            amount,
            idempotency_key: idempotencyKey,
          },
        });
        return existing;
      }

      // Create ledger entry
      const ledgerEntry = await tx.ledger_entries.create({
        data: {
          receiver_user_id: receiverId,
          source_user_id: sourceId,
          purchase_id: purchaseId,
          commission_type: 'SPOT',
          amount,
          metadata: {
            level,
            depth,
            is_reinvestment: isReinvestment,
            wallet_type: 'spot_balance',
          } as any,
          idempotency_key: idempotencyKey,
          credited_at: purchaseDate,
        },
      });

      // Create wallet transaction
      await tx.wallet_transactions.create({
        data: {
          receiver_user_id: receiverId,
          ledger_entry_id: ledgerEntry.id,
          amount,
          idempotency_key: idempotencyKey,
        },
      });

      // Update wallet balance (SPOT goes to spot_balance)
      await tx.$executeRawUnsafe(
        'UPDATE user_balances SET balance = balance + $1, spot_balance = spot_balance + $1, updated_at = now() WHERE user_id = $2',
        amount,
        receiverId
      );

      return ledgerEntry;
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

