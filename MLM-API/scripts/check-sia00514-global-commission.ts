#!/usr/bin/env tsx
/**
 * Check SIA00514 - Global Commission Issue
 * Admin ne package assign kiya with global IDs but global commission nahi aaya
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00514';

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING USER SIA00514 - Global Commission Issue');
  console.log('='.repeat(80));

  // 1. Get user details
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: {
      id: true,
      display_id: true,
      name: true,
      email: true,
      created_at: true,
    },
  });

  if (!user) {
    console.log('\n❌ User not found!');
    await prisma.$disconnect();
    return;
  }

  console.log('\n✅ User Found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Display ID: ${user.display_id}`);
  console.log(`   Name: ${user.name || 'N/A'}`);
  console.log(`   Email: ${user.email || 'N/A'}`);

  // 2. Get all purchases (especially recent manual assignments)
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: user.id,
      status: 'completed',
    },
    orderBy: { purchased_at: 'desc' },
    take: 10,
  });

  if (purchases.length === 0) {
    console.log('\n❌ No purchases found!');
    await prisma.$disconnect();
    return;
  }

  // Get package details for all purchases
  const packageIds = [...new Set(purchases.map((p) => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: {
      id: true,
      name: true,
      global_ids: true,
    },
  });

  const packageMap = new Map(packages.map((p) => [p.id, p]));

  console.log(`\n📦 Found ${purchases.length} recent purchase(s):`);
  console.log('-'.repeat(80));

  // Filter manual assignments
  const manualPurchases = purchases.filter(
    (p) => (p as any).is_manual === true || (p as any).payment_type === 'admin_assignment'
  );

  for (const purchase of purchases) {
    const pkg = packageMap.get(purchase.package_id);
    const effectiveGlobalIds = (purchase as any).effective_global_ids;
    const isManual = (purchase as any).is_manual || false;
    const paymentType = (purchase as any).payment_type || 'N/A';
    const txnId = (purchase as any).txn_id || 'N/A';
    const income = Number((purchase as any).income || 0);
    const isActive = income < Number(purchase.amount) * 2;

    console.log(`\nPurchase ID: ${purchase.id}`);
    console.log(`  Package: ${pkg?.name || 'N/A'} (ID: ${pkg?.id || 'N/A'})`);
    console.log(`  Amount: ₹${purchase.amount}`);
    console.log(`  Package Global IDs: ${pkg?.global_ids || 0}`);
    console.log(`  Effective Global IDs: ${effectiveGlobalIds ?? 'NULL'}`);
    console.log(`  Is Manual: ${isManual}`);
    console.log(`  Purchased At: ${purchase.purchased_at}`);
    console.log(`  Income: ₹${income.toFixed(2)}`);
    console.log(`  Payment Type: ${paymentType}`);
    console.log(`  Txn ID: ${txnId}`);
    console.log(`  Is Active: ${isActive}`);
  }

  // 3. Check commissions for each purchase
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING GLOBAL COMMISSIONS');
  console.log('='.repeat(80));

  for (const purchase of manualPurchases.length > 0 ? manualPurchases : purchases) {
    const pkg = packageMap.get(purchase.package_id);
    const packageGlobalIds = Number(pkg?.global_ids || 0);
    const effectiveGlobalIds = (purchase as any).effective_global_ids;

    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'}`);
    console.log(`   Effective Global IDs: ${effectiveGlobalIds ?? 'NULL'}`);
    console.log(`   Package Global IDs Cap: ${packageGlobalIds}`);

    // Check if package has global_ids
    if (packageGlobalIds === 0) {
      console.log(`   ⚠️  Package has NO global_ids (global_ids = 0)`);
      console.log(`   ❌ GLOBAL_HELPING commission will NOT be credited`);
      continue;
    }

    // Check effective_global_ids
    if (effectiveGlobalIds === null || effectiveGlobalIds === undefined || effectiveGlobalIds === 0) {
      console.log(`   ⚠️  effective_global_ids is NULL or 0`);
      console.log(`   ℹ️  System will count users from purchase date dynamically`);
    }

    // Check GLOBAL_HELPING commission entries
    const globalCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: 'GLOBAL_HELPING',
      },
      orderBy: { credited_at: 'desc' },
      take: 10,
    });

    if (globalCommissions.length > 0) {
      console.log(`\n   ✅ Found ${globalCommissions.length} GLOBAL_HELPING commission(s):`);
      let totalGlobal = 0;
      for (const entry of globalCommissions) {
        const amount = Number(entry.amount);
        totalGlobal += amount;
        const metadata = entry.metadata as any;
        console.log(`      Entry ${entry.id}: ₹${amount.toFixed(2)} at ${entry.credited_at}`);
        console.log(`         IDK: ${entry.idempotency_key || 'N/A'}`);
        if (metadata?.used_ids) {
          console.log(`         Used IDs: ${metadata.used_ids}, Cap: ${metadata.package_cap || 'N/A'}`);
        }
      }
      console.log(`   📊 Total GLOBAL_HELPING: ₹${totalGlobal.toFixed(2)}`);
    } else {
      console.log(`\n   ❌ NO GLOBAL_HELPING commissions found!`);
      console.log(`   ⚠️  This is the issue - global commission nahi aaya`);
    }

    // Check SPOT commissions (user mentioned "2 logo ka aya")
    const spotCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: 'SPOT',
      },
      orderBy: { credited_at: 'desc' },
      take: 10,
    });

    if (spotCommissions.length > 0) {
      console.log(`\n   ✅ Found ${spotCommissions.length} SPOT commission(s):`);
      let totalSpot = 0;
      for (const entry of spotCommissions) {
        const amount = Number(entry.amount);
        totalSpot += amount;
        console.log(
          `      Entry ${entry.id}: ₹${amount.toFixed(2)} to receiver ${entry.receiver_user_id} at ${entry.credited_at}`
        );
      }
      console.log(`   📊 Total SPOT: ₹${totalSpot.toFixed(2)}`);
      console.log(`   ℹ️  User ne kaha: 'bas 2 logo ka aya' - ye SPOT commissions hain`);
    }

    // Check SELF commissions
    const selfCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: 'SELF',
      },
      orderBy: { credited_at: 'desc' },
      take: 5,
    });

    if (selfCommissions.length > 0) {
      console.log(`\n   ✅ Found ${selfCommissions.length} SELF commission(s):`);
      for (const entry of selfCommissions) {
        const amount = Number(entry.amount);
        console.log(`      Entry ${entry.id}: ₹${amount.toFixed(2)} at ${entry.credited_at}`);
      }
    }
  }

  // 4. Check if daily commission job ran after package assignment
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING DAILY COMMISSION JOB STATUS');
  console.log('='.repeat(80));

  if (manualPurchases.length > 0 || purchases.length > 0) {
    const latestPurchase = manualPurchases.length > 0 ? manualPurchases[0] : purchases[0];
    const purchaseDate = latestPurchase.purchased_at;
    console.log(`\n📅 Latest Purchase Date: ${purchaseDate}`);
    console.log(`   ℹ️  Daily commission job runs at 12:05 AM IST`);
    console.log(`   ⚠️  If package was assigned today, commissions will start TOMORROW at 12:05 AM`);
    console.log(`   ⚠️  If package was assigned yesterday, check if daily job ran today`);

    // Check if there are any GLOBAL_HELPING entries for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayGlobalCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: latestPurchase.id,
        commission_type: 'GLOBAL_HELPING',
        credited_at: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todayGlobalCommissions.length > 0) {
      console.log(`   ✅ Found ${todayGlobalCommissions.length} GLOBAL_HELPING commission(s) for today`);
    } else {
      console.log(`   ❌ NO GLOBAL_HELPING commissions found for today`);
      console.log(`   ⚠️  Daily commission job may not have run yet`);
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  console.log('\n✅ VALID ISSUE CHECK:');
  console.log('   1. Package assigned with global IDs?');
  for (const purchase of manualPurchases.length > 0 ? manualPurchases : purchases) {
    const pkg = packageMap.get(purchase.package_id);
    const packageGlobalIds = Number(pkg?.global_ids || 0);
    if (packageGlobalIds > 0) {
      console.log(`      ✅ YES - Package has ${packageGlobalIds} global IDs`);
    } else {
      console.log(`      ❌ NO - Package has no global IDs`);
    }
  }

  console.log('\n   2. effective_global_ids set?');
  for (const purchase of manualPurchases.length > 0 ? manualPurchases : purchases) {
    const effectiveGlobalIds = (purchase as any).effective_global_ids;
    if (effectiveGlobalIds !== null && effectiveGlobalIds !== undefined && effectiveGlobalIds > 0) {
      console.log(`      ✅ YES - effective_global_ids = ${effectiveGlobalIds}`);
    } else {
      console.log(`      ⚠️  NO - effective_global_ids is NULL (will count dynamically)`);
    }
  }

  console.log('\n   3. GLOBAL_HELPING commissions credited?');
  for (const purchase of manualPurchases.length > 0 ? manualPurchases : purchases) {
    const globalCount = await prisma.ledger_entries.count({
      where: {
        purchase_id: purchase.id,
        commission_type: 'GLOBAL_HELPING',
      },
    });

    if (globalCount > 0) {
      console.log(`      ✅ YES - ${globalCount} GLOBAL_HELPING entries found for purchase ${purchase.id}`);
    } else {
      console.log(`      ❌ NO - No GLOBAL_HELPING entries found for purchase ${purchase.id}`);
      console.log(`      ⚠️  THIS IS THE ISSUE!`);
    }
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
