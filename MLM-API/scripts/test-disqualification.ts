#!/usr/bin/env tsx
/**
 * Test Disqualification System
 * 
 * This script tests the disqualification logic:
 * 1. Check for users to disqualify
 * 2. Manually disqualify a user
 * 3. Verify disqualification effects
 */

import { DisqualificationService } from '../src/modules/commissions/disqualification.service.js';
import { prisma } from '../src/config/prisma.js';

async function testDisqualification() {
  console.log('🧪 Testing Disqualification System...\n');

  try {
    // 1. Check for users to disqualify
    console.log('1️⃣ Checking for users to disqualify...');
    const result = await DisqualificationService.checkAndDisqualifyUsers();
    console.log(`   ✅ Found and disqualified ${result.disqualified} users\n`);

    // 2. Show disqualified users
    console.log('2️⃣ Listing disqualified users...');
    const disqualifiedUsers = await prisma.users.findMany({
      where: { is_disqualified: true },
      select: {
        id: true,
        name: true,
        email: true,
        disqualified_at: true,
        created_at: true,
      },
      orderBy: { disqualified_at: 'desc' },
      take: 10,
    });

    if (disqualifiedUsers.length === 0) {
      console.log('   ℹ️  No disqualified users found\n');
    } else {
      console.log(`   📋 Found ${disqualifiedUsers.length} disqualified users:`);
      for (const user of disqualifiedUsers) {
        console.log(`      - User ${user.id} (${user.name || user.email}): Disqualified at ${user.disqualified_at?.toISOString()}`);
      }
      console.log('');
    }

    // 3. Check eligibility reset
    console.log('3️⃣ Checking level eligibility for disqualified users...');
    for (const user of disqualifiedUsers.slice(0, 3)) {
      const eligibility = await prisma.level_eligibility.findUnique({
        where: { user_id: user.id as unknown as bigint },
        select: { eligibility: true },
      });
      const elig = eligibility?.eligibility as Record<string, boolean> || {};
      const qualifiedLevels = Object.entries(elig).filter(([_, v]) => v).map(([k]) => k);
      console.log(`   User ${user.id}: Qualified levels: ${qualifiedLevels.length > 0 ? qualifiedLevels.join(', ') : 'None (reset ✅)'}`);
    }
    console.log('');

    // 4. Check pending commissions deleted
    console.log('4️⃣ Checking pending commissions for disqualified users...');
    for (const user of disqualifiedUsers.slice(0, 3)) {
      const pendingCount = await prisma.pending_commissions.count({
        where: { receiver_user_id: user.id as unknown as bigint },
      });
      console.log(`   User ${user.id}: ${pendingCount} pending commissions ${pendingCount === 0 ? '(deleted ✅)' : '(⚠️ still exists)'}`);
    }
    console.log('');

    // 5. Check scheduled commissions deleted
    console.log('5️⃣ Checking scheduled commissions for disqualified users...');
    for (const user of disqualifiedUsers.slice(0, 3)) {
      const scheduledCount = await prisma.scheduled_commissions.count({
        where: { receiver_user_id: user.id as unknown as bigint },
      });
      console.log(`   User ${user.id}: ${scheduledCount} scheduled commissions ${scheduledCount === 0 ? '(deleted ✅)' : '(⚠️ still exists)'}`);
    }
    console.log('');

    console.log('✅ Disqualification test completed!');
  } catch (error) {
    console.error('❌ Error testing disqualification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testDisqualification()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

