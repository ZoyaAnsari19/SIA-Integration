/**
 * Seed support ticket topics (pre-questions) and their fee rules for local DB.
 * Run: npx tsx scripts/seed-support-topics-and-fees.ts
 */
import { prisma } from '../src/config/prisma.js';

const FEE_RULES = [
  { rule_code: 'GENERAL_PROBLEM', rule_name: 'General Problem', amount: 30, description: 'Support topic: General Problem' },
  { rule_code: 'COMMISSION_ISSUE', rule_name: 'Commission Issue', amount: 30, description: 'Support topic: Commission Issue' },
  { rule_code: 'COMMISSION_ANALYSIS', rule_name: 'Details ID Commission Analysis & Issue', amount: 100, description: 'Support topic: Commission Analysis' },
  { rule_code: 'NAME_CORRECTION_MINOR', rule_name: 'Name Correction (Spelling)', amount: 30, description: 'Support topic: Name Correction Minor' },
  { rule_code: 'EMAIL_CORRECTION', rule_name: 'Email Correction', amount: 30, description: 'Support topic: Email Correction' },
  { rule_code: 'MOBILE_CORRECTION_MINOR', rule_name: 'Mobile Number Correction (Digit)', amount: 30, description: 'Support topic: Mobile Correction Minor' },
  { rule_code: 'FULL_NAME_CHANGE', rule_name: 'Full Name Change', amount: 100, description: 'Support topic: Full Name Change' },
  { rule_code: 'FULL_MOBILE_CHANGE', rule_name: 'Full Mobile Number Change', amount: 100, description: 'Support topic: Full Mobile Change' },
  { rule_code: 'INFORMATION_PROBLEM', rule_name: 'Information Problem', amount: 21, description: 'Support topic: Information Problem' },
  { rule_code: 'CHEQUE_RETURN_ISSUE', rule_name: 'Cheque Return Issue', amount: 21, description: 'Support topic: Cheque Return Issue' },
];

const PRE_QUESTIONS = [
  { question: 'General Problem', category: 'general', sort_order: 1, fee_rule_code: 'GENERAL_PROBLEM' },
  { question: 'Commission Issue', category: 'general', sort_order: 2, fee_rule_code: 'COMMISSION_ISSUE' },
  { question: 'Details ID Commission Analysis & Issue', category: 'general', sort_order: 3, fee_rule_code: 'COMMISSION_ANALYSIS' },
  { question: 'Name Correction (Spelling Mistake)', category: 'profile_minor', sort_order: 4, fee_rule_code: 'NAME_CORRECTION_MINOR' },
  { question: 'Email Correction', category: 'profile_minor', sort_order: 5, fee_rule_code: 'EMAIL_CORRECTION' },
  { question: 'Mobile Number Correction (Digit Mistake)', category: 'profile_minor', sort_order: 6, fee_rule_code: 'MOBILE_CORRECTION_MINOR' },
  { question: 'Full Name Change', category: 'profile_major', sort_order: 7, fee_rule_code: 'FULL_NAME_CHANGE' },
  { question: 'Full Mobile Number Change', category: 'profile_major', sort_order: 8, fee_rule_code: 'FULL_MOBILE_CHANGE' },
  { question: 'Information Problem', category: 'information_banking', sort_order: 9, fee_rule_code: 'INFORMATION_PROBLEM' },
  { question: 'Cheque Return Issue', category: 'information_banking', sort_order: 10, fee_rule_code: 'CHEQUE_RETURN_ISSUE' },
];

async function seed() {
  console.log('🌱 Seeding support topic fee rules and pre-questions...\n');

  for (const r of FEE_RULES) {
    await prisma.fee_rules.upsert({
      where: { rule_code: r.rule_code },
      update: { rule_name: r.rule_name, amount: r.amount, description: r.description, is_active: true, updated_at: new Date() },
      create: {
        rule_code: r.rule_code,
        rule_name: r.rule_name,
        amount: r.amount,
        description: r.description,
        is_active: true,
        applies_to: 'all_users',
      },
    });
    console.log(`  ✅ Fee rule: ${r.rule_code} — ₹${r.amount}`);
  }

  console.log('\n📋 Pre-questions (skip if question already exists):');
  for (const p of PRE_QUESTIONS) {
    const existing = await prisma.support_pre_questions.findFirst({
      where: { question: p.question },
    });
    if (existing) {
      await prisma.support_pre_questions.update({
        where: { id: existing.id },
        data: {
          category: p.category,
          sort_order: p.sort_order,
          fee_rule_code: p.fee_rule_code,
          is_active: true,
          updated_at: new Date(),
        },
      });
      console.log(`  ✅ Updated: ${p.question}`);
    } else {
      await prisma.support_pre_questions.create({
        data: {
          question: p.question,
          category: p.category,
          sort_order: p.sort_order,
          fee_rule_code: p.fee_rule_code,
          is_active: true,
        },
      });
      console.log(`  ✅ Created: ${p.question}`);
    }
  }

  console.log('\n✨ Done.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
