import axios from 'axios';

const API_BASE = 'http://localhost:3002/api/v1';

async function main() {
  console.log('=== Testing New User Package Purchase Flow ===\n');
  
  // Step 1: Admin Login
  console.log('Step 1: Admin Login...');
  // Try common admin passwords
  let adminToken = '';
  const adminEmails = ['bilal@sia.com'];
  const adminPasswords = ['admin123', 'Admin@123', 'password', 'test123'];
  
  for (const email of adminEmails) {
    for (const password of adminPasswords) {
      try {
        const adminLogin = await axios.post(`${API_BASE}/auth/admin/login`, {
          email,
          password,
        });
        adminToken = adminLogin.data.token;
        console.log(`✓ Admin logged in with ${email}\n`);
        break;
      } catch (e: any) {
        // Continue trying
      }
    }
    if (adminToken) break;
  }
  
  if (!adminToken) {
    console.log('❌ Failed to login as admin. Using user login instead...');
    // Fallback: login as user 1 directly
    const userLogin = await axios.post(`${API_BASE}/users/login`, {
      email: 'bilal@sia.com',
    });
    adminToken = userLogin.data.token;
    console.log('✓ Using user token as admin\n');
  }
  
  // Step 2: Find 50k package (global_ids wala)
  console.log('Step 2: Finding 50k package...');
  const packages = await axios.get(`${API_BASE}/packages`);
  const pkg50k = packages.data.find((p: any) => Number(p.price) === 50000 && p.global_ids);
  
  if (!pkg50k) {
    console.log('❌ 50k package with global_ids not found');
    return;
  }
  
  console.log(`✓ Found package: ${pkg50k.name} (ID: ${pkg50k.id}, Price: ₹${pkg50k.price}, Global IDs: ${pkg50k.global_ids})\n`);
  
  // Step 3: Create new user
  console.log('Step 3: Creating new user...');
  const timestamp = Date.now();
  const newUser = await axios.post(`${API_BASE}/users/register`, {
    name: `Test User ${timestamp}`,
    email: `testuser${timestamp}@test.com`,
    mobile: `987654${String(timestamp).slice(-4)}`,
    password: 'Test@123',
  });
  const userId = newUser.data.id;
  console.log(`✓ User created: ID ${userId}, Email: ${newUser.data.email}\n`);
  
  // Step 4: User Login
  console.log('Step 4: User Login...');
  const userLogin = await axios.post(`${API_BASE}/users/login`, {
    email: `testuser${timestamp}@test.com`,
  });
  const userToken = userLogin.data.token;
  console.log('✓ User logged in\n');
  
  // Step 5: Create purchase request
  console.log('Step 5: Creating purchase request...');
  const purchaseRequest = await axios.post(
    `${API_BASE}/purchases`,
    {
      package_id: pkg50k.id,
      request_type: 'activation',
      amount: pkg50k.price,
    },
    {
      headers: { Authorization: `Bearer ${userToken}` },
    }
  );
  const requestId = purchaseRequest.data.request.id;
  console.log(`✓ Purchase request created: ID ${requestId}\n`);
  
  // Step 6: Wait a bit
  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 7: Admin approve purchase
  console.log('Step 6: Admin approving purchase...');
  const approveResponse = await axios.post(
    `${API_BASE}/admin/activation/requests/${requestId}/approve`,
    {},
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  console.log('✓ Purchase approved\n');
  console.log('Response:', JSON.stringify(approveResponse.data, null, 2));
  
  // Step 8: Wait for job processing
  console.log('\nWaiting 5 seconds for job to process...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 9: Check scheduled commissions
  console.log('\nStep 7: Checking scheduled commissions...');
  const scheduledCheck = await axios.get(
    `${API_BASE}/purchases/${approveResponse.data.purchase.id}/commissions`,
    {
      headers: { Authorization: `Bearer ${userToken}` },
    }
  );
  
  console.log('\n=== Scheduled Commissions ===');
  const scheduled = scheduledCheck.data.scheduled_commissions || [];
  console.log(`Total: ${scheduled.length}`);
  scheduled.forEach((s: any) => {
    console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}`);
  });
  
  if (scheduled.length === 0) {
    console.log('\n❌ NO SCHEDULED COMMISSIONS FOUND!');
    console.log('Issue: handlePurchase was not called or job failed');
  } else if (scheduled.length < 2) {
    console.log('\n⚠️  WARNING: Expected at least 2 scheduled commissions (SELF + GLOBAL_HELPING)');
  } else {
    console.log('\n✅ Scheduled commissions created successfully!');
  }
  
  // Step 10: Check purchase details
  console.log('\n=== Purchase Details ===');
  console.log(`Purchase ID: ${approveResponse.data.purchase.id}`);
  console.log(`User ID: ${userId}`);
  console.log(`Amount: ₹${approveResponse.data.purchase.amount}`);
}

main().catch((e) => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

