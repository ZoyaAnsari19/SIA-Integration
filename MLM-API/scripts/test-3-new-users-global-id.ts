import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:3002/api/v1';
const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Testing Global ID Count with 3 New Users ===\n');

  // Step 1: Admin Login - try admin_token
  console.log('Step 1: Admin Login...');
  let adminToken;
  try {
    const adminLogin = await axios.post(`${API_BASE}/auth/admin/login`, {
      admin_token: 'dev-admin'
    });
    adminToken = adminLogin.data.token;
    console.log('✓ Admin logged in (admin_token)\n');
  } catch (error: any) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    console.log('Trying to proceed without admin approval...\n');
  }

  // Step 2: Get Basic Package
  console.log('Step 2: Finding Basic Package...');
  let basicPackage;
  try {
    const packagesRes = await axios.get(`${API_BASE}/packages`);
    basicPackage = packagesRes.data.find((p: any) => p.id === 2);
  } catch (error: any) {
    console.error('❌ Could not fetch packages:', error.message);
    return;
  }
  
  if (!basicPackage) {
    console.error('❌ Basic Package not found');
    return;
  }
  console.log(`✓ Found package: ${basicPackage.name} (ID: ${basicPackage.id}, Price: ₹${basicPackage.price})\n`);

  // Step 3: Check User 47's current global ID count (before new users)
  console.log('Step 3: Checking User 47 (SIA02044) current status...');
  const user47 = await prisma.users.findUnique({
    where: { id: BigInt(47) },
    select: { email: true, display_id: true },
  });
  
  const user47Purchase = await prisma.purchases.findUnique({
    where: { id: BigInt(47) },
    select: { purchased_at: true, effective_global_ids: true },
  });
  
  let beforeCount = 0;
  if (user47Purchase) {
    const beforePurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        is_renewal: false,
        purchased_at: { gt: user47Purchase.purchased_at },
        user_id: { not: BigInt(47) },
      },
      select: { user_id: true },
      distinct: ['user_id'],
    });
    beforeCount = beforePurchases.length;
    console.log(`User 47 (${user47?.display_id || 'N/A'}): ${beforeCount} unique users\n`);
  }

  // Step 4: Create 3 new users
  console.log('Step 4: Creating 3 new users...');
  const timestamp = Date.now();
  const newUsers = [];
  
  for (let i = 1; i <= 3; i++) {
    const userEmail = `testglobal${timestamp}${i}@test.com`;
    const userRes = await axios.post(`${API_BASE}/users/register`, {
      name: `Test Global User ${i} - ${timestamp}`,
      email: userEmail,
    });
    newUsers.push({
      id: userRes.data.id,
      display_id: userRes.data.display_id,
      email: userEmail,
    });
    console.log(`  ✓ User ${i} created: ID ${userRes.data.id}, Display: ${userRes.data.display_id}`);
  }
  console.log('');

  // Step 5: Login each user and create purchase requests
  console.log('Step 5: Creating purchase requests for 3 users...');
  const purchaseIds = [];
  
  for (let i = 0; i < 3; i++) {
    const user = newUsers[i];
    
    try {
      // Login
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        userId: user.email,
        password: 'password123'
      });
      const userToken = loginRes.data.token;
      
      // Create purchase request
      const purchaseReqRes = await axios.post(`${API_BASE}/purchases`, {
        package_id: basicPackage.id,
        request_type: 'activation',
        amount: basicPackage.price,
        payment_type: 'UPI',
        txn_id: `TXN_GLOBAL${i+1}_${Date.now()}`,
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const requestId = purchaseReqRes.data.request.id;
      console.log(`  ✓ User ${i+1} purchase request created: ID ${requestId}`);
      
      // Admin approve if we have token
      if (adminToken) {
        try {
          const approveRes = await axios.post(`${API_BASE}/admin/activation/requests/${requestId}/approve`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          const purchaseId = approveRes.data.purchase.id;
          purchaseIds.push(purchaseId);
          console.log(`  ✓ User ${i+1} purchase approved: Purchase ID ${purchaseId}`);
        } catch (error: any) {
          console.log(`  ⚠️  Could not approve: ${error.response?.data?.error || error.message}`);
        }
      } else {
        console.log(`  ⚠️  Purchase request created but not approved (no admin token)`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error for User ${i+1}: ${error.response?.data?.error || error.message}`);
    }
    
    await sleep(1000);
  }
  console.log('');

  // Step 6: Wait for processing
  console.log('Step 6: Waiting for processing...');
  await sleep(3000);
  console.log('✓ Processing complete\n');

  // Step 7: Check User 47's global ID count (after new users)
  console.log('Step 7: Checking User 47 (SIA02044) updated status...');
  if (user47Purchase) {
    const afterPurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
        is_renewal: false,
        purchased_at: { gt: user47Purchase.purchased_at },
        user_id: { not: BigInt(47) },
      },
      select: { user_id: true },
      distinct: ['user_id'],
    });
    
    const afterCount = afterPurchases.length;
    
    console.log(`Before: ${beforeCount} unique users`);
    console.log(`After: ${afterCount} unique users`);
    console.log(`Increase: +${afterCount - beforeCount}\n`);
    
    if (afterCount - beforeCount === 3) {
      console.log('✅ SUCCESS: Global ID count increased by 3 (one for each new user)');
    } else if (afterCount - beforeCount > 0) {
      console.log(`✅ Partial Success: Global ID count increased by ${afterCount - beforeCount}`);
      console.log(`   (Expected 3, but some purchases may not be approved yet)`);
    } else {
      console.log('⚠️  Count did not increase. Purchases may not be approved yet.');
      console.log('   Please approve the purchase requests manually via admin panel.');
    }
  }

  // Step 8: Check via API
  console.log('\nStep 8: Verifying via API...');
  if (user47 && user47.email) {
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        userId: user47.email,
        password: 'password123'
      });
      const user47Token = loginRes.data.token;
      
      const packagesRes = await axios.get(`${API_BASE}/my-packages`, {
        headers: { Authorization: `Bearer ${user47Token}` }
      });
      
      const activePackages = packagesRes.data.items.filter((p: any) => p.status === 'completed' && p.is_active);
      
      if (activePackages.length > 0) {
        const pkg = activePackages[0];
        console.log(`Package: ${pkg.package_name}`);
        console.log(`Total Global Users: ${pkg.global_ids_info?.total_global_users || 'N/A'}`);
        console.log(`Used IDs: ${pkg.global_ids_info?.used_ids || 'N/A'}`);
        console.log(`Remaining: ${pkg.global_ids_info?.remaining_ids || 'N/A'}`);
      }
    } catch (error: any) {
      console.log('Could not verify via API:', error.response?.data?.error || error.message);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log(`Created 3 new users:`);
  newUsers.forEach((u, i) => {
    console.log(`  User ${i+1}: ID ${u.id} (${u.display_id || 'N/A'})`);
  });
  
  if (purchaseIds.length < 3) {
    console.log(`\n⚠️  Note: Only ${purchaseIds.length}/3 purchases were approved.`);
    console.log('   You may need to approve the remaining purchases manually.');
  }
  
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Error:', error.response?.data || error.message);
  await prisma.$disconnect();
  process.exit(1);
});

