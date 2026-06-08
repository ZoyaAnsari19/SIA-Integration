#!/usr/bin/env tsx

/**
 * Seed script to add ACCOUNT_CHANGE fee rule (₹10) for profile updates
 * Run with: npx tsx scripts/seed-account-change-fee.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAccountChangeFee() {
  try {
    console.log('🌱 Seeding ACCOUNT_CHANGE fee rule...');

    // Check if fee rule already exists
    const existing = await prisma.fee_rules.findUnique({
      where: { rule_code: 'ACCOUNT_CHANGE' },
    });

    if (existing) {
      // Update existing rule
      const updated = await prisma.fee_rules.update({
        where: { rule_code: 'ACCOUNT_CHANGE' },
        data: {
          rule_name: 'Account Details Change Fee',
          description: 'Fee charged when user updates their profile details (name, email, phone, address, bank details)',
          amount: 10.00,
          is_active: true,
          applies_to: 'all_users',
          updated_at: new Date(),
        },
      });
      console.log(`✅ Updated existing ACCOUNT_CHANGE fee rule: ₹${Number(updated.amount).toFixed(2)}`);
    } else {
      // Create new rule
      const created = await prisma.fee_rules.create({
        data: {
          rule_code: 'ACCOUNT_CHANGE',
          rule_name: 'Account Details Change Fee',
          description: 'Fee charged when user updates their profile details (name, email, phone, address, bank details)',
          amount: 10.00,
          is_active: true,
          applies_to: 'all_users',
        },
      });
      console.log(`✅ Created ACCOUNT_CHANGE fee rule: ₹${Number(created.amount).toFixed(2)}`);
    }

    console.log('\n✨ Successfully seeded ACCOUNT_CHANGE fee rule!');
  } catch (error) {
    console.error('❌ Error seeding fee rule:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedAccountChangeFee()
  .then(() => {
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });

