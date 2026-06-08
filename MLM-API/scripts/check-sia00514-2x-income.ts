#!/usr/bin/env tsx
/**
 * Check SIA00514 user's 3 expired packages - when did they reach 2x income?
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00514';

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING SIA00514 - 2x Income Dates for Expired Packages');
  console.log('='.repeat(80));

  // 1. Get user
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: {
      id: true,
      display_id: true,
      name: true,
    },
  });

  if (!user) {
    console.log('\n❌ User not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ User: ${user.display_id} (${user.name})`);

  // 2. Get all purchases
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: user.id,
      status: 'completed',
    },
    orderBy: { purchased_at: 'asc' },
  });

  // Get package details
  const packageIds = [...new Set(purchases.map((p) => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: {
      id: true,
      name: true,
      price: true,
    },
  });

  const packageMap = new Map(packages.map((p) => [p.id, p]));

  console.log(`\n📦 Total Purchases: ${purchases.length}`);

  // 3. Filter expired packages (income >= 2x)
  const expiredPackages = purchases.filter((p) => {
    const pkg = packageMap.get(p.package_id);
    const amount = Number(p.amount);
    const income = Number((p as any).income || 0);
    const doubleAmount = amount * 2;
    return income >= doubleAmount;
  });

  console.log(`\n🔴 Expired Packages (2x reached): ${expiredPackages.length}`);

  // 4. For each expired package, find when 2x was reached
  console.log('\n' + '='.repeat(80));
  console.log('📊 EXPIRED PACKAGES - 2x Income Analysis');
  console.log('='.repeat(80));

  for (const purchase of expiredPackages) {
    const pkg = packageMap.get(purchase.package_id);
    const amount = Number(purchase.amount);
    const doubleAmount = amount * 2;
    const currentIncome = Number((purchase as any).income || 0);
    const purchasedAt = purchase.purchased_at;
    const isManual = (purchase as any).is_manual || false;
    const effectiveGlobalIds = (purchase as any).effective_global_ids;

    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'} (ID: ${pkg?.id || 'N/A'})`);
    console.log(`   Amount: ₹${amount.toFixed(2)}`);
    console.log(`   2x Target: ₹${doubleAmount.toFixed(2)}`);
    console.log(`   Current Income: ₹${currentIncome.toFixed(2)}`);
    console.log(`   Purchased At: ${purchasedAt}`);
    console.log(`   Is Manual: ${isManual}`);
    console.log(`   Effective Global IDs: ${effectiveGlobalIds ?? 'NULL'}`);

    // Get all SELF + GLOBAL_HELPING commissions for this purchase
    const commissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
      orderBy: { credited_at: 'asc' },
    });

    console.log(`   Total Commissions: ${commissions.length}`);

    // Calculate cumulative income to find when 2x was reached
    let cumulativeIncome = 0;
    let twoXReachedDate: Date | null = null;
    let twoXReachedEntry: any = null;

    for (const entry of commissions) {
      cumulativeIncome += Number(entry.amount);
      
      if (cumulativeIncome >= doubleAmount && !twoXReachedDate) {
        twoXReachedDate = entry.credited_at;
        twoXReachedDate.setHours(0, 0, 0, 0); // Normalize to date
        twoXReachedEntry = entry;
        break;
      }
    }

    if (twoXReachedDate) {
      const daysTo2x = Math.ceil(
        (twoXReachedDate.getTime() - purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log(`\n   ✅ 2x Income Reached:`);
      console.log(`      Date: ${twoXReachedDate.toISOString().split('T')[0]}`);
      console.log(`      Days from Purchase: ${daysTo2x} days`);
      console.log(`      Entry ID: ${twoXReachedEntry.id}`);
      console.log(`      Cumulative Income at 2x: ₹${cumulativeIncome.toFixed(2)}`);
      
      // Calculate days since expiry
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysSinceExpiry = Math.floor(
        (today.getTime() - twoXReachedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      console.log(`      Days Since Expiry: ${daysSinceExpiry} days`);
    } else {
      console.log(`\n   ⚠️  2x Income reached but date not found in commissions`);
      console.log(`      This might be due to initial income set during assignment`);
      
      // Check if initial income was set
      const initialIncome = Number((purchase as any).income || 0);
      if (initialIncome >= doubleAmount) {
        console.log(`      Initial Income (₹${initialIncome.toFixed(2)}) was already >= 2x`);
        console.log(`      Package expired immediately on purchase date`);
      }
    }

    // Get first and last commission dates
    if (commissions.length > 0) {
      const firstCommission = commissions[0];
      const lastCommission = commissions[commissions.length - 1];
      
      console.log(`\n   📅 Commission Timeline:`);
      console.log(`      First Commission: ${firstCommission.credited_at.toISOString().split('T')[0]}`);
      console.log(`      Last Commission: ${lastCommission.credited_at.toISOString().split('T')[0]}`);
      console.log(`      Total Commission Days: ${commissions.length} days`);
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ Total Purchases: ${purchases.length}`);
  console.log(`🔴 Expired Packages (2x reached): ${expiredPackages.length}`);
  console.log(`🟢 Active Packages: ${purchases.length - expiredPackages.length}`);

  // Group by package name
  const packageGroups = new Map<string, any[]>();
  for (const purchase of expiredPackages) {
    const pkg = packageMap.get(purchase.package_id);
    const packageName = pkg?.name || 'N/A';
    if (!packageGroups.has(packageName)) {
      packageGroups.set(packageName, []);
    }
    packageGroups.get(packageName)!.push(purchase);
  }

  console.log(`\n📦 Expired Packages by Type:`);
  for (const [packageName, packagePurchases] of packageGroups.entries()) {
    console.log(`   ${packageName}: ${packagePurchases.length} package(s)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ CHECK COMPLETE');
  console.log('='.repeat(80));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
