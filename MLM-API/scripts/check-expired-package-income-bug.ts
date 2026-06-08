import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  console.log('============================================================');
  console.log('🔍 Checking Production DB: Expired Packages Receiving Income');
  console.log('============================================================\n');

  // Step 1: Find all purchases that have reached 2x (expired)
  console.log('📊 Step 1: Finding all expired purchases (income >= 2x)...\n');
  
  const allPurchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
    },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      income: true,
      purchased_at: true,
    } as any,
  });

  const expiredPurchases: Array<{
    purchaseId: bigint;
    userId: bigint;
    packageId: number;
    amount: number;
    income: number;
    doubleAmount: number;
    purchasedAt: Date;
  }> = [];

  for (const purchase of allPurchases) {
    const amount = Number(purchase.amount);
    const income = Number((purchase as any).income || 0);
    const doubleAmount = amount * 2;
    
    if (income >= doubleAmount) {
      expiredPurchases.push({
        purchaseId: purchase.id as unknown as bigint,
        userId: purchase.user_id as unknown as bigint,
        packageId: purchase.package_id,
        amount,
        income,
        doubleAmount,
        purchasedAt: purchase.purchased_at,
      });
    }
  }

  console.log(`✅ Found ${expiredPurchases.length} expired purchases (reached 2x)\n`);

  // Step 2: For each expired purchase, find income entries AFTER it reached 2x
  console.log('📊 Step 2: Checking for income entries AFTER expiry...\n');

  const affectedUsers = new Map<bigint, {
    displayId: string;
    name: string;
    purchases: Array<{
      purchaseId: bigint;
      packageName: string;
      amount: number;
      income: number;
      expiryDate: Date | null;
      invalidIncome: number;
      invalidEntries: number;
    }>;
  }>();

  let totalAffectedPurchases = 0;
  let totalInvalidIncome = 0;

  for (const expired of expiredPurchases) {
    // Find when this purchase reached 2x (first date when income >= 2x)
    // We'll approximate by finding the date when cumulative SELF+GLOBAL reached 2x
    const selfGlobalEntries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: expired.purchaseId,
        receiver_user_id: expired.userId,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
      orderBy: { credited_at: 'asc' },
      select: {
        id: true,
        amount: true,
        credited_at: true,
      },
    });

    // Calculate cumulative income to find expiry date
    let cumulative = 0;
    let expiryDate: Date | null = null;
    for (const entry of selfGlobalEntries) {
      cumulative += Number(entry.amount);
      if (cumulative >= expired.doubleAmount && !expiryDate) {
        expiryDate = entry.credited_at;
        break;
      }
    }

    // If we couldn't find exact expiry date, use a conservative estimate
    // (purchase date + some days based on income rate)
    if (!expiryDate) {
      // Approximate: if income is way over 2x, it expired long ago
      // Use purchase date as conservative estimate
      expiryDate = expired.purchasedAt;
    }

    // Find ALL income entries (SELF, GLOBAL_HELPING, MONTHLY) AFTER expiry date
    const invalidEntries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: expired.purchaseId,
        credited_at: {
          gte: expiryDate,
        },
        commission_type: { in: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
      },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
        receiver_user_id: true,
      },
    });

    if (invalidEntries.length > 0) {
      const invalidIncome = invalidEntries.reduce((sum, e) => sum + Number(e.amount), 0);
      
      // Get user info
      const user = await prisma.users.findUnique({
        where: { id: expired.userId },
        select: { display_id: true, name: true },
      });

      // Get package name
      const pkg = await prisma.packages.findUnique({
        where: { id: expired.packageId },
        select: { name: true },
      });

      if (user) {
        if (!affectedUsers.has(expired.userId)) {
          affectedUsers.set(expired.userId, {
            displayId: user.display_id || 'N/A',
            name: user.name || 'N/A',
            purchases: [],
          });
        }

        const userData = affectedUsers.get(expired.userId)!;
        userData.purchases.push({
          purchaseId: expired.purchaseId,
          packageName: pkg?.name || 'N/A',
          amount: expired.amount,
          income: expired.income,
          expiryDate,
          invalidIncome,
          invalidEntries: invalidEntries.length,
        });

        totalAffectedPurchases++;
        totalInvalidIncome += invalidIncome;
      }
    }
  }

  // Step 3: Generate summary
  console.log('============================================================');
  console.log('📋 SUMMARY: Affected Users & Invalid Income');
  console.log('============================================================\n');

  console.log(`📊 Total Statistics:`);
  console.log(`   - Total Expired Purchases: ${expiredPurchases.length}`);
  console.log(`   - Affected Users: ${affectedUsers.size}`);
  console.log(`   - Affected Purchases: ${totalAffectedPurchases}`);
  console.log(`   - Total Invalid Income: ₹${totalInvalidIncome.toFixed(2)}\n`);

  console.log('============================================================');
  console.log('👥 AFFECTED USERS LIST:\n');

  // Sort by invalid income (descending)
  const sortedUsers = Array.from(affectedUsers.values()).sort((a, b) => {
    const aTotal = a.purchases.reduce((sum, p) => sum + p.invalidIncome, 0);
    const bTotal = b.purchases.reduce((sum, p) => sum + p.invalidIncome, 0);
    return bTotal - aTotal;
  });

  for (const user of sortedUsers) {
    const userTotal = user.purchases.reduce((sum, p) => sum + p.invalidIncome, 0);
    console.log(`\n${user.displayId} - ${user.name}`);
    console.log(`   Total Invalid Income: ₹${userTotal.toFixed(2)}`);
    console.log(`   Affected Packages: ${user.purchases.length}`);
    
    for (const p of user.purchases) {
      console.log(`   - Purchase ${p.purchaseId}: ${p.packageName}`);
      console.log(`     Amount: ₹${p.amount.toFixed(2)}, Income: ₹${p.income.toFixed(2)}`);
      console.log(`     Expired: ${p.expiryDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`     Invalid Income: ₹${p.invalidIncome.toFixed(2)} (${p.invalidEntries} entries)`);
    }
  }

  console.log('\n============================================================');
  console.log('✅ Analysis Complete\n');
}

main()
  .catch(err => {
    console.error('Error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
