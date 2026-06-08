#!/usr/bin/env tsx

/**
 * Qualify user14 (ID = 50) up to Level 2 via API calls only.
 *
 * - Creates 4 direct legs under user14 via /auth/register
 * - For each leg:
 *   - Logs in
 *   - Buys Crown package (ID 10, ₹23,00,000) via /purchases
 *   - Admin approves activation request
 * - Finally prints user14 eligibility and MONTHLY schedules/ledger summary.
 *
 * Requirements for levels (from seed-levels.ts):
 * - Level 1: 1 leg with ≥ ₹3.75L business (total ≥ ₹3.75L)
 * - Level 2: 4 legs with ≥ ₹3.75L each (total ≥ ₹15L)
 *
 * One Crown package (₹23L) per leg is enough for both levels.
 */

import axios from 'axios';
import { prisma } from '../src/config/prisma.js';

const API_BASE = process.env.API_URL || 'http://localhost:3002/api/v1';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bilal@sia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nashik2nagpur';

const USER14_ID = 50;
const USER14_PASSWORD = 'password123';
const CROWN_PACKAGE_ID = 10; // ₹23,00,000

async function loginUser(userId: number | string, password: string) {
  const body = { userId: String(userId), password };
  const resp = await axios.post(`${API_BASE}/auth/login`, body);
  if (!resp.data?.token) {
    throw new Error(`Login failed for user ${userId}: ${JSON.stringify(resp.data)}`);
  }
  return resp.data.token as string;
}

async function loginAdmin() {
  const resp = await axios.post(`${API_BASE}/auth/admin/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!resp.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(resp.data)}`);
  }
  return resp.data.token as string;
}

async function registerLeg(index: number) {
  const email = `user14-leg${index}-${Date.now()}@test.local`;
  const mobile = `98${String(100000000 + index).slice(0, 8)}`.slice(0, 10);

  const resp = await axios.post(`${API_BASE}/auth/register`, {
    name: `User14 Leg ${index}`,
    email,
    mobile,
    password: 'password123',
    referrer_user_id: String(USER14_ID),
  });

  if (!resp.data?.id) {
    throw new Error(`Leg ${index} registration failed: ${JSON.stringify(resp.data)}`);
  }

  console.log(`  ✅ Leg ${index} registered: user_id=${resp.data.id}, email=${email}`);
  return Number(resp.data.id);
}

async function createAndApprovePurchaseForLeg(
  legUserId: number,
  adminToken: string,
) {
  const legToken = await loginUser(legUserId, 'password123');

  const reqResp = await axios.post(
    `${API_BASE}/purchases`,
    {
      package_id: CROWN_PACKAGE_ID,
      request_type: 'activation',
    },
    {
      headers: { Authorization: `Bearer ${legToken}` },
    },
  );

  const requestId =
    reqResp.data?.id ||
    reqResp.data?.request_id ||
    reqResp.data?.request?.id;

  if (!requestId) {
    throw new Error(
      `Purchase request failed for leg user ${legUserId}: ${JSON.stringify(
        reqResp.data,
      )}`,
    );
  }

  console.log(
    `    💳 Purchase request created for leg user ${legUserId}: request_id=${requestId}`,
  );

  const approveResp = await axios.post(
    `${API_BASE}/admin/activation/requests/${requestId}/approve`,
    {},
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );

  if (approveResp.data?.error) {
    throw new Error(
      `Approval failed for request ${requestId}: ${JSON.stringify(
        approveResp.data,
      )}`,
    );
  }

  console.log(`    ✅ Request ${requestId} approved by admin`);
}

async function showUser14Eligibility(user14Token: string) {
  const resp = await axios.get(
    `${API_BASE}/users/${USER14_ID}/eligibility`,
    {
      headers: { Authorization: `Bearer ${user14Token}` },
    },
  );

  console.log('\n📊 User14 Eligibility Snapshot:');
  console.log(
    JSON.stringify(
      resp.data?.eligibility?.filter((e: any) =>
        [0, 1, 2, 3].includes(e.level),
      ),
      null,
      2,
    ),
  );
}

async function showUser14MonthlySummary() {
  const userId = BigInt(USER14_ID);

  const schedules = await prisma.scheduled_commissions.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'MONTHLY',
    },
  });

  const ledger = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'MONTHLY',
    },
    orderBy: { credited_at: 'desc' },
    take: 20,
  });

  console.log('\n📅 MONTHLY schedules for user14:', schedules.length);
  for (const s of schedules) {
    console.log(
      `  • schedule_id=${s.id}, source_user_id=${s.source_user_id}, monthly_amount=₹${s.monthly_amount}, start=${s.start_date.toISOString().slice(0, 10)}`,
    );
  }

  console.log('\n💰 Latest MONTHLY ledger entries for user14:', ledger.length);
  if (ledger.length === 0) {
    console.log('  ⚠️  No MONTHLY ledger entries found yet (may need more time for daily commission job to run)');
  } else {
    let totalAmount = 0;
    for (const l of ledger) {
      totalAmount += Number(l.amount);
      console.log(
        `  • ledger_id=${l.id}, source_user_id=${l.source_user_id}, amount=₹${Number(l.amount).toFixed(2)}, credited_at=${l.credited_at.toISOString()}`,
      );
    }
    console.log(`  📊 Total MONTHLY credited so far: ₹${totalAmount.toFixed(2)}`);
  }
}

async function main() {
  console.log('🚀 Qualifying user14 (ID 50) up to Level 2 via API...');

  const user14Token = await loginUser(USER14_ID, USER14_PASSWORD);
  console.log('  ✅ User14 login successful');

  const adminToken = await loginAdmin();
  console.log('  ✅ Admin login successful');

  const legIds: number[] = [];
  for (let i = 1; i <= 4; i++) {
    console.log(`\n👤 Creating direct leg ${i} for user14...`);
    const legId = await registerLeg(i);
    legIds.push(legId);

    console.log(`  💼 Creating + approving purchase for leg ${i}...`);
    await createAndApprovePurchaseForLeg(legId, adminToken);
  }

  console.log('\n⏳ Waiting 110 seconds so daily commission job runs ~2 times (every 2 min)...');
  await new Promise((resolve) => setTimeout(resolve, 110000));

  console.log('\n📊 Checking via DB (Prisma) and API...\n');

  // DB Check
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 DB CHECK (Direct Prisma Query):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await showUser14MonthlySummary();

  // API Check
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 API CHECK (via /users/50/eligibility and /my-packages):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await showUser14Eligibility(user14Token);

  // Check ledger via API if endpoint exists
  try {
    const ledgerResp = await axios.get(
      `${API_BASE}/users/${USER14_ID}/income-history`,
      {
        headers: { Authorization: `Bearer ${user14Token}` },
      },
    );
    console.log('\n💰 Income History (via API):');
    const monthlyEntries = ledgerResp.data?.data?.filter(
      (e: any) => e.commission_type === 'MONTHLY',
    );
    console.log(`  Found ${monthlyEntries?.length || 0} MONTHLY entries via API`);
    if (monthlyEntries && monthlyEntries.length > 0) {
      monthlyEntries.slice(0, 5).forEach((e: any, i: number) => {
        console.log(
          `  ${i + 1}. Amount: ₹${e.amount}, Source: ${e.source_user_id}, Date: ${e.credited_at}`,
        );
      });
    }
  } catch (err: any) {
    console.log(
      `  ⚠️  Income history API not available: ${err.response?.status || err.message}`,
    );
  }

  console.log('\n✅ Done. User14 should now be qualified for Level 1 & 2, and MONTHLY royalty should be scheduled/crediting.');
}

main()
  .catch((err) => {
    console.error('❌ Error in qualify-user14-level2 script:', err?.response?.data || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


