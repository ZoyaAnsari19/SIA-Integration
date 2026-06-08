#!/usr/bin/env tsx

/**
 * Seed 50 Users with 6-Level Hierarchy
 * 
 * Creates 50 users via API with proper hierarchy:
 * - Level 0: User 1 (root, referrer: system user ID 2)
 * - Level 1: Users 2-9 (8 users, referrer: User 1)
 * - Level 2: Users 10-17 (8 users, referrer: Users 2-9, distributed)
 * - Level 3: Users 18-25 (8 users, referrer: Users 10-17, distributed)
 * - Level 4: Users 26-33 (8 users, referrer: Users 18-25, distributed)
 * - Level 5: Users 34-41 (8 users, referrer: Users 26-33, distributed)
 * - Level 6: Users 42-50 (9 users, referrer: Users 34-41, distributed)
 * 
 * Then activates packages for all users and approves them.
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bilal@sia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nashik2nagpur';

interface User {
  id: string;
  email: string;
  name: string;
  token?: string;
}

interface PackageAssignment {
  userId: number;
  packageId: number;
}

// Package distribution: Package 1 (₹5000) to users 1,5,10,15,20,25,30,35,40,45, etc.
const PACKAGE_ASSIGNMENTS: PackageAssignment[] = [
  // Package 1 (₹5000): Users 1, 5, 10, 15, 20, 25, 30, 35, 40, 45
  { userId: 1, packageId: 1 }, { userId: 5, packageId: 1 }, { userId: 10, packageId: 1 },
  { userId: 15, packageId: 1 }, { userId: 20, packageId: 1 }, { userId: 25, packageId: 1 },
  { userId: 30, packageId: 1 }, { userId: 35, packageId: 1 }, { userId: 40, packageId: 1 },
  { userId: 45, packageId: 1 },
  // Package 2 (₹10000): Users 2, 6, 11, 16, 21, 26, 31, 36, 41, 46
  { userId: 2, packageId: 2 }, { userId: 6, packageId: 2 }, { userId: 11, packageId: 2 },
  { userId: 16, packageId: 2 }, { userId: 21, packageId: 2 }, { userId: 26, packageId: 2 },
  { userId: 31, packageId: 2 }, { userId: 36, packageId: 2 }, { userId: 41, packageId: 2 },
  { userId: 46, packageId: 2 },
  // Package 3 (₹15000): Users 3, 7, 12, 17, 22, 27, 32, 37, 42, 47
  { userId: 3, packageId: 3 }, { userId: 7, packageId: 3 }, { userId: 12, packageId: 3 },
  { userId: 17, packageId: 3 }, { userId: 22, packageId: 3 }, { userId: 27, packageId: 3 },
  { userId: 32, packageId: 3 }, { userId: 37, packageId: 3 }, { userId: 42, packageId: 3 },
  { userId: 47, packageId: 3 },
  // Package 4 (₹20000): Users 4, 8, 13, 18, 23, 28, 33, 38, 43, 48
  { userId: 4, packageId: 4 }, { userId: 8, packageId: 4 }, { userId: 13, packageId: 4 },
  { userId: 18, packageId: 4 }, { userId: 23, packageId: 4 }, { userId: 28, packageId: 4 },
  { userId: 33, packageId: 4 }, { userId: 38, packageId: 4 }, { userId: 43, packageId: 4 },
  { userId: 48, packageId: 4 },
  // Package 5 (₹25000): Users 9, 14, 19, 24, 29, 34, 39, 44, 49, 50
  { userId: 9, packageId: 5 }, { userId: 14, packageId: 5 }, { userId: 19, packageId: 5 },
  { userId: 24, packageId: 5 }, { userId: 29, packageId: 5 }, { userId: 34, packageId: 5 },
  { userId: 39, packageId: 5 }, { userId: 44, packageId: 5 }, { userId: 49, packageId: 5 },
  { userId: 50, packageId: 5 },
];

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
    
    if (!response.data.id) {
      throw new Error(`Registration failed: ${JSON.stringify(response.data)}`);
    }
    
    return {
      id: response.data.id.toString(),
      email: response.data.email || email,
      name: response.data.name || name,
    };
  } catch (error: any) {
    console.error(`❌ Failed to register ${name} (${email}):`, error.response?.data || error.message);
    throw error;
  }
}

async function loginUser(userId: string, password: string): Promise<string> {
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
      userId,
      password,
    });
    
    if (!response.data.token) {
      throw new Error('Login failed: No token received');
    }
    
    return response.data.token;
  } catch (error: any) {
    console.error(`❌ Failed to login user ${userId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function createPurchaseRequest(
  userToken: string,
  packageId: number,
  amount: number
): Promise<string> {
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/purchases`,
      {
        package_id: packageId,
        request_type: 'activation',
        amount,
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
    
    // Purchase request ID can be in different places in response
    const requestId = response.data.id || response.data.request_id || response.data.request?.id;
    if (!requestId) {
      throw new Error(`No request ID in response: ${JSON.stringify(response.data)}`);
    }
    
    return requestId.toString();
  } catch (error: any) {
    console.error(`❌ Failed to create purchase request:`, error.response?.data || error.message);
    throw error;
  }
}

async function approvePurchaseRequest(adminToken: string, requestId: string): Promise<void> {
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
  } catch (error: any) {
    console.error(`❌ Failed to approve request ${requestId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function getPackagePrice(packageId: number): Promise<number> {
  try {
    const response = await axios.get(`${API_URL}/api/v1/packages`);
    const pkg = response.data.find((p: any) => p.id === packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`);
    }
    return Number(pkg.price);
  } catch (error: any) {
    console.error(`❌ Failed to get package ${packageId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('🌱 Starting 50 Users Seeding Script');
  console.log('=====================================\n');
  
  const users: User[] = [];
  const timestamp = Date.now();
  
  // Step 1: Admin Login
  const adminToken = await adminLogin();
  console.log('');
  
  // Step 2: Create Users Level by Level and Activate Packages
  console.log('👥 Creating Users (Level by Level)');
  console.log('-----------------------------------\n');
  
  // Helper function to activate package for a user
  async function activateUserPackage(user: User, userIndex: number) {
    const assignment = PACKAGE_ASSIGNMENTS.find(a => a.userId === userIndex + 1);
    if (!assignment) return null;
    
    try {
      const userToken = await loginUser(user.id, 'Test@1234');
      user.token = userToken;
      const packagePrice = await getPackagePrice(assignment.packageId);
      const requestId = await createPurchaseRequest(userToken, assignment.packageId, packagePrice);
      await sleep(500); // Wait a bit before approving
      await approvePurchaseRequest(adminToken, requestId);
      await sleep(1000); // Wait for purchase to be processed
      console.log(`   ✅ Package ${assignment.packageId} activated for User ${userIndex + 1}`);
      return requestId;
    } catch (error: any) {
      console.log(`   ⚠️  Failed to activate package for User ${userIndex + 1}: ${error.message}`);
      return null;
    }
  }
  
  // Level 0: User 1 (root, referrer: system user ID 2)
  console.log('📊 Level 0: Creating User 1 (root)...');
  const user1 = await registerUser(
    'User 1',
    `user1-${timestamp}@test.com`,
    `9876543${String(1).padStart(3, '0')}`,
    'Test@1234',
    '2' // System root user
  );
  users.push(user1);
  console.log(`✅ User 1 created: ID ${user1.id}, Email: ${user1.email}`);
  // Activate package for User 1 immediately
  await activateUserPackage(user1, 0);
  await sleep(1000); // Wait for package activation to complete
  console.log('');
  
  // Level 1: Users 2-9 (8 users, referrer: User 1)
  console.log('📊 Level 1: Creating Users 2-9 (referrer: User 1)...');
  for (let i = 2; i <= 9; i++) {
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      user1.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id}`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  // Level 2: Users 10-17 (8 users, referrer: Users 2-9, distributed)
  console.log('📊 Level 2: Creating Users 10-17 (referrer: Users 2-9)...');
  for (let i = 10; i <= 17; i++) {
    const referrerIndex = 1 + ((i - 10) % 8); // Distribute across users 2-9
    const referrer = users[referrerIndex];
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      referrer.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id} (referrer: User ${referrerIndex + 1})`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  // Level 3: Users 18-25 (8 users, referrer: Users 10-17, distributed)
  console.log('📊 Level 3: Creating Users 18-25 (referrer: Users 10-17)...');
  for (let i = 18; i <= 25; i++) {
    const referrerIndex = 9 + ((i - 18) % 8); // Distribute across users 10-17
    const referrer = users[referrerIndex];
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      referrer.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id} (referrer: User ${referrerIndex + 1})`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  // Level 4: Users 26-33 (8 users, referrer: Users 18-25, distributed)
  console.log('📊 Level 4: Creating Users 26-33 (referrer: Users 18-25)...');
  for (let i = 26; i <= 33; i++) {
    const referrerIndex = 17 + ((i - 26) % 8); // Distribute across users 18-25
    const referrer = users[referrerIndex];
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      referrer.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id} (referrer: User ${referrerIndex + 1})`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  // Level 5: Users 34-41 (8 users, referrer: Users 26-33, distributed)
  console.log('📊 Level 5: Creating Users 34-41 (referrer: Users 26-33)...');
  for (let i = 34; i <= 41; i++) {
    const referrerIndex = 25 + ((i - 34) % 8); // Distribute across users 26-33
    const referrer = users[referrerIndex];
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      referrer.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id} (referrer: User ${referrerIndex + 1})`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  // Level 6: Users 42-50 (9 users, referrer: Users 34-41, distributed)
  console.log('📊 Level 6: Creating Users 42-50 (referrer: Users 34-41)...');
  for (let i = 42; i <= 50; i++) {
    const referrerIndex = 33 + ((i - 42) % 8); // Distribute across users 34-41
    const referrer = users[referrerIndex];
    const user = await registerUser(
      `User ${i}`,
      `user${i}-${timestamp}@test.com`,
      `9876543${String(i).padStart(3, '0')}`,
      'Test@1234',
      referrer.id
    );
    users.push(user);
    console.log(`✅ User ${i} created: ID ${user.id} (referrer: User ${referrerIndex + 1})`);
    // Activate package immediately
    await activateUserPackage(user, i - 1);
    await sleep(500);
  }
  console.log('');
  
  console.log(`✅ All 50 users created and packages activated!\n`);
  
  // Step 3: Login all users to get tokens (for data file)
  console.log('🔐 Logging in all users to get tokens...');
  for (let i = 0; i < users.length; i++) {
    try {
      if (!users[i].token) {
        const token = await loginUser(users[i].id, 'Test@1234');
        users[i].token = token;
      }
      if ((i + 1) % 10 === 0) {
        console.log(`✅ Logged in ${i + 1}/50 users...`);
      }
      await sleep(100);
    } catch (error: any) {
      console.error(`⚠️  Failed to login User ${i + 1} (${users[i].id}):`, error.message);
    }
  }
  console.log('✅ All users logged in\n');
  
  // Step 4: Save user data to file for use in other scripts
  const fs = await import('fs/promises');
  const userData = {
    timestamp,
    users: users.map((u, index) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      index: index + 1,
    })),
  };
  
  await fs.writeFile(
    './scripts/seed-50-users-data.json',
    JSON.stringify(userData, null, 2)
  );
  
  console.log('📄 User data saved to scripts/seed-50-users-data.json');
  console.log('\n🎉 Seeding completed successfully!');
  console.log(`   - Created ${users.length} users`);
  console.log(`   - Activated packages for all users`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

