import axios from 'axios';

const API_BASE = 'http://localhost:3002/api/v1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Testing User1 → User2 MONTHLY Commission Flow ===\n');
  
  // Step 1: Find 50k package (should have recurring_rate_percent now)
  console.log('Step 1: Finding 50k package...');
  const packages = await axios.get(`${API_BASE}/packages`);
  const pkg50k = packages.data.find((p: any) => Number(p.price) === 50000 && p.global_ids);
  
  if (!pkg50k) {
    console.log('❌ 50k package with global_ids not found');
    return;
  }
  
  console.log(`✓ Found package: ${pkg50k.name} (ID: ${pkg50k.id}, Price: ₹${pkg50k.price}, Recurring: ${pkg50k.recurring_rate_percent || 'NULL'}%)\n`);
  
  if (!pkg50k.recurring_rate_percent) {
    console.log('⚠️  WARNING: Package does not have recurring_rate_percent set!');
    console.log('MONTHLY commissions will not be scheduled.');
  }
  
  // Step 2: Create User1 via API
  console.log('Step 2: Creating User1 via API...');
  const timestamp = Date.now();
  const user1 = await axios.post(`${API_BASE}/users/register`, {
    name: `User1 Monthly Test ${timestamp}`,
    email: `user1monthly${timestamp}@test.com`,
  });
  const user1Id = user1.data.id;
  const user1DisplayId = user1.data.display_id;
  console.log(`✓ User1 created: ID ${user1Id}, Display ID: ${user1DisplayId || 'N/A'}\n`);
  
  // Step 3: User1 Login
  console.log('Step 3: User1 Login...');
  const user1Login = await axios.post(`${API_BASE}/users/login`, {
    email: `user1monthly${timestamp}@test.com`,
  });
  const user1Token = user1Login.data.token;
  console.log('✓ User1 logged in\n');
  
  // Step 4: User1 creates purchase request
  console.log('Step 4: User1 creating purchase request...');
  const user1PurchaseRequest = await axios.post(
    `${API_BASE}/purchases`,
    {
      package_id: pkg50k.id,
      request_type: 'activation',
      amount: pkg50k.price,
    },
    {
      headers: { Authorization: `Bearer ${user1Token}` },
    }
  );
  const user1RequestId = user1PurchaseRequest.data.request.id;
  console.log(`✓ User1 purchase request created: ID ${user1RequestId}\n`);
  
  // Step 5: Admin approve User1 purchase
  console.log('Step 5: Admin approving User1 purchase...');
  const user1Approve = await axios.post(
    `${API_BASE}/admin/activation/requests/${user1RequestId}/approve`,
    {},
    {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }
  );
  const user1PurchaseId = user1Approve.data.purchase.id;
  console.log(`✓ User1 purchase approved: Purchase ID ${user1PurchaseId}\n`);
  
  // Step 6: Wait for job processing
  console.log('Waiting 5 seconds for User1 job to process...');
  await sleep(5000);
  
  // Step 7: Check User1 scheduled commissions
  console.log('\nStep 6: Checking User1 scheduled commissions...');
  const user1Commissions = await axios.get(
    `${API_BASE}/purchases/${user1PurchaseId}/commissions`,
    {
      headers: { Authorization: `Bearer ${user1Token}` },
    }
  );
  
  const user1Scheduled = user1Commissions.data.scheduled_commissions || [];
  console.log(`\n=== User1 Scheduled Commissions ===`);
  console.log(`Total: ${user1Scheduled.length}`);
  user1Scheduled.forEach((s: any) => {
    console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}`);
  });
  
  if (user1Scheduled.length < 2) {
    console.log('\n❌ ISSUE: User1 should have at least 2 scheduled commissions (SELF + GLOBAL_HELPING)');
  } else {
    console.log('\n✅ User1 scheduled commissions created successfully!');
  }
  
  // Step 8: Create User2 with User1 as referrer
  console.log('\n\nStep 7: Creating User2 with User1 as referrer...');
  const user2 = await axios.post(`${API_BASE}/users/register`, {
    name: `User2 Monthly Test ${timestamp}`,
    email: `user2monthly${timestamp}@test.com`,
    referrer_user_id: user1Id,
  });
  const user2Id = user2.data.id;
  const user2DisplayId = user2.data.display_id;
  console.log(`✓ User2 created: ID ${user2Id}, Display ID: ${user2DisplayId || 'N/A'}, Referrer: ${user1Id}\n`);
  
  // Step 9: User2 Login
  console.log('Step 8: User2 Login...');
  const user2Login = await axios.post(`${API_BASE}/users/login`, {
    email: `user2monthly${timestamp}@test.com`,
  });
  const user2Token = user2Login.data.token;
  console.log('✓ User2 logged in\n');
  
  // Step 10: User2 creates purchase request
  console.log('Step 9: User2 creating purchase request...');
  const user2PurchaseRequest = await axios.post(
    `${API_BASE}/purchases`,
    {
      package_id: pkg50k.id,
      request_type: 'activation',
      amount: pkg50k.price,
    },
    {
      headers: { Authorization: `Bearer ${user2Token}` },
    }
  );
  const user2RequestId = user2PurchaseRequest.data.request.id;
  console.log(`✓ User2 purchase request created: ID ${user2RequestId}\n`);
  
  // Step 11: Admin approve User2 purchase
  console.log('Step 10: Admin approving User2 purchase...');
  const user2Approve = await axios.post(
    `${API_BASE}/admin/activation/requests/${user2RequestId}/approve`,
    {},
    {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }
  );
  const user2PurchaseId = user2Approve.data.purchase.id;
  console.log(`✓ User2 purchase approved: Purchase ID ${user2PurchaseId}\n`);
  
  // Step 12: Wait for job processing
  console.log('Waiting 5 seconds for User2 job to process...');
  await sleep(5000);
  
  // Step 13: Check User1 ledger for SPOT commission
  console.log('\nStep 11: Checking User1 SPOT commission from User2 purchase...');
  const user2Commissions = await axios.get(
    `${API_BASE}/purchases/${user2PurchaseId}/commissions`,
    {
      headers: { Authorization: `Bearer ${user2Token}` },
    }
  );
  
  console.log('\n=== User1 SPOT Commission (from User2 purchase) ===');
  const user1Credited = user2Commissions.data.credited_commissions || [];
  const spotCommissions = user1Credited.filter((c: any) => 
    c.commission_type === 'SPOT' && c.receiver_user_id === user1Id
  );
  console.log(`SPOT commissions found: ${spotCommissions.length}`);
  spotCommissions.forEach((c: any) => {
    console.log(`  Amount: ₹${c.amount}, Receiver: ${c.receiver_name || c.receiver_user_id}, Credited: ${c.credited_at}`);
  });
  
  if (spotCommissions.length === 0) {
    console.log('\n❌ ISSUE: User1 should have received SPOT commission from User2 purchase');
  } else {
    console.log('\n✅ User1 received SPOT commission from User2 purchase!');
  }
  
  // Step 14: Check User1 scheduled MONTHLY commissions (from User2 purchase)
  console.log('\n\nStep 12: Checking User1 scheduled MONTHLY commissions (from User2 purchase)...');
  
  // Get all scheduled commissions for User1
  const user1AllCommissions = await axios.get(
    `${API_BASE}/purchases/${user1PurchaseId}/commissions`,
    {
      headers: { Authorization: `Bearer ${user1Token}` },
    }
  );
  
  // Also check User2's purchase to see if MONTHLY was scheduled for User1
  const user2AllCommissions = await axios.get(
    `${API_BASE}/purchases/${user2PurchaseId}/commissions`,
    {
      headers: { Authorization: `Bearer ${user2Token}` },
    }
  );
  
  // MONTHLY commissions are scheduled for the referrer (User1) from User2's purchase
  // They should appear in User1's scheduled commissions with purchase_id = User2's purchase
  const user1MonthlyScheduled = user1AllCommissions.data.scheduled_commissions?.filter(
    (s: any) => s.commission_type === 'MONTHLY' && s.purchase_id === user2PurchaseId
  ) || [];
  
  console.log(`\n=== User1 MONTHLY Scheduled Commissions (from User2 purchase) ===`);
  console.log(`Total MONTHLY from User2: ${user1MonthlyScheduled.length}`);
  user1MonthlyScheduled.forEach((s: any) => {
    console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}, Purchase: ${s.purchase_id}`);
  });
  
  // Also check all MONTHLY scheduled for User1
  const allUser1Monthly = user1AllCommissions.data.scheduled_commissions?.filter(
    (s: any) => s.commission_type === 'MONTHLY'
  ) || [];
  
  console.log(`\nAll MONTHLY scheduled for User1: ${allUser1Monthly.length}`);
  allUser1Monthly.forEach((s: any) => {
    console.log(`  Monthly: ₹${s.monthly_amount}, Purchase: ${s.purchase_id}, Start: ${s.start_date}`);
  });
  
  if (user1MonthlyScheduled.length === 0) {
    console.log('\n❌ ISSUE: User1 should have MONTHLY scheduled commission from User2 purchase');
    console.log('Expected: 0.5% of ₹50,000 = ₹250/month');
  } else {
    console.log('\n✅ User1 has MONTHLY scheduled commission from User2 purchase!');
    console.log('This will be processed daily by PgBoss cron job.');
  }
  
  // Step 15: Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`User1 ID: ${user1Id} (${user1DisplayId || 'N/A'})`);
  console.log(`User2 ID: ${user2Id} (${user2DisplayId || 'N/A'})`);
  console.log(`User1 Purchase ID: ${user1PurchaseId}`);
  console.log(`User2 Purchase ID: ${user2PurchaseId}`);
  console.log(`Package Recurring Rate: ${pkg50k.recurring_rate_percent || 'NULL'}%`);
  console.log(`\nUser1 Scheduled Commissions: ${user1Scheduled.length} (SELF + GLOBAL_HELPING)`);
  console.log(`User1 SPOT from User2: ${spotCommissions.length > 0 ? '✅ Yes' : '❌ No'}`);
  console.log(`User1 MONTHLY from User2: ${user1MonthlyScheduled.length > 0 ? '✅ Yes' : '❌ No'}`);
  
  if (user1MonthlyScheduled.length > 0) {
    const monthlyAmount = user1MonthlyScheduled[0].monthly_amount;
    console.log(`\n✅ MONTHLY Commission Details:`);
    console.log(`  Monthly Amount: ₹${monthlyAmount}`);
    console.log(`  Expected: 0.5% of ₹50,000 = ₹250/month`);
    console.log(`  Daily: ₹${monthlyAmount} ÷ 31 days ≈ ₹${(monthlyAmount / 31).toFixed(2)}/day`);
    console.log(`  Processed by: PgBoss daily commission cron (every 2 minutes for testing)`);
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

