#!/usr/bin/env tsx
/**
 * Recompute level eligibility for ALL users using current levels table (e.g. Level 1 combined rule).
 * Run against local DB: npm run recompute:eligibility (or tsx scripts/recompute-all-eligibility.ts)
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { recomputeAllEligibility } from '../src/modules/commissions/eligibility.compute.js';

async function main() {
  console.log('Recomputing level eligibility for all users...');
  const before = Date.now();
  await recomputeAllEligibility();
  const elapsed = ((Date.now() - before) / 1000).toFixed(1);
  console.log(`Done. Recomputed in ${elapsed}s.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
