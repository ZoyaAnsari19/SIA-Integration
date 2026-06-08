#!/usr/bin/env tsx

/**
 * Test Renewal Income Reset
 * 
 * 1. User14's package income is already set to 2x
 * 2. Create renewal request
 * 3. Admin approve it
 * 4. Verify new purchase has income = 0
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:3002';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bilal@sia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nashik2nagpur';
const USER14_EMAIL = 'user14-1764542681957@test.com';
const USER14_PASSWORD = 'Test@123';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function adminLogin(): Promise<string> {
  console.log('🔐 Logging in as admin...');
  const response = await axios.post(`${API_URL}/api/v1/auth/admin/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!response.data.token) {
    throw new Error('Admin login failed');
  }
  console.log('✅ Admin logged in');
  return response.data.token;
}

async function userLogin(): Promise<{ token: string; userId: string }> {
  console.log('🔐 Logging in as user14...');
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
      userId: USER14_EMAIL,
      password: USER14_PASSWORD,
    }, {
      timeout: 10000,
    });
    if (!response.data.token) {
      throw new Error('User login failed: No token received');
    }
    console.log('✅ User logged in');
    return {
      token: response.data.token,
      userId: response.data.user.id,
    };
  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function createRenewalRequest(userToken: string, packageId: number): Promise<string> {
  console.log(`📦 Creating renewal request for package ${packageId}...`);
  const response = await axios.post(
    `${API_URL}/api/v1/purchases/renew`,
    {
      package_id: packageId,
    },
    {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    }
  );
  const requestId = response.data.request?.id || response.data.id;
  console.log(`✅ Renewal request created: ${requestId}`);
  return requestId;
}

async function approveRequest(requestId: string, adminToken: string): Promise<void> {
  console.log(`✅ Approving request ${requestId}...`);
  await axios.post(
    `${API_URL}/api/v1/admin/activation/requests/${requestId}/approve`,
    {},
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );
  console.log(`✅ Request approved`);
}

async function checkPurchaseIncome(purchaseId: bigint) {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      income: true,
      is_renewal: true,
      previous_package_id: true,
      purchased_at: true,
    },
  });
  
  if (!purchase) {
    console.log(`❌ Purchase ${purchaseId} not found`);
    return null;
  }
  
  console.log(`\n📊 Purchase ${purchase.id}:`);
  console.log(`   Amount: ₹${Number(purchase.amount).toFixed(2)}`);
  console.log(`   Income: ₹${Number(purchase.income || 0).toFixed(2)}`);
  console.log(`   Is Renewal: ${purchase.is_renewal ? '✅ Yes' : '❌ No'}`);
  console.log(`   Previous Package ID: ${purchase.previous_package_id || 'N/A'}`);
  console.log(`   Purchased At: ${purchase.purchased_at.toISOString()}`);
  
  const incomeIsZero = Number(purchase.income || 0) === 0;
  console.log(`   Income = 0: ${incomeIsZero ? '✅ CORRECT' : '❌ WRONG (should be 0)'}`);
  
  return purchase;
}

async function main() {
  console.log('🧪 Testing Renewal Income Reset');
  console.log('================================\n');
  
  try {
    // Step 1: Get user14's current purchase
    const user14 = await prisma.users.findUnique({
      where: { email: USER14_EMAIL },
      select: { id: true, display_id: true },
    });
    
    if (!user14) {
      throw new Error('User14 not found');
    }
    
    console.log(`👤 User14: ID ${user14.id}, Display ID: ${user14.display_id}`);
    
    const currentPurchase = await prisma.purchases.findFirst({
      where: {
        user_id: user14.id as unknown as bigint,
        status: 'completed',
      },
      orderBy: { id: 'desc' },
    });
    
    if (!currentPurchase) {
      throw new Error('No purchase found for user14');
    }
    
    console.log(`\n📦 Current Purchase:`);
    console.log(`   ID: ${currentPurchase.id}`);
    console.log(`   Amount: ₹${Number(currentPurchase.amount).toFixed(2)}`);
    console.log(`   Income: ₹${Number(currentPurchase.income || 0).toFixed(2)}`);
    console.log(`   2x Target: ₹${(Number(currentPurchase.amount) * 2).toFixed(2)}`);
    const reached2x = Number(currentPurchase.income || 0) >= Number(currentPurchase.amount) * 2;
    console.log(`   Reached 2x: ${reached2x ? '✅ Yes' : '❌ No'}`);
    
    if (!reached2x) {
      console.log(`\n⚠️  Purchase has not reached 2x. Income should be set to 2x first.`);
      return;
    }
    
    // Step 2: Login as user14
    const { token: userToken, userId } = await userLogin();
    await sleep(1000);
    
    // Step 3: Create renewal request
    const requestId = await createRenewalRequest(userToken, currentPurchase.package_id);
    await sleep(1000);
    
    // Step 4: Login as admin and approve
    const adminToken = await adminLogin();
    await sleep(1000);
    
    await approveRequest(requestId, adminToken);
    await sleep(2000); // Wait for commission processing
    
    // Step 5: Find the new renewal purchase
    const renewalPurchase = await prisma.purchases.findFirst({
      where: {
        user_id: user14.id as unknown as bigint,
        is_renewal: true,
        status: 'completed',
      },
      orderBy: { id: 'desc' },
    });
    
    if (!renewalPurchase) {
      throw new Error('Renewal purchase not found');
    }
    
    console.log(`\n🔄 Renewal Purchase Created:`);
    await checkPurchaseIncome(renewalPurchase.id as unknown as bigint);
    
    // Step 6: Verify income is 0
    const income = Number(renewalPurchase.income || 0);
    if (income === 0) {
      console.log(`\n✅ SUCCESS: Renewal purchase has income = 0`);
    } else {
      console.log(`\n❌ FAILED: Renewal purchase has income = ${income} (should be 0)`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

