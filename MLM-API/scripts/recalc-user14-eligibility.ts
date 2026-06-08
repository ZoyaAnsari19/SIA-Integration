#!/usr/bin/env tsx

import { prisma } from '../src/config/prisma.js';
import { computeEligibilityForUser } from '../src/modules/commissions/eligibility.compute.js';

async function main() {
  const userId = BigInt(50); // user14
  console.log(`🔄 Recalculating eligibility for user ${userId}...`);
  
  await computeEligibilityForUser(userId);
  console.log('✅ Eligibility recalculated');
  
  // Check result
  const elig = await prisma.level_eligibility.findUnique({
    where: { user_id: userId }
  });
  
  console.log('\n📊 Updated Eligibility:');
  console.log(JSON.stringify(elig?.eligibility, null, 2));
  
  console.log('\n✅ Level 1:', elig?.eligibility?.['1'] ? '✅ Qualified' : '❌ Not Qualified');
  console.log('✅ Level 2:', elig?.eligibility?.['2'] ? '✅ Qualified' : '❌ Not Qualified');
  console.log('✅ Level 9:', elig?.eligibility?.['9'] ? '✅ Qualified' : '❌ Not Qualified (should be false)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
