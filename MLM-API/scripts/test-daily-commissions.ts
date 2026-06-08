#!/usr/bin/env tsx

/**
 * Test Daily Commissions Fix
 * 
 * 1. Add 2 direct users under user14 (ID: 50)
 * 2. Add 2 level-1 users (under those direct users)
 * 3. Create and approve purchase requests for all 4 users
 * 4. Wait 2 minutes
 * 5. Check scheduled_commissions and ledger_entries
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:3002';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bilal@sia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nashik2nagpur';
const USER14_ID = '50';

const prisma = new PrismaClient();

interface User {
  id: string;
  email: string;
  name: string;
  token?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function adminLogin(): Promise<string> {
  console.log('🔐 Logging in as admin...');
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    
    if (!response.data.token) {
      throw new Error('Admin login failed: No token received');
    }
    
    console.log('✅ Admin logged in successfully');
    return response.data.token;
  } catch (error: any) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function registerUser(
  name: string,
  email: string,
  mobile: string,
  password: string,
  referrerUserId: string
): Promise<User> {
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/register`, {
      name,
      email,
      mobile,
      password,
      referrer_user_id: referrerUserId,
    });
    
    const user = response.data.user || response.data;
    console.log(`✅ User registered: ${user.email} (ID: ${user.id})`);
    return user;
  } catch (error: any) {
    console.error(`❌ Registration failed for ${email}:`, error.response?.data || error.message);
    throw error;
  }
}

async function createPurchaseRequest(userId: string, packageId: number, token: string): Promise<string> {
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/purchases`,
      {
        package_id: packageId,
        request_type: 'activation',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    const requestId = response.data.request?.id || response.data.id;
    console.log(`✅ Purchase request created for user ${userId}: Request ID ${requestId}`);
    return requestId;
  } catch (error: any) {
    console.error(`❌ Purchase request failed for user ${userId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function approvePurchaseRequest(requestId: string, adminToken: string): Promise<void> {
  try {
    await axios.post(
      `${API_URL}/api/v1/admin/activation/requests/${requestId}/approve`,
      {},
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );
    console.log(`✅ Purchase request ${requestId} approved`);
  } catch (error: any) {
    console.error(`❌ Approval failed for request ${requestId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function checkScheduledCommissions() {
  const count = await prisma.scheduled_commissions.count({
    where: {
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
    }
  });
  console.log(`\n📊 Scheduled Commissions (SELF + GLOBAL_HELPING): ${count}`);
  
  const entries = await prisma.scheduled_commissions.findMany({
    where: {
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
    },
    take: 5,
    orderBy: { id: 'desc' }
  });
  
  console.log('\nLatest scheduled commissions:');
  entries.forEach(entry => {
    console.log(`  - ${entry.commission_type}: Purchase ${entry.purchase_id}, Monthly: ₹${entry.monthly_amount}, User: ${entry.receiver_user_id}`);
  });
}

async function checkLedgerEntries() {
  const count = await prisma.ledger_entries.count({
    where: {
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
    }
  });
  console.log(`\n💰 Ledger Entries (SELF + GLOBAL_HELPING): ${count}`);
  
  const entries = await prisma.ledger_entries.findMany({
    where: {
      commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
    },
    take: 5,
    orderBy: { id: 'desc' }
  });
  
  console.log('\nLatest ledger entries:');
  entries.forEach(entry => {
    console.log(`  - ${entry.commission_type}: ₹${entry.amount}, Purchase ${entry.purchase_id}, User: ${entry.receiver_user_id}`);
  });
}

async function main() {
  console.log('🧪 Testing Daily Commissions Fix');
  console.log('================================\n');
  
  try {
    // Step 1: Admin login
    const adminToken = await adminLogin();
    await sleep(1000);
    
    // Step 2: Register 2 direct users under user14 (ID: 50)
    console.log('\n📝 Step 1: Registering 2 direct users under user14...');
    const timestamp = Date.now();
    
    const directUser1 = await registerUser(
      'Direct User 1',
      `direct1-${timestamp}@test.com`,
      `98765${timestamp.toString().slice(-5)}`,
      'Test@123',
      USER14_ID
    );
    await sleep(500);
    
    const directUser2 = await registerUser(
      'Direct User 2',
      `direct2-${timestamp}@test.com`,
      `98766${timestamp.toString().slice(-5)}`,
      'Test@123',
      USER14_ID
    );
    await sleep(500);
    
    // Step 3: Login direct users and create purchase requests
    console.log('\n📦 Step 2: Creating purchase requests for direct users...');
    
    const directUsers = [directUser1, directUser2];
    const directPurchaseRequests: { userId: string; requestId: string }[] = [];
    
    for (const user of directUsers) {
      // Login user
      const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
        userId: user.email,
        password: 'Test@123',
      });
      user.token = loginResponse.data.token;
      await sleep(500);
      
      // Create purchase request (Package 1 - ₹2,500)
      const requestId = await createPurchaseRequest(user.id, 1, user.token!);
      directPurchaseRequests.push({ userId: user.id, requestId });
      await sleep(500);
    }
    
    // Step 4: Approve direct users' purchase requests first
    console.log('\n✅ Step 3: Approving direct users\' purchase requests...');
    for (const { userId, requestId } of directPurchaseRequests) {
      await approvePurchaseRequest(requestId, adminToken);
      await sleep(1000); // Wait a bit longer for commission processing
    }
    
    // Step 5: Now register level-1 users (under direct users who now have active packages)
    console.log('\n📝 Step 4: Registering 2 level-1 users...');
    await sleep(2000); // Wait for commission processing to complete
    
    const level1User1 = await registerUser(
      'Level 1 User 1',
      `level1-1-${timestamp}@test.com`,
      `98767${timestamp.toString().slice(-5)}`,
      'Test@123',
      directUser1.id
    );
    await sleep(500);
    
    const level1User2 = await registerUser(
      'Level 1 User 2',
      `level1-2-${timestamp}@test.com`,
      `98768${timestamp.toString().slice(-5)}`,
      'Test@123',
      directUser2.id
    );
    await sleep(500);
    
    // Step 6: Login level-1 users and create purchase requests
    console.log('\n📦 Step 5: Creating purchase requests for level-1 users...');
    
    const level1Users = [level1User1, level1User2];
    const level1PurchaseRequests: { userId: string; requestId: string }[] = [];
    
    for (const user of level1Users) {
      // Login user
      const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
        userId: user.email,
        password: 'Test@123',
      });
      user.token = loginResponse.data.token;
      await sleep(500);
      
      // Create purchase request (Package 1 - ₹2,500)
      const requestId = await createPurchaseRequest(user.id, 1, user.token!);
      level1PurchaseRequests.push({ userId: user.id, requestId });
      await sleep(500);
    }
    
    // Step 7: Approve level-1 users' purchase requests
    console.log('\n✅ Step 6: Approving level-1 users\' purchase requests...');
    for (const { userId, requestId } of level1PurchaseRequests) {
      await approvePurchaseRequest(requestId, adminToken);
      await sleep(500);
    }
    
    const users = [...directUsers, ...level1Users];
    
    // Step 8: Check initial state
    console.log('\n📊 Step 7: Checking initial state...');
    await checkScheduledCommissions();
    await checkLedgerEntries();
    
    // Step 9: Wait 2 minutes for daily commission job
    console.log('\n⏳ Step 8: Waiting 2 minutes for daily commission job to run...');
    console.log('   (Job scheduled to run every 2 minutes)');
    for (let i = 120; i > 0; i -= 10) {
      process.stdout.write(`\r   ${i} seconds remaining...`);
      await sleep(10000);
    }
    console.log('\n   ✅ 2 minutes elapsed');
    
    // Step 10: Check final state
    console.log('\n📊 Step 9: Checking final state after job execution...');
    await checkScheduledCommissions();
    await checkLedgerEntries();
    
    // Step 11: Verify specific purchases
    console.log('\n🔍 Step 10: Verifying specific purchases...');
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: { in: users.map(u => BigInt(u.id)) }
      }
    });
    
    console.log(`\nFound ${purchases.length} purchases:`);
    for (const purchase of purchases) {
      const pkg = await prisma.packages.findUnique({
        where: { id: purchase.package_id }
      });
      const scheduled = await prisma.scheduled_commissions.count({
        where: { purchase_id: purchase.id }
      });
      const ledger = await prisma.ledger_entries.count({
        where: { purchase_id: purchase.id }
      });
      console.log(`  Purchase ${purchase.id}: Package ${pkg?.name || purchase.package_id} (₹${pkg?.price || 'N/A'})`);
      console.log(`    - Scheduled commissions: ${scheduled}`);
      console.log(`    - Ledger entries: ${ledger}`);
      
      // Show actual amounts
      const ledgerEntries = await prisma.ledger_entries.findMany({
        where: { 
          purchase_id: purchase.id,
          commission_type: { in: ['SELF', 'GLOBAL_HELPING'] }
        }
      });
      const total = ledgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);
      console.log(`    - Total credited (SELF + GLOBAL): ₹${total.toFixed(2)}`);
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

