#!/usr/bin/env tsx
/**
 * Run creditDailyCommissions() in LOCAL DB for a specific date.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/run-credit-daily-for-date-local.ts 2026-01-27
 *   DATABASE_URL="postgresql://..." npx tsx scripts/run-credit-daily-for-date-local.ts 2026-01-28
 *   DATABASE_URL="postgresql://..." npx tsx scripts/run-credit-daily-for-date-local.ts 2026-01-29
 */

// Get target date from command line
const targetDateStr = process.argv[2];
if (!targetDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
  console.error('❌ Usage: npx tsx scripts/run-credit-daily-for-date-local.ts YYYY-MM-DD');
  console.error('   Example: npx tsx scripts/run-credit-daily-for-date-local.ts 2026-01-27');
  process.exit(1);
}

// Parse target date
const [year, month, day] = targetDateStr.split('-').map(Number);
const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

// Mock global Date so that new Date() (without args) returns targetDate
const RealDate = Date;

function MockDate(this: any, ...args: any[]) {
  if (!(this instanceof MockDate)) {
    // Called as function: Date()
    return RealDate().toString();
  }

  if (args.length === 0) {
    return new RealDate(targetDate);
  }

  // Forward other constructor usages
  return new RealDate(...(args as ConstructorParameters<typeof Date>));
}

// Copy static methods
// @ts-ignore
MockDate.now = () => targetDate.getTime();
// @ts-ignore
MockDate.parse = RealDate.parse;
// @ts-ignore
MockDate.UTC = RealDate.UTC;

// Replace global Date
// @ts-ignore
global.Date = MockDate as unknown as DateConstructor;

// Now import prisma & CommissionService (they will use mocked Date)
import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  console.log('='.repeat(80));
  console.log(`💰 RUNNING creditDailyCommissions() FOR LOCAL DB AS ${targetDateStr}`);
  console.log('='.repeat(80));
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL || 'NOT SET'}`);
  console.log('');

  const result = await CommissionService.creditDailyCommissions();
  console.log(`\n✅ creditDailyCommissions() completed:`);
  console.log(`   Credited: ${result.count} entries`);
  console.log(`   Date processed: ${targetDateStr}\n`);
}

main()
  .catch((err) => {
    console.error('❌ Error running daily commissions:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
