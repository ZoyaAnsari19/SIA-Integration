import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function checkLocalDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = process.argv.includes('--production') || process.env.ALLOW_PRODUCTION === 'true';
  
  console.log(`\n🔍 Database Connection Check:`);
  console.log(`   URL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  
  if ((dbUrl.includes('production') || dbUrl.includes('prod') || dbUrl.includes('azure') || dbUrl.includes('k8s')) && !isProduction) {
    console.log(`\n⚠️  WARNING: This appears to be a PRODUCTION database!`);
    console.log(`   Scripts are designed for LOCAL database only.`);
    console.log(`   Use --production flag or set ALLOW_PRODUCTION=true to proceed.\n`);
    process.exit(1);
  }
  
  if (isProduction) {
    console.log(`   ⚠️  PRODUCTION MODE - Proceeding with caution...\n`);
  } else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('5432') || dbUrl.includes('5433')) {
    console.log(`   ✅ Local database detected\n`);
  } else {
    console.log(`   ⚠️  Could not confirm local database. Proceeding with caution...\n`);
  }
}

async function findPurchaseFromInput(args: string[]): Promise<{ purchase: any; purchaseRequest: any | null }> {
  let purchaseId: bigint | null = null;
  let purchaseRequest: any | null = null;
  let purchase: any | null = null;

  // Parse command line arguments
  const purchaseIdArg = args.findIndex(arg => arg === '--purchase-id');
  const requestIdArg = args.findIndex(arg => arg === '--request-id');
  const txnIdArg = args.findIndex(arg => arg === '--txn-id');
  const userArg = args.findIndex(arg => arg === '--user');
  const amountArg = args.findIndex(arg => arg === '--amount');

  // Option 1: Direct purchase ID
  if (purchaseIdArg !== -1 && args[purchaseIdArg + 1]) {
    purchaseId = BigInt(args[purchaseIdArg + 1]);
    console.log(`📋 Using Purchase ID: ${purchaseId}`);
    purchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new Error(`Purchase with ID ${purchaseId} not found`);
    }
  }
  // Option 2: Purchase Request ID
  else if (requestIdArg !== -1 && args[requestIdArg + 1]) {
    const requestId = BigInt(args[requestIdArg + 1]);
    console.log(`📋 Using Purchase Request ID: ${requestId}`);
    purchaseRequest = await prisma.purchase_requests.findUnique({
      where: { id: requestId },
    });
    if (!purchaseRequest) {
      throw new Error(`Purchase request with ID ${requestId} not found`);
    }
    purchase = await prisma.purchases.findFirst({
      where: {
        user_id: purchaseRequest.user_id,
        amount: purchaseRequest.amount,
        txn_id: purchaseRequest.txn_id,
      },
      orderBy: { purchased_at: 'desc' },
    });
    if (!purchase) {
      throw new Error(`Purchase not found for request ID ${requestId}`);
    }
  }
  // Option 3: Txn ID
  else if (txnIdArg !== -1 && args[txnIdArg + 1]) {
    const txnId = args[txnIdArg + 1];
    console.log(`📋 Using Txn ID: ${txnId}`);
    purchaseRequest = await prisma.purchase_requests.findFirst({
      where: { txn_id: txnId },
      orderBy: { created_at: 'desc' },
    });
    if (!purchaseRequest) {
      throw new Error(`Purchase request with txn_id ${txnId} not found`);
    }
    purchase = await prisma.purchases.findFirst({
      where: {
        user_id: purchaseRequest.user_id,
        amount: purchaseRequest.amount,
        txn_id: purchaseRequest.txn_id,
      },
      orderBy: { purchased_at: 'desc' },
    });
    if (!purchase) {
      throw new Error(`Purchase not found for txn_id ${txnId}`);
    }
  }
  // Option 4: User Display ID + Amount
  else if (userArg !== -1 && amountArg !== -1 && args[userArg + 1] && args[amountArg + 1]) {
    const displayId = args[userArg + 1];
    const amount = parseFloat(args[amountArg + 1]);
    console.log(`📋 Using User: ${displayId}, Amount: ₹${amount}`);
    
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
    });
    if (!user) {
      throw new Error(`User with display_id ${displayId} not found`);
    }
    
    purchaseRequest = await prisma.purchase_requests.findFirst({
      where: {
        user_id: user.id,
        amount: amount,
      },
      orderBy: { created_at: 'desc' },
    });
    
    if (purchaseRequest) {
      purchase = await prisma.purchases.findFirst({
        where: {
          user_id: user.id,
          amount: amount,
          txn_id: purchaseRequest.txn_id,
        },
        orderBy: { purchased_at: 'desc' },
      });
    } else {
      purchase = await prisma.purchases.findFirst({
        where: {
          user_id: user.id,
          amount: amount,
        },
        orderBy: { purchased_at: 'desc' },
      });
    }
    
    if (!purchase) {
      throw new Error(`Purchase not found for user ${displayId} with amount ₹${amount}`);
    }
  } else {
    throw new Error(`Invalid arguments. Use one of:
  --purchase-id <id>
  --request-id <id>
  --txn-id <id>
  --user <display_id> --amount <amount>`);
  }

  return { purchase, purchaseRequest };
}

async function validatePurchase(purchase: any, force: boolean): Promise<void> {
  const user = await prisma.users.findUnique({
    where: { id: purchase.user_id },
    select: { display_id: true, name: true },
  });

  console.log('\n🔍 VALIDATION:');
  
  const expectedAmount = 500000;
  const actualAmount = Number(purchase.amount);
  const expectedUser = 'SIA02077';
  const actualUser = user?.display_id || '';
  const expectedTxnId = '333241827453';
  const actualTxnId = purchase.txn_id || '';

  let isValid = true;
  let warnings: string[] = [];

  if (Math.abs(actualAmount - expectedAmount) >= 0.01) {
    warnings.push(`Amount mismatch: Expected ₹${expectedAmount}, Found ₹${actualAmount}`);
    isValid = false;
  } else {
    console.log(`   ✅ Amount: ₹${actualAmount}`);
  }

  if (actualUser !== expectedUser) {
    warnings.push(`User mismatch: Expected ${expectedUser}, Found ${actualUser}`);
    isValid = false;
  } else {
    console.log(`   ✅ User: ${actualUser}`);
  }

  if (actualTxnId && actualTxnId !== expectedTxnId) {
    warnings.push(`Txn ID mismatch: Expected ${expectedTxnId}, Found ${actualTxnId}`);
  } else if (actualTxnId === expectedTxnId) {
    console.log(`   ✅ Txn ID: ${actualTxnId}`);
  }

  const hoursSincePurchase = (Date.now() - new Date(purchase.purchased_at).getTime()) / (1000 * 60 * 60);
  if (hoursSincePurchase > 24) {
    warnings.push(`Purchase is ${hoursSincePurchase.toFixed(1)} hours old (older than 24 hours)`);
  }

  if (warnings.length > 0) {
    console.log(`\n   ⚠️  Warnings:`);
    warnings.forEach(w => console.log(`      - ${w}`));
  }

  if (!isValid && !force) {
    throw new Error('Validation failed. Use --force to bypass safety checks.');
  }

  if (!isValid && force) {
    console.log(`\n   ⚠️  Proceeding with --force flag (bypassing validation)\n`);
  } else {
    console.log(`\n   ✅ Validation passed\n`);
  }
}

async function revertPurchase(purchaseId: bigint, dryRun: boolean, force: boolean): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log(dryRun ? '🧪 DRY RUN MODE - No changes will be made' : '🔄 REVERTING PURCHASE');
  console.log('='.repeat(80) + '\n');

  // Get all related data
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
  });

  if (!purchase) {
    throw new Error(`Purchase ${purchaseId} not found`);
  }

  // Validate purchase
  await validatePurchase(purchase, force);

  // Get purchase request
  const purchaseRequest = await prisma.purchase_requests.findFirst({
    where: {
      user_id: purchase.user_id,
      amount: purchase.amount,
      txn_id: purchase.txn_id,
    },
    orderBy: { created_at: 'desc' },
  });

  // Get all ledger entries
  const ledgerEntries = await prisma.ledger_entries.findMany({
    where: { purchase_id: purchaseId },
  });

  // Get all wallet transactions
  const ledgerEntryIds = ledgerEntries.map(le => le.id);
  const walletTransactions = ledgerEntryIds.length > 0
    ? await prisma.wallet_transactions.findMany({
        where: { ledger_entry_id: { in: ledgerEntryIds } },
      })
    : [];

  // Get all pending commissions
  const pendingCommissions = await prisma.pending_commissions.findMany({
    where: { purchase_id: purchaseId },
  });

  console.log(`📊 Data to be reverted:`);
  console.log(`   Ledger Entries: ${ledgerEntries.length}`);
  console.log(`   Wallet Transactions: ${walletTransactions.length}`);
  console.log(`   Pending Commissions: ${pendingCommissions.length}`);
  console.log('');

  // Calculate balance adjustments per user
  const balanceAdjustments = new Map<string, { spotAmount: number; otherAmount: number }>();

  for (const entry of ledgerEntries) {
    const userId = entry.receiver_user_id.toString();
    const amount = Number(entry.amount);

    if (!balanceAdjustments.has(userId)) {
      balanceAdjustments.set(userId, { spotAmount: 0, otherAmount: 0 });
    }

    const adj = balanceAdjustments.get(userId)!;
    if (entry.commission_type === 'SPOT') {
      adj.spotAmount += amount;
    } else {
      adj.otherAmount += amount;
    }
  }

  // Show balance adjustments
  if (balanceAdjustments.size > 0) {
    console.log(`💰 Balance Adjustments:`);
    for (const [userId, adj] of balanceAdjustments.entries()) {
      const user = await prisma.users.findUnique({
        where: { id: BigInt(userId) },
        select: { display_id: true, name: true },
      });
      console.log(`   ${user?.display_id || userId}:`);
      if (adj.spotAmount > 0) {
        console.log(`      SPOT: -₹${adj.spotAmount.toFixed(2)}`);
      }
      if (adj.otherAmount > 0) {
        console.log(`      Other: -₹${adj.otherAmount.toFixed(2)}`);
      }
    }
    console.log('');
  }

  if (dryRun) {
    console.log('🧪 DRY RUN - No changes made. Use without --dry-run to execute revert.\n');
    return;
  }

  // Confirm before proceeding
  if (!force) {
    console.log('⚠️  This will permanently delete data. Press Ctrl+C to cancel, or wait 5 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Execute revert in transaction
  await prisma.$transaction(async (tx) => {
    console.log('🔄 Starting revert transaction...\n');

    // Step 1: Delete wallet transactions
    if (walletTransactions.length > 0) {
      console.log(`   1. Deleting ${walletTransactions.length} wallet transactions...`);
      await tx.wallet_transactions.deleteMany({
        where: { ledger_entry_id: { in: ledgerEntryIds } },
      });
      console.log(`      ✅ Deleted wallet transactions`);
    }

    // Step 2: Delete ledger entries
    if (ledgerEntries.length > 0) {
      console.log(`   2. Deleting ${ledgerEntries.length} ledger entries...`);
      await tx.ledger_entries.deleteMany({
        where: { purchase_id: purchaseId },
      });
      console.log(`      ✅ Deleted ledger entries`);
    }

    // Step 3: Delete pending commissions
    if (pendingCommissions.length > 0) {
      console.log(`   3. Deleting ${pendingCommissions.length} pending commissions...`);
      await tx.pending_commissions.deleteMany({
        where: { purchase_id: purchaseId },
      });
      console.log(`      ✅ Deleted pending commissions`);
    }

    // Step 4: Adjust user balances
    if (balanceAdjustments.size > 0) {
      console.log(`   4. Adjusting balances for ${balanceAdjustments.size} users...`);
      for (const [userId, adj] of balanceAdjustments.entries()) {
        const userIdBigInt = BigInt(userId);
        
        // Get current balance
        const currentBalance = await tx.user_balances.findUnique({
          where: { user_id: userIdBigInt },
        });

        if (currentBalance) {
          // Update balance using raw SQL to avoid decimal issues
          // SPOT goes to spot_balance, other commissions go to other_balance
          // Both reduce total balance
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance - $1,
                 spot_balance = spot_balance - $2,
                 other_balance = other_balance - $3,
                 updated_at = now()
             WHERE user_id = $4`,
            adj.spotAmount + adj.otherAmount, // Total to subtract from balance
            adj.spotAmount, // Subtract from spot_balance
            adj.otherAmount, // Subtract from other_balance
            userIdBigInt
          );

          const user = await prisma.users.findUnique({
            where: { id: userIdBigInt },
            select: { display_id: true },
          });
          console.log(`      ✅ Adjusted balance for ${user?.display_id || userId}`);
        }
      }
      console.log(`      ✅ All balances adjusted`);
    }

    // Step 5: Update purchase request status
    if (purchaseRequest) {
      console.log(`   5. Updating purchase request status to 'rejected'...`);
      await tx.purchase_requests.update({
        where: { id: purchaseRequest.id },
        data: {
          status: 'rejected',
          rejection_reason: 'Reverted by admin - incorrectly approved package',
          processed_at: new Date(),
        },
      });
      console.log(`      ✅ Purchase request updated`);
    }

    // Step 6: Delete purchase record
    console.log(`   6. Deleting purchase record...`);
    await tx.purchases.delete({
      where: { id: purchaseId },
    });
    console.log(`      ✅ Purchase record deleted`);

    console.log('\n   ✅ Transaction completed successfully\n');
  });

  // Step 7: Recalculate level eligibility (outside transaction)
  console.log('   7. Recalculating level eligibility for affected uplines...');
  try {
    await CommissionService.recalculateEligibility();
    console.log(`      ✅ Level eligibility recalculated`);
  } catch (error: any) {
    console.log(`      ⚠️  Error recalculating eligibility: ${error.message}`);
    console.log(`      (This is non-critical - you can run recalculateEligibility manually if needed)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ REVERT COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    await checkLocalDatabase();
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: npx tsx scripts/revert-purchase.ts [options] [flags]');
      console.error('Options:');
      console.error('  --purchase-id <id>     Direct purchase ID');
      console.error('  --request-id <id>      Purchase request ID');
      console.error('  --txn-id <id>          Transaction ID');
      console.error('  --user <display_id> --amount <amount>  User display ID + amount');
      console.error('Flags:');
      console.error('  --dry-run              Test without making changes');
      console.error('  --force                Bypass safety checks');
      process.exit(1);
    }

    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');

    const { purchase } = await findPurchaseFromInput(args);
    await revertPurchase(purchase.id, dryRun, force);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Tip: Use --dry-run to test first, or --force to bypass safety checks');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

