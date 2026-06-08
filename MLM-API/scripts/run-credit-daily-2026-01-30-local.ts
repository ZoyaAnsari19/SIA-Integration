#!/usr/bin/env tsx
/**
 * Run creditDailyCommissions() in LOCAL DB as if today's date is 2026-01-30.
 *
 * This is only for LOCAL testing to ensure that after the GLOBAL_HELPING fixes,
 * 30 Jan commissions bhi sahi credit hote hain (no double amount / used IDs jump).
 */

// 1) Mock global Date so that new Date() (without args) returns 2026-01-30
const RealDate = Date;

function MockDate(this: any, ...args: any[]) {
  if (!(this instanceof MockDate)) {
    // Called as function: Date()
    return RealDate().toString();
  }

  if (args.length === 0) {
    return new RealDate('2026-01-30T00:00:00Z');
  }

  // Forward other constructor usages
  return new RealDate(...(args as ConstructorParameters<typeof Date>));
}

// Copy static methods
// @ts-ignore
MockDate.now = () => new RealDate('2026-01-30T00:00:00Z').getTime();
// @ts-ignore
MockDate.parse = RealDate.parse;
// @ts-ignore
MockDate.UTC = RealDate.UTC;

// Replace global Date
// @ts-ignore
global.Date = MockDate as unknown as DateConstructor;

// 2) Now import prisma & CommissionService (they will use mocked Date)
import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  console.log('='.repeat(80));
  console.log('💰 RUNNING creditDailyCommissions() FOR LOCAL DB AS 2026-01-30');
  console.log('='.repeat(80));
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('');

  const result = await CommissionService.creditDailyCommissions();
  console.log(`✅ creditDailyCommissions() completed: ${result.count} entries credited/skipped\n`);
}

main()
  .catch((err) => {
    console.error('❌ Error running daily commissions for 2026-01-30:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

