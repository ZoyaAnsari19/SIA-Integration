/**
 * Seed script to create initial operation fee rules
 * Run this script to set up default fee rules for various operations
 * 
 * Usage: npx tsx scripts/seed-operation-fees.ts
 */

import { prisma } from '../src/config/prisma.js';

const feeRules = [
  {
    rule_code: 'ACCOUNT_CHANGE',
    rule_name: 'Account Details Change Fee',
    description: 'Fee charged when user updates account details (name, email, phone, address, bank details, etc.)',
    amount: 0, // Default: Free (admin can change via API)
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'KYC_APPLY',
    rule_name: 'KYC Application Fee',
    description: 'Fee charged when user submits KYC documents for verification',
    amount: 0, // Default: Free (admin can change via API)
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'FUND_WITHDRAW',
    rule_name: 'Fund Withdrawal Fee',
    description: 'Fee charged when user creates a withdrawal request',
    amount: 0, // Default: Free (admin can change via API)
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'ID_TRANSFER',
    rule_name: 'ID Transfer Fee',
    description: 'Fee charged when user transfers their referrer (changes referrer_user_id)',
    amount: 0, // Default: Free (admin can change via API)
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'OTP_SEND',
    rule_name: 'OTP Send Fee',
    description: 'Fee charged for each OTP sent to user mobile number',
    amount: 1, // Default: ₹1 (admin can change via API)
    is_active: true,
    applies_to: 'all_users',
  },
];

async function seedOperationFees() {
  console.log('🌱 Seeding operation fee rules...\n');

  for (const rule of feeRules) {
    try {
      const existing = await prisma.fee_rules.findUnique({
        where: { rule_code: rule.rule_code },
      });

      if (existing) {
        console.log(`⚠️  Fee rule ${rule.rule_code} already exists, skipping...`);
        continue;
      }

      const created = await prisma.fee_rules.create({
        data: rule,
      });

      console.log(`✅ Created fee rule: ${rule.rule_code} - ${rule.rule_name} (₹${rule.amount})`);
    } catch (error: any) {
      console.error(`❌ Error creating fee rule ${rule.rule_code}:`, error.message);
    }
  }

  console.log('\n✨ Fee rules seeding completed!');
  console.log('\n📝 Note: Admin can update fee amounts via API:');
  console.log('   PUT /api/v1/admin/fees/rules/:id');
  console.log('   Or create new rules via:');
  console.log('   POST /api/v1/admin/fees/rules');
}

seedOperationFees()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


