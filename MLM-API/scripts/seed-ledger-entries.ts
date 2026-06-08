#!/usr/bin/env tsx

/**
 * Seed Ledger Entries
 * 
 * Seeds ledger entries directly in database (NOT SPOT, TRANSFER, or WITHDRAW - those come from API).
 * Creates entries for:
 * - SELF commissions (10-15 entries)
 * - GLOBAL_HELPING commissions (10-15 entries)
 * - MONTHLY commissions (10-15 entries)
 * - FEE_DEDUCTION entries (5-10 entries)
 * 
 * Then updates user_balances table to reflect the ledger entries.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Ledger Entries Seeding');
  console.log('===================================\n');
  
  // Load user data from seed-50-users script
  let userData: any;
  try {
    const data = await fs.readFile('./scripts/seed-50-users-data.json', 'utf-8');
    userData = JSON.parse(data);
  } catch (error) {
    console.error('❌ Failed to load user data. Please run seed-50-users.ts first.');
    process.exit(1);
  }
  
  const users = userData.users;
  if (!users || users.length === 0) {
    console.error('❌ No users found. Please run seed-50-users.ts first.');
    process.exit(1);
  }
  
  console.log(`📊 Found ${users.length} users\n`);
  
  // Get purchases for users (to reference in metadata)
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: { in: users.map((u: any) => BigInt(u.id)) },
      status: 'completed',
    },
    select: {
      id: true,
      user_id: true,
      package_id: true,
    },
    take: 50,
  });
  
  const purchaseMap = new Map<string, any>();
  purchases.forEach((p) => {
    const userId = p.user_id.toString();
    if (!purchaseMap.has(userId)) {
      purchaseMap.set(userId, p);
    }
  });
  
  console.log(`📦 Found ${purchases.length} purchases to reference\n`);
  
  // Create ledger entries
  const ledgerEntries = [];
  
  // SELF commissions (10-15 entries)
  console.log('📝 Creating SELF commission entries...');
  const selfUsers = users.slice(0, 15);
  for (let i = 0; i < selfUsers.length; i++) {
    const user = selfUsers[i];
    const userId = BigInt(user.id);
    const purchase = purchaseMap.get(user.id);
    
    // SELF commission: typically 62.50 per month (varies by package)
    const amount = 50 + (i * 5); // 50, 55, 60, 65, etc.
    const date = new Date('2025-01-10');
    date.setDate(date.getDate() + i); // Spread across days
    
    ledgerEntries.push({
      receiver_user_id: userId,
      source_user_id: userId, // SELF commission - source is same as receiver
      purchase_id: purchase?.id ? BigInt(purchase.id) : null,
      commission_type: 'SELF',
      amount: amount,
      metadata: {
        wallet_type: 'other_balance',
        purchase_id: purchase?.id?.toString() || null,
        description: 'Monthly SELF commission',
      },
      credited_at: date,
      settled: false,
    });
  }
  
  // GLOBAL_HELPING commissions (10-15 entries)
  console.log('📝 Creating GLOBAL_HELPING commission entries...');
  const globalUsers = users.slice(5, 20);
  for (let i = 0; i < globalUsers.length; i++) {
    const user = globalUsers[i];
    const userId = BigInt(user.id);
    const purchase = purchaseMap.get(user.id);
    
    // GLOBAL_HELPING commission: typically smaller amounts
    const amount = 5 + (i * 2); // 5, 7, 9, 11, etc.
    const date = new Date('2025-01-11');
    date.setDate(date.getDate() + i);
    
    ledgerEntries.push({
      receiver_user_id: userId,
      source_user_id: userId, // GLOBAL_HELPING - can be self or system, using self for simplicity
      purchase_id: purchase?.id ? BigInt(purchase.id) : null,
      commission_type: 'GLOBAL_HELPING',
      amount: amount,
      metadata: {
        wallet_type: 'other_balance',
        purchase_id: purchase?.id?.toString() || null,
        description: 'Global helping pool commission',
      },
      credited_at: date,
      settled: false,
    });
  }
  
  // MONTHLY commissions (10-15 entries)
  console.log('📝 Creating MONTHLY commission entries...');
  const monthlyUsers = users.slice(10, 25);
  for (let i = 0; i < monthlyUsers.length; i++) {
    const user = monthlyUsers[i];
    const userId = BigInt(user.id);
    const purchase = purchaseMap.get(user.id);
    
    // MONTHLY commission: recurring royalty
    const amount = 20 + (i * 3); // 20, 23, 26, 29, etc.
    const date = new Date('2025-01-12');
    date.setDate(date.getDate() + i);
    
    ledgerEntries.push({
      receiver_user_id: userId,
      source_user_id: userId, // MONTHLY - source is same as receiver for simplicity
      purchase_id: purchase?.id ? BigInt(purchase.id) : null,
      commission_type: 'MONTHLY',
      amount: amount,
      metadata: {
        wallet_type: 'other_balance',
        purchase_id: purchase?.id?.toString() || null,
        description: 'Monthly recurring royalty',
      },
      credited_at: date,
      settled: false,
    });
  }
  
  // FEE_DEDUCTION entries (5-10 entries)
  console.log('📝 Creating FEE_DEDUCTION entries...');
  const feeUsers = users.slice(0, 10);
  for (let i = 0; i < feeUsers.length; i++) {
    const user = feeUsers[i];
    const userId = BigInt(user.id);
    
    // FEE_DEDUCTION: negative amount
    const amount = -(10 + (i * 2)); // -10, -12, -14, -16, etc.
    const date = new Date('2025-01-13');
    date.setDate(date.getDate() + i);
    
    ledgerEntries.push({
      receiver_user_id: userId,
      source_user_id: userId, // FEE_DEDUCTION - self-initiated
      purchase_id: null,
      commission_type: 'FEE_DEDUCTION',
      amount: amount,
      metadata: {
        wallet_type: 'other_balance',
        fee_type: i % 2 === 0 ? 'kyc' : 'withdrawal',
        description: i % 2 === 0 ? 'KYC verification fee' : 'Withdrawal processing fee',
      },
      credited_at: date,
      settled: false,
    });
  }
  
  // Insert ledger entries
  console.log('\n💾 Inserting ledger entries into database...');
  try {
    await prisma.ledger_entries.createMany({
      data: ledgerEntries,
    });
    console.log(`✅ Created ${ledgerEntries.length} ledger entries\n`);
  } catch (error: any) {
    console.error('❌ Failed to create ledger entries:', error.message);
    throw error;
  }
  
  // Update user balances based on ledger entries
  console.log('💰 Updating user balances based on ledger entries...');
  
  // Get all users who have ledger entries
  const usersWithEntries = await prisma.ledger_entries.findMany({
    select: { receiver_user_id: true },
    distinct: ['receiver_user_id'],
  });
  
  console.log(`📊 Updating balances for ${usersWithEntries.length} users...\n`);
  
  for (const entry of usersWithEntries) {
    const userId = entry.receiver_user_id;
    
    try {
      // Calculate spot_balance (should be 0 for seeded data, but check anyway)
      const spotSum = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: 'SPOT',
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      });
      
      // Calculate other_balance (SELF + GLOBAL_HELPING + MONTHLY + FEE_DEDUCTION)
      const otherSum = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING', 'MONTHLY', 'FEE_DEDUCTION'] },
        },
        _sum: { amount: true },
      });
      
      const spotBalance = Number(spotSum._sum.amount || 0);
      const otherBalance = Number(otherSum._sum.amount || 0);
      const totalBalance = spotBalance + otherBalance;
      
      // Update or create user_balances record
      await prisma.user_balances.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          balance: totalBalance,
          spot_balance: spotBalance,
          other_balance: otherBalance,
        },
        update: {
          balance: totalBalance,
          spot_balance: spotBalance,
          other_balance: otherBalance,
          updated_at: new Date(),
        },
      });
      
      if (totalBalance !== 0) {
        console.log(`✅ Updated balance for User ${userId}: Total=${totalBalance.toFixed(2)}, Spot=${spotBalance.toFixed(2)}, Other=${otherBalance.toFixed(2)}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to update balance for User ${userId}:`, error.message);
    }
  }
  
  console.log('\n✅ Ledger entries seeding completed!');
  console.log(`   - Created ${ledgerEntries.length} ledger entries`);
  console.log(`   - Updated balances for ${usersWithEntries.length} users`);
  
  // Summary by commission type
  const summary = await prisma.ledger_entries.groupBy({
    by: ['commission_type'],
    _count: { id: true },
    _sum: { amount: true },
  });
  
  console.log('\n📊 Summary by Commission Type:');
  summary.forEach((item) => {
    console.log(`   ${item.commission_type}: ${item._count.id} entries, Total: ${Number(item._sum.amount || 0).toFixed(2)}`);
  });
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

