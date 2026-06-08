#!/usr/bin/env tsx

/**
 * Seed script to add TRANSACTION_PIN_FORGOT fee rule (₹50) for transaction PIN reset
 * Run with: npx tsx scripts/seed-transaction-pin-forgot-fee.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTransactionPinForgotFee() {
  try {
    console.log('🌱 Seeding TRANSACTION_PIN_FORGOT fee rule...');

    // Check if fee rule already exists
    const existing = await prisma.fee_rules.findUnique({
      where: { rule_code: 'TRANSACTION_PIN_FORGOT' },
    });

    if (existing) {
      // Update existing rule
      const updated = await prisma.fee_rules.update({
        where: { rule_code: 'TRANSACTION_PIN_FORGOT' },
        data: {
          rule_name: 'Transaction PIN Forgot Fee',
          description: 'Fee charged when user resets transaction PIN via forgot PIN flow',
          amount: 50.00,
          is_active: true,
          applies_to: 'all_users',
          updated_at: new Date(),
        },
      });
      console.log(`✅ Updated existing TRANSACTION_PIN_FORGOT fee rule: ₹${Number(updated.amount).toFixed(2)}`);
    } else {
      // Create new rule
      const created = await prisma.fee_rules.create({
        data: {
          rule_code: 'TRANSACTION_PIN_FORGOT',
          rule_name: 'Transaction PIN Forgot Fee',
          description: 'Fee charged when user resets transaction PIN via forgot PIN flow',
          amount: 50.00,
          is_active: true,
          applies_to: 'all_users',
        },
      });
      console.log(`✅ Created TRANSACTION_PIN_FORGOT fee rule: ₹${Number(created.amount).toFixed(2)}`);
    }

    console.log('\n✨ Successfully seeded TRANSACTION_PIN_FORGOT fee rule!');
    console.log('📝 Note: Admin can update fee amount via API:');
    console.log('   PUT /api/v1/admin/fees/rules/:id');
  } catch (error) {
    console.error('❌ Error seeding fee rule:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedTransactionPinForgotFee()
  .then(() => {
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });

