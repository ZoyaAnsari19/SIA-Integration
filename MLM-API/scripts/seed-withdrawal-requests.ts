#!/usr/bin/env tsx

/**
 * Seed Withdrawal Requests
 * 
 * Creates withdrawal requests directly in database (not via API, to avoid date restrictions).
 * Creates requests for ~20 users with different statuses:
 * - 5 pending requests
 * - 5 approved requests (but not processed)
 * - 5 completed requests (need to update balances)
 * - 5 rejected requests
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Withdrawal Requests Seeding');
  console.log('========================================\n');
  
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
  if (!users || users.length < 20) {
    console.error('❌ Need at least 20 users. Please run seed-50-users.ts first.');
    process.exit(1);
  }
  
  console.log(`📊 Found ${users.length} users\n`);
  
  // Get user IDs as BigInt
  const userIds = users.slice(0, 20).map((u: any) => BigInt(u.id));
  
  // Create withdrawal requests with different statuses
  const withdrawalRequests = [];
  
  // 5 pending requests
  console.log('📝 Creating 5 pending withdrawal requests...');
  for (let i = 0; i < 5; i++) {
    const userId = userIds[i];
    const withdrawType = i % 2 === 0 ? 'wallet' : 'spot';
    const amount = (i + 1) * 500; // 500, 1000, 1500, 2000, 2500
    
    withdrawalRequests.push({
      user_id: userId,
      withdraw_type: withdrawType,
      amount: amount,
      payment_method: 'bank',
      account_details: JSON.stringify({
        account_number: `123456789${i}`,
        ifsc: `ABCD0${String(i).padStart(5, '0')}`,
        bank_name: 'Test Bank',
      }),
      status: 'pending',
      created_at: new Date('2025-01-15'),
    });
  }
  
  // 5 approved requests (but not processed)
  console.log('📝 Creating 5 approved withdrawal requests...');
  for (let i = 5; i < 10; i++) {
    const userId = userIds[i];
    const withdrawType = i % 2 === 0 ? 'wallet' : 'spot';
    const amount = (i - 4) * 600; // 600, 1200, 1800, 2400, 3000
    
    withdrawalRequests.push({
      user_id: userId,
      withdraw_type: withdrawType,
      amount: amount,
      payment_method: 'upi',
      account_details: JSON.stringify({
        upi_id: `user${i}@paytm`,
      }),
      status: 'approved',
      created_at: new Date('2025-01-16'),
    });
  }
  
  // 5 completed requests (need to update balances)
  console.log('📝 Creating 5 completed withdrawal requests...');
  for (let i = 10; i < 15; i++) {
    const userId = userIds[i];
    const withdrawType = i % 2 === 0 ? 'wallet' : 'spot';
    const amount = (i - 9) * 700; // 700, 1400, 2100, 2800, 3500
    
    withdrawalRequests.push({
      user_id: userId,
      withdraw_type: withdrawType,
      amount: amount,
      payment_method: 'bank',
      account_details: JSON.stringify({
        account_number: `987654321${i}`,
        ifsc: `WXYZ0${String(i).padStart(5, '0')}`,
        bank_name: 'Test Bank 2',
      }),
      status: 'approved', // Will be marked as completed after balance update
      processed_at: new Date('2025-01-17'),
      processed_by: BigInt(1), // Admin user ID
      created_at: new Date('2025-01-17'),
    });
  }
  
  // 5 rejected requests
  console.log('📝 Creating 5 rejected withdrawal requests...');
  for (let i = 15; i < 20; i++) {
    const userId = userIds[i];
    const withdrawType = i % 2 === 0 ? 'wallet' : 'spot';
    const amount = (i - 14) * 800; // 800, 1600, 2400, 3200, 4000
    
    withdrawalRequests.push({
      user_id: userId,
      withdraw_type: withdrawType,
      amount: amount,
      payment_method: 'bank',
      account_details: JSON.stringify({
        account_number: `555555555${i}`,
        ifsc: `REJECT${String(i).padStart(4, '0')}`,
        bank_name: 'Test Bank 3',
      }),
      status: 'rejected',
      rejection_reason: 'Insufficient documentation',
      created_at: new Date('2025-01-18'),
    });
  }
  
  // Insert withdrawal requests
  console.log('\n💾 Inserting withdrawal requests into database...');
  try {
    await prisma.withdraw_requests.createMany({
      data: withdrawalRequests,
    });
    console.log(`✅ Created ${withdrawalRequests.length} withdrawal requests\n`);
  } catch (error: any) {
    console.error('❌ Failed to create withdrawal requests:', error.message);
    throw error;
  }
  
  // For completed requests, update user balances (deduct from appropriate wallet)
  console.log('💰 Updating balances for completed withdrawal requests...');
  const completedRequests = withdrawalRequests.slice(10, 15); // Requests 10-14
  
  for (const request of completedRequests) {
    try {
      const userId = request.user_id;
      const amount = Number(request.amount);
      const withdrawType = request.withdraw_type;
      
      // Get current balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });
      
      if (!balance) {
        console.log(`⚠️  User ${userId} has no balance record, skipping...`);
        continue;
      }
      
      const spotBalance = Number(balance.spot_balance || 0);
      const otherBalance = Number(balance.other_balance || 0);
      
      let spotDeducted = 0;
      let otherDeducted = 0;
      
      if (withdrawType === 'spot') {
        // Deduct from spot_balance first, then other_balance if needed
        if (spotBalance >= amount) {
          spotDeducted = amount;
        } else {
          spotDeducted = spotBalance;
          otherDeducted = amount - spotBalance;
        }
      } else {
        // Deduct from other_balance first, then spot_balance if needed
        if (otherBalance >= amount) {
          otherDeducted = amount;
        } else {
          otherDeducted = otherBalance;
          spotDeducted = amount - otherBalance;
        }
      }
      
      // Update balances
      await prisma.user_balances.update({
        where: { user_id: userId },
        data: {
          balance: {
            decrement: amount,
          },
          spot_balance: {
            decrement: spotDeducted,
          },
          other_balance: {
            decrement: otherDeducted,
          },
          updated_at: new Date(),
        },
      });
      
      console.log(`✅ Updated balance for User ${userId} (deducted ${amount} from ${withdrawType})`);
    } catch (error: any) {
      console.error(`❌ Failed to update balance for User ${request.user_id}:`, error.message);
    }
  }
  
  console.log('\n✅ Withdrawal requests seeding completed!');
  console.log(`   - Created ${withdrawalRequests.length} withdrawal requests`);
  console.log(`   - Updated balances for ${completedRequests.length} completed requests`);
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

