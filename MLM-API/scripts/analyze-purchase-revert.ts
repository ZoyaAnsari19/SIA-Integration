import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnalysisResult {
  purchase: any;
  purchaseRequest: any | null;
  ledgerEntries: any[];
  walletTransactions: any[];
  pendingCommissions: any[];
  affectedUsers: Map<string, {
    userId: bigint;
    displayId: string | null;
    name: string | null;
    spotAmount: number;
    otherAmount: number;
    totalAmount: number;
    ledgerCount: number;
    walletCount: number;
    pendingCount: number;
  }>;
  totalSpotAmount: number;
  totalOtherAmount: number;
  totalAmount: number;
}

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
    // Find purchase by matching user_id, amount, and txn_id
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
    // Find purchase by matching user_id, amount, and txn_id
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
      // Try to find purchase directly
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

async function analyzePurchase(purchaseId: bigint): Promise<AnalysisResult> {
  // Get purchase details
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
  });

  if (!purchase) {
    throw new Error(`Purchase ${purchaseId} not found`);
  }

  // Get user details
  const user = await prisma.users.findUnique({
    where: { id: purchase.user_id },
    select: { id: true, display_id: true, name: true },
  });

  // Get purchase request
  const purchaseRequest = await prisma.purchase_requests.findFirst({
    where: {
      user_id: purchase.user_id,
      amount: purchase.amount,
      txn_id: purchase.txn_id,
    },
    orderBy: { created_at: 'desc' },
  });

  // Get all ledger entries for this purchase
  const ledgerEntries = await prisma.ledger_entries.findMany({
    where: { purchase_id: purchaseId },
    orderBy: { credited_at: 'desc' },
  });

  // Get all wallet transactions linked via ledger_entry_id
  const ledgerEntryIds = ledgerEntries.map(le => le.id);
  const walletTransactions = ledgerEntryIds.length > 0
    ? await prisma.wallet_transactions.findMany({
        where: { ledger_entry_id: { in: ledgerEntryIds } },
        orderBy: { created_at: 'desc' },
      })
    : [];

  // Get all pending commissions
  const pendingCommissions = await prisma.pending_commissions.findMany({
    where: { purchase_id: purchaseId },
    orderBy: { created_at: 'desc' },
  });

  // Get all affected users
  const receiverIds = [
    ...new Set([
      ...ledgerEntries.map(le => le.receiver_user_id.toString()),
      ...pendingCommissions.map(pc => pc.receiver_user_id.toString()),
    ]),
  ];

  const affectedUsersData = await prisma.users.findMany({
    where: { id: { in: receiverIds.map(id => BigInt(id)) } },
    select: { id: true, display_id: true, name: true },
  });

  const userMap = new Map(affectedUsersData.map(u => [u.id.toString(), u]));

  // Calculate amounts per user
  const affectedUsers = new Map<string, {
    userId: bigint;
    displayId: string | null;
    name: string | null;
    spotAmount: number;
    otherAmount: number;
    totalAmount: number;
    ledgerCount: number;
    walletCount: number;
    pendingCount: number;
  }>();

  let totalSpotAmount = 0;
  let totalOtherAmount = 0;

  // Process ledger entries
  for (const entry of ledgerEntries) {
    const userId = entry.receiver_user_id.toString();
    const amount = Number(entry.amount);
    
    if (!affectedUsers.has(userId)) {
      const userData = userMap.get(userId);
      affectedUsers.set(userId, {
        userId: entry.receiver_user_id,
        displayId: userData?.display_id || null,
        name: userData?.name || null,
        spotAmount: 0,
        otherAmount: 0,
        totalAmount: 0,
        ledgerCount: 0,
        walletCount: 0,
        pendingCount: 0,
      });
    }

    const userData = affectedUsers.get(userId)!;
    userData.ledgerCount++;

    if (entry.commission_type === 'SPOT') {
      userData.spotAmount += amount;
      totalSpotAmount += amount;
    } else {
      userData.otherAmount += amount;
      totalOtherAmount += amount;
    }
    userData.totalAmount += amount;
  }

  // Process pending commissions
  for (const pending of pendingCommissions) {
    const userId = pending.receiver_user_id.toString();
    const amount = Number(pending.amount);
    
    if (!affectedUsers.has(userId)) {
      const userData = userMap.get(userId);
      affectedUsers.set(userId, {
        userId: pending.receiver_user_id,
        displayId: userData?.display_id || null,
        name: userData?.name || null,
        spotAmount: 0,
        otherAmount: 0,
        totalAmount: 0,
        ledgerCount: 0,
        walletCount: 0,
        pendingCount: 0,
      });
    }

    const userData = affectedUsers.get(userId)!;
    userData.pendingCount++;

    if (pending.commission_type === 'SPOT') {
      userData.spotAmount += amount;
      totalSpotAmount += amount;
    } else {
      userData.otherAmount += amount;
      totalOtherAmount += amount;
    }
    userData.totalAmount += amount;
  }

  // Count wallet transactions per user
  for (const wt of walletTransactions) {
    const ledgerEntry = ledgerEntries.find(le => le.id === wt.ledger_entry_id);
    if (ledgerEntry) {
      const userId = ledgerEntry.receiver_user_id.toString();
      if (affectedUsers.has(userId)) {
        affectedUsers.get(userId)!.walletCount++;
      }
    }
  }

  return {
    purchase,
    purchaseRequest,
    ledgerEntries,
    walletTransactions,
    pendingCommissions,
    affectedUsers,
    totalSpotAmount,
    totalOtherAmount,
    totalAmount: totalSpotAmount + totalOtherAmount,
  };
}

async function printAnalysisReport(result: AnalysisResult) {
  const { purchase, purchaseRequest, ledgerEntries, walletTransactions, pendingCommissions, affectedUsers, totalSpotAmount, totalOtherAmount, totalAmount } = result;

  // Get user and package details
  const user = await prisma.users.findUnique({
    where: { id: purchase.user_id },
    select: { id: true, display_id: true, name: true },
  });

  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id },
    select: { id: true, name: true, price: true },
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 PURCHASE REVERT ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');

  // Purchase Request Details
  if (purchaseRequest) {
    console.log('📋 PURCHASE REQUEST:');
    console.log(`   ID: ${purchaseRequest.id}`);
    console.log(`   Status: ${purchaseRequest.status}`);
    console.log(`   Request Type: ${purchaseRequest.request_type}`);
    console.log(`   Amount: ₹${purchaseRequest.amount}`);
    console.log(`   Txn ID: ${purchaseRequest.txn_id || 'N/A'}`);
    console.log(`   Created: ${purchaseRequest.created_at}`);
    console.log(`   Processed: ${purchaseRequest.processed_at || 'N/A'}`);
    if (purchaseRequest.processed_by) {
      const processor = await prisma.users.findUnique({
        where: { id: purchaseRequest.processed_by },
        select: { display_id: true, name: true },
      });
      console.log(`   Processed By: ${processor?.display_id || purchaseRequest.processed_by} (${processor?.name || 'N/A'})`);
    }
    console.log('');
  }

  // Purchase Details
  console.log('📦 PURCHASE DETAILS:');
  console.log(`   ID: ${purchase.id}`);
  console.log(`   User: ${user?.display_id || 'N/A'} (${user?.name || 'N/A'})`);
  console.log(`   Package: ${pkg?.name || 'N/A'} (ID: ${pkg?.id || 'N/A'})`);
  console.log(`   Amount: ₹${purchase.amount}`);
  console.log(`   Txn ID: ${purchase.txn_id || 'N/A'}`);
  console.log(`   Status: ${purchase.status}`);
  console.log(`   Purchased At: ${purchase.purchased_at}`);
  console.log(`   Is Renewal: ${purchase.is_renewal || false}`);
  console.log('');

  // Safety Checks
  console.log('🔍 SAFETY CHECKS:');
  const expectedAmount = 500000;
  const actualAmount = Number(purchase.amount);
  const expectedUser = 'SIA02077';
  const actualUser = user?.display_id || '';
  const expectedTxnId = '333241827453';
  const actualTxnId = purchase.txn_id || '';

  if (Math.abs(actualAmount - expectedAmount) < 0.01) {
    console.log(`   ✅ Amount matches: ₹${actualAmount}`);
  } else {
    console.log(`   ⚠️  Amount mismatch: Expected ₹${expectedAmount}, Found ₹${actualAmount}`);
  }

  if (actualUser === expectedUser) {
    console.log(`   ✅ User matches: ${actualUser}`);
  } else {
    console.log(`   ⚠️  User mismatch: Expected ${expectedUser}, Found ${actualUser}`);
  }

  if (actualTxnId === expectedTxnId) {
    console.log(`   ✅ Txn ID matches: ${actualTxnId}`);
  } else if (actualTxnId) {
    console.log(`   ⚠️  Txn ID mismatch: Expected ${expectedTxnId}, Found ${actualTxnId}`);
  } else {
    console.log(`   ⚠️  Txn ID not found`);
  }

  const hoursSincePurchase = (Date.now() - new Date(purchase.purchased_at).getTime()) / (1000 * 60 * 60);
  if (hoursSincePurchase > 24) {
    console.log(`   ⚠️  Purchase is ${hoursSincePurchase.toFixed(1)} hours old (older than 24 hours)`);
  } else {
    console.log(`   ✅ Purchase is ${hoursSincePurchase.toFixed(1)} hours old`);
  }
  console.log('');

  // Commission Breakdown
  console.log('💰 COMMISSION BREAKDOWN:');
  const commissionByType = new Map<string, { count: number; amount: number }>();
  
  for (const entry of ledgerEntries) {
    const type = entry.commission_type;
    if (!commissionByType.has(type)) {
      commissionByType.set(type, { count: 0, amount: 0 });
    }
    const data = commissionByType.get(type)!;
    data.count++;
    data.amount += Number(entry.amount);
  }

  for (const [type, data] of commissionByType.entries()) {
    console.log(`   ${type}: ${data.count} entries, ₹${data.amount.toFixed(2)}`);
  }
  console.log('');

  // Affected Users
  console.log('👥 AFFECTED USERS:');
  console.log(`   Total Users: ${affectedUsers.size}`);
  console.log('');
  
  for (const [userId, userData] of affectedUsers.entries()) {
    console.log(`   ${userData.displayId || userId} (${userData.name || 'N/A'}):`);
    console.log(`      Ledger Entries: ${userData.ledgerCount}`);
    console.log(`      Wallet Transactions: ${userData.walletCount}`);
    console.log(`      Pending Commissions: ${userData.pendingCount}`);
    if (userData.spotAmount > 0) {
      console.log(`      SPOT Amount: ₹${userData.spotAmount.toFixed(2)}`);
    }
    if (userData.otherAmount > 0) {
      console.log(`      Other Amount: ₹${userData.otherAmount.toFixed(2)}`);
    }
    console.log(`      Total Amount: ₹${userData.totalAmount.toFixed(2)}`);
    console.log('');
  }

  // Summary
  console.log('📈 SUMMARY:');
  console.log(`   Total Ledger Entries: ${ledgerEntries.length}`);
  console.log(`   Total Wallet Transactions: ${walletTransactions.length}`);
  console.log(`   Total Pending Commissions: ${pendingCommissions.length}`);
  console.log(`   Total SPOT Amount: ₹${totalSpotAmount.toFixed(2)}`);
  console.log(`   Total Other Amount: ₹${totalOtherAmount.toFixed(2)}`);
  console.log(`   Total Amount to Revert: ₹${totalAmount.toFixed(2)}`);
  console.log('');

  // Check for withdrawals
  if (affectedUsers.size > 0) {
    console.log('⚠️  WITHDRAWAL CHECK:');
    const userIds = Array.from(affectedUsers.values()).map(u => u.userId);
    const withdrawals = await prisma.withdraw_requests.findMany({
      where: {
        user_id: { in: userIds },
        status: { in: ['approved', 'processing'] },
        created_at: { gte: purchase.purchased_at },
      },
    });

    if (withdrawals.length > 0) {
      console.log(`   ⚠️  Found ${withdrawals.length} withdrawals after purchase date:`);
      for (const wd of withdrawals) {
        const user = affectedUsers.get(wd.user_id.toString());
        console.log(`      ${user?.displayId || wd.user_id}: ₹${wd.amount} (${wd.status})`);
      }
    } else {
      console.log(`   ✅ No withdrawals found after purchase date`);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Analysis Complete - Review the report above before proceeding with revert');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    await checkLocalDatabase();
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: npx tsx scripts/analyze-purchase-revert.ts [options]');
      console.error('Options:');
      console.error('  --purchase-id <id>     Direct purchase ID');
      console.error('  --request-id <id>      Purchase request ID');
      console.error('  --txn-id <id>          Transaction ID');
      console.error('  --user <display_id> --amount <amount>  User display ID + amount');
      process.exit(1);
    }

    const { purchase, purchaseRequest } = await findPurchaseFromInput(args);
    const result = await analyzePurchase(purchase.id);
    
    // Update purchase request in result
    result.purchaseRequest = purchaseRequest || result.purchaseRequest;
    
    await printAnalysisReport(result);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

