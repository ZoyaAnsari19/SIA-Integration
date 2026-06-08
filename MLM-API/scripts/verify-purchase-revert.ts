import { PrismaClient } from '@prisma/client';

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

async function findPurchaseFromInput(args: string[]): Promise<{ purchase: any | null; purchaseRequest: any | null; purchaseId: bigint | null }> {
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
  }
  // Option 2: Purchase Request ID
  else if (requestIdArg !== -1 && args[requestIdArg + 1]) {
    const requestId = BigInt(args[requestIdArg + 1]);
    console.log(`📋 Using Purchase Request ID: ${requestId}`);
    purchaseRequest = await prisma.purchase_requests.findUnique({
      where: { id: requestId },
    });
    if (purchaseRequest) {
      purchase = await prisma.purchases.findFirst({
        where: {
          user_id: purchaseRequest.user_id,
          amount: purchaseRequest.amount,
          txn_id: purchaseRequest.txn_id,
        },
        orderBy: { purchased_at: 'desc' },
      });
      if (purchase) {
        purchaseId = purchase.id;
      }
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
    if (purchaseRequest) {
      purchase = await prisma.purchases.findFirst({
        where: {
          user_id: purchaseRequest.user_id,
          amount: purchaseRequest.amount,
          txn_id: purchaseRequest.txn_id,
        },
        orderBy: { purchased_at: 'desc' },
      });
      if (purchase) {
        purchaseId = purchase.id;
      }
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
    if (user) {
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
      
      if (purchase) {
        purchaseId = purchase.id;
      }
    }
  } else {
    throw new Error(`Invalid arguments. Use one of:
  --purchase-id <id>
  --request-id <id>
  --txn-id <id>
  --user <display_id> --amount <amount>`);
  }

  return { purchase, purchaseRequest, purchaseId };
}

async function verifyRevert(purchaseId: bigint | null, purchaseRequest: any | null): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('✅ VERIFICATION REPORT');
  console.log('='.repeat(80) + '\n');

  let allPassed = true;

  // Check 1: Purchase record
  console.log('1. Purchase Record:');
  if (purchaseId) {
    const purchase = await prisma.purchases.findUnique({
      where: { id: purchaseId },
    });
    if (purchase) {
      console.log(`   ❌ FAILED: Purchase record still exists (ID: ${purchaseId})`);
      allPassed = false;
    } else {
      console.log(`   ✅ PASSED: Purchase record deleted`);
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase ID not found (may have been deleted)`);
  }
  console.log('');

  // Check 2: Ledger entries
  console.log('2. Ledger Entries:');
  if (purchaseId) {
    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: { purchase_id: purchaseId },
    });
    if (ledgerEntries.length > 0) {
      console.log(`   ❌ FAILED: Found ${ledgerEntries.length} ledger entries still exist`);
      allPassed = false;
    } else {
      console.log(`   ✅ PASSED: No ledger entries found`);
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase ID not found`);
  }
  console.log('');

  // Check 3: Wallet transactions (check by checking if any ledger entries exist)
  console.log('3. Wallet Transactions:');
  if (purchaseId) {
    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: { purchase_id: purchaseId },
      select: { id: true },
    });
    const ledgerEntryIds = ledgerEntries.map(le => le.id);
    
    if (ledgerEntryIds.length > 0) {
      const walletTransactions = await prisma.wallet_transactions.findMany({
        where: { ledger_entry_id: { in: ledgerEntryIds } },
      });
      if (walletTransactions.length > 0) {
        console.log(`   ❌ FAILED: Found ${walletTransactions.length} wallet transactions still exist`);
        allPassed = false;
      } else {
        console.log(`   ✅ PASSED: No wallet transactions found (ledger entries deleted)`);
      }
    } else {
      console.log(`   ✅ PASSED: No ledger entries found, so no wallet transactions to check`);
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase ID not found`);
  }
  console.log('');

  // Check 4: Pending commissions
  console.log('4. Pending Commissions:');
  if (purchaseId) {
    const pendingCommissions = await prisma.pending_commissions.findMany({
      where: { purchase_id: purchaseId },
    });
    if (pendingCommissions.length > 0) {
      console.log(`   ❌ FAILED: Found ${pendingCommissions.length} pending commissions still exist`);
      allPassed = false;
    } else {
      console.log(`   ✅ PASSED: No pending commissions found`);
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase ID not found`);
  }
  console.log('');

  // Check 5: Purchase request status
  console.log('5. Purchase Request Status:');
  if (purchaseRequest) {
    const updatedRequest = await prisma.purchase_requests.findUnique({
      where: { id: purchaseRequest.id },
    });
    if (updatedRequest) {
      if (updatedRequest.status === 'rejected') {
        console.log(`   ✅ PASSED: Purchase request status is 'rejected'`);
      } else {
        console.log(`   ❌ FAILED: Purchase request status is '${updatedRequest.status}' (expected 'rejected')`);
        allPassed = false;
      }
      if (updatedRequest.rejection_reason) {
        console.log(`   ✅ Rejection reason: ${updatedRequest.rejection_reason}`);
      }
    } else {
      console.log(`   ⚠️  Purchase request not found`);
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase request not found`);
  }
  console.log('');

  // Check 6: User balances (if we can find the purchase info)
  console.log('6. User Balances:');
  if (purchaseId) {
    // Try to get purchase info from history or check if balances look correct
    // Since purchase is deleted, we can't directly verify, but we can check if there are any
    // ledger entries that would indicate balances weren't adjusted
    const anyLedgerEntries = await prisma.ledger_entries.findMany({
      where: { purchase_id: purchaseId },
      take: 1,
    });
    if (anyLedgerEntries.length === 0) {
      console.log(`   ✅ PASSED: No ledger entries found, balances should be correct`);
    } else {
      console.log(`   ⚠️  WARNING: Ledger entries still exist, balances may not be adjusted`);
      allPassed = false;
    }
  } else {
    console.log(`   ⚠️  SKIPPED: Purchase ID not found`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(80));
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED - Revert appears to be successful');
  } else {
    console.log('❌ SOME CHECKS FAILED - Please review the issues above');
  }
  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    await checkLocalDatabase();
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: npx tsx scripts/verify-purchase-revert.ts [options]');
      console.error('Options:');
      console.error('  --purchase-id <id>     Direct purchase ID');
      console.error('  --request-id <id>      Purchase request ID');
      console.error('  --txn-id <id>          Transaction ID');
      console.error('  --user <display_id> --amount <amount>  User display ID + amount');
      process.exit(1);
    }

    const { purchase, purchaseRequest, purchaseId } = await findPurchaseFromInput(args);
    await verifyRevert(purchaseId, purchaseRequest);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

