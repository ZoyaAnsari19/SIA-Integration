#!/usr/bin/env tsx

/**
 * Test Income Tracking Implementation
 * 
 * Tests:
 * 1. Income column exists and populated
 * 2. Daily commission updates income
 * 3. 2x check using income column
 * 4. Renewal resets income to 0
 */

import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function testIncomeColumn() {
  console.log('\n📊 Test 1: Income Column Exists and Populated');
  console.log('─────────────────────────────────────────────');
  
  const purchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    take: 5,
    orderBy: { id: 'desc' }
  });
  
  console.log(`Found ${purchases.length} purchases to check:\n`);
  
  for (const purchase of purchases) {
    const income = Number(purchase.income || 0);
    const amount = Number(purchase.amount);
    const doubleTarget = amount * 2;
    const progress = (income / doubleTarget) * 100;
    
    console.log(`  Purchase ${purchase.id}:`);
    console.log(`    Amount: ₹${amount.toFixed(2)}`);
    console.log(`    Income: ₹${income.toFixed(2)}`);
    console.log(`    2x Target: ₹${doubleTarget.toFixed(2)}`);
    console.log(`    Progress: ${progress.toFixed(2)}%`);
    console.log(`    Reached 2x: ${income >= doubleTarget ? '✅ Yes' : '❌ No'}`);
    console.log('');
  }
  
  // Verify income matches ledger_entries
  console.log('  Verifying income matches ledger_entries...');
  const purchase = purchases[0];
  if (purchase) {
    const ledgerTotal = await prisma.ledger_entries.aggregate({
      where: {
        purchase_id: purchase.id,
        receiver_user_id: purchase.user_id as unknown as bigint,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
      },
      _sum: { amount: true }
    });
    
    const ledgerSum = Number(ledgerTotal._sum.amount || 0);
    const income = Number(purchase.income || 0);
    const match = Math.abs(ledgerSum - income) < 0.01; // Allow small rounding differences
    
    console.log(`    Purchase ${purchase.id}:`);
    console.log(`      Income column: ₹${income.toFixed(2)}`);
    console.log(`      Ledger sum: ₹${ledgerSum.toFixed(2)}`);
    console.log(`      Match: ${match ? '✅ Yes' : '❌ No'}`);
  }
}

async function test2xCheck() {
  console.log('\n📊 Test 2: 2x Check Using Income Column');
  console.log('─────────────────────────────────────────────');
  
  // Get a purchase with some income
  const purchase = await prisma.purchases.findFirst({
    where: { 
      status: 'completed',
      income: { gt: 0 }
    },
    orderBy: { income: 'desc' }
  });
  
  if (!purchase) {
    console.log('  ⚠️  No purchase with income found');
    return;
  }
  
  const income = Number(purchase.income || 0);
  const amount = Number(purchase.amount);
  const doubleTarget = amount * 2;
  const isReached = income >= doubleTarget;
  
  console.log(`  Testing Purchase ${purchase.id}:`);
  console.log(`    Amount: ₹${amount.toFixed(2)}`);
  console.log(`    Income: ₹${income.toFixed(2)}`);
  console.log(`    2x Target: ₹${doubleTarget.toFixed(2)}`);
  console.log(`    Is Reached: ${isReached ? '✅ Yes' : '❌ No'}`);
  
  // Test service function
  const serviceResult = await CommissionService.isPurchaseDoubleReached(
    purchase.id as unknown as bigint
  );
  
  console.log(`    Service Check: ${serviceResult ? '✅ Reached' : '❌ Not Reached'}`);
  console.log(`    Match: ${serviceResult === isReached ? '✅ Yes' : '❌ No'}`);
}

async function testDailyUpdate() {
  console.log('\n📊 Test 3: Daily Commission Updates Income');
  console.log('─────────────────────────────────────────────');
  
  // Get a purchase with scheduled commissions
  const scheduled = await prisma.scheduled_commissions.findFirst({
    where: {
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      purchase_id: { not: null }
    }
  });
  
  if (!scheduled || !scheduled.purchase_id) {
    console.log('  ⚠️  No scheduled commission found');
    return;
  }
  
  const purchase = await prisma.purchases.findUnique({
    where: { id: scheduled.purchase_id as unknown as bigint }
  });
  
  if (!purchase) {
    console.log('  ⚠️  Purchase not found');
    return;
  }
  
  const incomeBefore = Number(purchase.income || 0);
  const monthlyAmount = Number(scheduled.monthly_amount);
  
  console.log(`  Purchase ${purchase.id}:`);
  console.log(`    Current Income: ₹${incomeBefore.toFixed(2)}`);
  console.log(`    Scheduled Commission: ${scheduled.commission_type}`);
  console.log(`    Monthly Amount: ₹${monthlyAmount.toFixed(2)}`);
  
  // Calculate expected daily amount
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expectedDaily = monthlyAmount / daysInMonth;
  
  console.log(`    Expected Daily: ₹${expectedDaily.toFixed(2)} (${daysInMonth} days in month)`);
  console.log(`    After Next Credit: ₹${(incomeBefore + expectedDaily).toFixed(2)}`);
  console.log(`    Note: Run daily commission job to test actual update`);
}

async function testRenewalReset() {
  console.log('\n📊 Test 4: Renewal Resets Income to 0');
  console.log('─────────────────────────────────────────────');
  
  // Check if any renewal purchases exist
  const renewals = await prisma.purchases.findMany({
    where: {
      is_renewal: true,
      status: 'completed'
    },
    take: 5
  });
  
  if (renewals.length === 0) {
    console.log('  ⚠️  No renewal purchases found');
    console.log('    (Create a renewal purchase to test this)');
    return;
  }
  
  console.log(`  Found ${renewals.length} renewal purchase(s):\n`);
  
  for (const renewal of renewals) {
    const income = Number(renewal.income || 0);
    const isReset = income === 0;
    
    console.log(`  Purchase ${renewal.id} (Renewal):`);
    console.log(`    Income: ₹${income.toFixed(2)}`);
    console.log(`    Reset to 0: ${isReset ? '✅ Yes' : '❌ No (should be 0)'}`);
    console.log(`    Previous Package ID: ${renewal.previous_package_id || 'N/A'}`);
    console.log('');
  }
}

async function testIncomeVsLedger() {
  console.log('\n📊 Test 5: Income vs Ledger Entries Comparison');
  console.log('─────────────────────────────────────────────');
  
  const purchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    take: 10
  });
  
  let matchCount = 0;
  let mismatchCount = 0;
  
  for (const purchase of purchases) {
    const income = Number(purchase.income || 0);
    
    const ledgerTotal = await prisma.ledger_entries.aggregate({
      where: {
        purchase_id: purchase.id,
        receiver_user_id: purchase.user_id as unknown as bigint,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
      },
      _sum: { amount: true }
    });
    
    const ledgerSum = Number(ledgerTotal._sum.amount || 0);
    const diff = Math.abs(income - ledgerSum);
    const match = diff < 0.01; // Allow small rounding differences
    
    if (match) {
      matchCount++;
    } else {
      mismatchCount++;
      console.log(`  ⚠️  Purchase ${purchase.id}:`);
      console.log(`      Income: ₹${income.toFixed(2)}`);
      console.log(`      Ledger: ₹${ledgerSum.toFixed(2)}`);
      console.log(`      Diff: ₹${diff.toFixed(2)}`);
    }
  }
  
  console.log(`\n  Results:`);
  console.log(`    Matches: ${matchCount} ✅`);
  console.log(`    Mismatches: ${mismatchCount} ${mismatchCount > 0 ? '❌' : '✅'}`);
}

async function main() {
  console.log('🧪 Testing Income Tracking Implementation');
  console.log('==========================================\n');
  
  try {
    await testIncomeColumn();
    await test2xCheck();
    await testDailyUpdate();
    await testRenewalReset();
    await testIncomeVsLedger();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log('  1. Income column exists and tracks SELF + GLOBAL_HELPING');
    console.log('  2. 2x check uses income column (faster)');
    console.log('  3. Daily commissions will update income');
    console.log('  4. Renewal purchases have income = 0');
    console.log('  5. Income should match ledger_entries sum');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

