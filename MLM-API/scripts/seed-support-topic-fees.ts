/**
 * Seed fee rules for support tickets:
 * - SUPPORT_TICKET: fee for 2nd+ ticket when topic has no fee_rule_code (general topics)
 * - NUMBER_CHANGE: topic-based fee (e.g. mobile number change via support ticket)
 * - EMAIL_CHANGE: topic-based fee (e.g. email change via support ticket)
 * NAME_CHANGE already exists; link pre-questions to these rule codes for topic-based deduction.
 */
import { prisma } from '../src/config/prisma.js';

const RULES = [
  {
    rule_code: 'SUPPORT_TICKET',
    rule_name: 'Support ticket (2nd+ general topic)',
    description: 'Fee for 2nd and subsequent support tickets when topic has no specific fee',
    amount: 0,
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'NUMBER_CHANGE',
    rule_name: 'Number change (support topic)',
    description: 'Fee when user raises a ticket for mobile/number change',
    amount: 0,
    is_active: true,
    applies_to: 'all_users',
  },
  {
    rule_code: 'EMAIL_CHANGE',
    rule_name: 'Email change (support topic)',
    description: 'Fee when user raises a ticket for email change',
    amount: 0,
    is_active: true,
    applies_to: 'all_users',
  },
];

async function seed() {
  console.log('🌱 Seeding support topic fee rules...\n');
  for (const rule of RULES) {
    try {
      const existing = await prisma.fee_rules.findUnique({
        where: { rule_code: rule.rule_code },
      });
      if (existing) {
        await prisma.fee_rules.update({
          where: { rule_code: rule.rule_code },
          data: {
            rule_name: rule.rule_name,
            description: rule.description,
            amount: rule.amount,
            is_active: rule.is_active,
            applies_to: rule.applies_to,
            updated_at: new Date(),
          },
        });
        console.log(`✅ Updated fee rule: ${rule.rule_code} - ₹${rule.amount}`);
      } else {
        await prisma.fee_rules.create({
          data: rule,
        });
        console.log(`✅ Created fee rule: ${rule.rule_code} - ₹${rule.amount}`);
      }
    } catch (e) {
      console.error(`❌ Error seeding ${rule.rule_code}:`, e);
    }
  }
  console.log('\n✨ Support topic fee rules seeding done. Set amounts via Admin → Fee rules.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
