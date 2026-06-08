import axios from 'axios';

const API_BASE = 'http://localhost:3002/api/v1';

async function main() {
  console.log('=== Testing Purchase Flow via API ===\n');
  
  // Step 1: Find 50k package
  console.log('Step 1: Finding 50k package...');
  const packages = await axios.get(`${API_BASE}/packages`);
  const pkg50k = packages.data.find((p: any) => Number(p.price) === 50000 && p.global_ids);
  
  if (!pkg50k) {
    console.log('❌ 50k package with global_ids not found');
    return;
  }
  
  console.log(`✓ Found package: ${pkg50k.name} (ID: ${pkg50k.id}, Price: ₹${pkg50k.price}, Global IDs: ${pkg50k.global_ids})\n`);
  
  // Step 2: Create new user
  console.log('Step 2: Creating new user via API...');
  const timestamp = Date.now();
  const newUser = await axios.post(`${API_BASE}/users/register`, {
    name: `Test User ${timestamp}`,
    email: `testuser${timestamp}@test.com`,
    mobile: `987654${String(timestamp).slice(-4)}`,
    password: 'Test@123',
  });
  const userId = newUser.data.id;
  console.log(`✓ User created: ID ${userId}, Email: ${newUser.data.email}\n`);
  
  // Step 3: User Login
  console.log('Step 3: User Login via API...');
  const userLogin = await axios.post(`${API_BASE}/users/login`, {
    email: `testuser${timestamp}@test.com`,
  });
  const userToken = userLogin.data.token;
  console.log('✓ User logged in\n');
  
  // Step 4: Create purchase request
  console.log('Step 4: Creating purchase request via API...');
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
  console.log('Request details:', JSON.stringify(purchaseRequest.data, null, 2));
  
  // Step 5: Try to approve using ADMIN_TOKEN from env
  console.log('\nStep 5: Attempting to approve purchase...');
  const adminToken = process.env.ADMIN_TOKEN || 'dev-admin';
  
  try {
    const approveResponse = await axios.post(
      `${API_BASE}/admin/activation/requests/${requestId}/approve`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log('✓ Purchase approved via API\n');
    console.log('Approval response:', JSON.stringify(approveResponse.data, null, 2));
    
    const purchaseId = approveResponse.data.purchase.id;
    
    // Step 6: Wait for job processing (5 seconds)
    console.log('\nStep 6: Waiting 5 seconds for job to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 7: Check scheduled commissions via API
    console.log('\nStep 7: Checking scheduled commissions via API...');
    try {
      const scheduledCheck = await axios.get(
        `${API_BASE}/purchases/${purchaseId}/commissions`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      
      console.log('\n=== Scheduled Commissions (from API) ===');
      const scheduled = scheduledCheck.data.scheduled_commissions || [];
      console.log(`Total: ${scheduled.length}`);
      scheduled.forEach((s: any) => {
        console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}`);
      });
      
      if (scheduled.length === 0) {
        console.log('\n❌ ISSUE FOUND: NO SCHEDULED COMMISSIONS!');
        console.log('This means handlePurchase was NOT called automatically.');
        console.log('The purchase-commission job may not be processing.');
      } else if (scheduled.length < 2) {
        console.log('\n⚠️  WARNING: Expected at least 2 scheduled commissions (SELF + GLOBAL_HELPING)');
        console.log(`Found only ${scheduled.length}`);
      } else {
        console.log('\n✅ SUCCESS: Scheduled commissions created automatically!');
        console.log('This confirms handlePurchase is being called via job queue.');
      }
    } catch (e: any) {
      console.log('❌ Error checking commissions:', e.response?.data || e.message);
    }
    
  } catch (e: any) {
    console.log('❌ Failed to approve purchase:', e.response?.data || e.message);
    console.log('\n⚠️  Cannot complete test without admin approval.');
    console.log('Purchase request ID:', requestId);
    console.log('You can manually approve it via admin panel or API.');
  }
  
  console.log('\n=== Test Complete ===');
}

main().catch((e) => {
  console.error('Error:', e.response?.data || e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data:', JSON.stringify(e.response.data, null, 2));
  }
  process.exit(1);
});

