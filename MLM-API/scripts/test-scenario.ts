#!/usr/bin/env tsx
/**
 * Test Scenario Script
 * 
 * Course Details:
 * - Price: ₹2,500
 * - Self Commission: ₹62.50/month (2.5% of 2500)
 * - Validity: 13 months
 * - Global ID Cap: 55
 * - Global ID Rate: ₹6.25/member/month
 * - Spot Instant: 5% (₹125)
 * - Spot Recurring: 0.5%/month (₹12.50/month)
 * 
 * Scenario:
 * - Main User (Test Subject) buys course
 * - Month 1: 6 direct users (spread over 18 days) + 23 global users
 * - Month 2: 2 direct users + 20 global users
 * - Month 3: 0 direct users + 12 global users (total 55 reached)
 */

import { prisma } from '../src/config/prisma.js';

async function seedTestCourse() {
  console.log('🌱 Seeding test course...');
  
  // Delete existing test data
  await prisma.purchases.deleteMany({});
  await prisma.packages.deleteMany({});
  await prisma.user_tree_paths.deleteMany({});
  await prisma.users.deleteMany({});
  
  // Create course package
  const course = await prisma.packages.create({
    data: {
      name: 'Premium Course',
      price: 2500,
      validity_months: 13,
      self_monthly: 62.50,
      global_ids: 55,
      global_monthly_per_id: 6.25,
      recurring_rate_percent: 0.5, // 0.5% recurring spot
    }
  });
  
  console.log('✅ Course created:', course);
  
  // Create Main User (Test Subject)
  const mainUser = await prisma.users.create({
    data: {
      name: 'Main User (Test Subject)',
      email: 'mainuser@test.com',
    }
  });
  
  // Self path for main user
  await prisma.user_tree_paths.create({
    data: {
      ancestor_id: mainUser.id,
      descendant_id: mainUser.id,
      depth: 0,
    }
  });
  
  console.log('✅ Main User created:', mainUser);
  
  // Output for shell script
  console.log(`MAIN_USER_ID=${mainUser.id}`);
  console.log(`PKG_ID=${course.id}`);
  
  return { course, mainUser };
}

seedTestCourse()
  .then(() => {
    console.log('✅ Seed completed successfully!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });

