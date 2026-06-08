import { prisma } from '../src/config/prisma.js';

async function seedFees() {
  console.log('🌱 Seeding fee rules...');

  const defaultRules = [
    {
      rule_code: 'KYC_SUBMISSION',
      rule_name: 'KYC Submission Fee',
      description: 'Fee charged when user submits KYC documents',
      amount: -25.00,
      is_active: true,
      applies_to: 'all_users',
    },
    {
      rule_code: 'NAME_CHANGE',
      rule_name: 'Name Change Fee',
      description: 'Fee charged when user changes their name',
      amount: 2.00,
      is_active: true,
      applies_to: 'all_users',
    },
    {
      rule_code: 'REPORT_DOWNLOAD',
      rule_name: 'Report Download Fee',
      description: 'Fee charged when user downloads/generates a report',
      amount: 20.00,
      is_active: true,
      applies_to: 'all_users',
    },
    {
      rule_code: 'BOND_DOWNLOAD',
      rule_name: 'Bond Agreement Download Fee',
      description: 'Fee charged when user downloads bond agreement/receipt-cum-mutual agreement',
      amount: 10.00,
      is_active: true,
      applies_to: 'all_users',
    },
  ];

  for (const rule of defaultRules) {
    try {
      await prisma.fee_rules.upsert({
        where: { rule_code: rule.rule_code },
        update: {
          rule_name: rule.rule_name,
          description: rule.description,
          amount: rule.amount,
          is_active: rule.is_active,
          applies_to: rule.applies_to,
          updated_at: new Date(),
        },
        create: rule,
      });
      console.log(`✅ Fee rule created/updated: ${rule.rule_code} - ₹${rule.amount}`);
    } catch (error) {
      console.error(`❌ Error seeding fee rule ${rule.rule_code}:`, error);
    }
  }

  console.log('✅ Fee rules seeding completed!');
}

seedFees()
  .catch((error) => {
    console.error('Error seeding fees:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

