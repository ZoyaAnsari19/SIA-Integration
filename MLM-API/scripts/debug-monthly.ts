#!/usr/bin/env tsx

import { prisma } from '../src/config/prisma.js';
import { isUserActive } from '../src/utils/business.js';

async function debugMonthly() {
  const schedules = await prisma.scheduled_commissions.findMany({
    where: {
      receiver_user_id: 1n,
      commission_type: 'MONTHLY'
    }
  });

  console.log('📊 Total MONTHLY schedules for Siddhant:', schedules.length);
  console.log();

  for (const s of schedules) {
    const srcId = s.source_user_id!;
    const srcActive = await isUserActive(srcId);
    const rcvActive = await isUserActive(s.receiver_user_id);
    const srcUser = await prisma.users.findUnique({ where: { id: srcId }, select: { name: true } });
    
    console.log(`Schedule ID ${s.id}:`);
    console.log(`  Source: ${srcUser?.name} (ID: ${srcId})`);
    console.log(`  Source Active: ${srcActive}`);
    console.log(`  Receiver Active: ${rcvActive}`);
    console.log(`  Monthly Amount: ₹${s.monthly_amount}`);
    console.log(`  Will Process: ${srcActive && rcvActive ? '✅ YES' : '❌ NO'}`);
    console.log();
  }

  console.log('🔍 Checking ledger entries for MONTHLY:');
  const ledger = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: 1n,
      commission_type: 'MONTHLY'
    },
    include: {
      users_ledger_entries_source_user_idTousers: {
        select: { name: true }
      }
    }
  });

  console.log(`Total MONTHLY ledger entries: ${ledger.length}`);
  
  const grouped = ledger.reduce((acc: any, entry) => {
    const sourceName = entry.users_ledger_entries_source_user_idTousers.name;
    if (!acc[sourceName]) acc[sourceName] = { count: 0, total: 0 };
    acc[sourceName].count++;
    acc[sourceName].total += Number(entry.amount);
    return acc;
  }, {});

  console.log('\nBy Source:');
  for (const [name, data] of Object.entries(grouped as any)) {
    console.log(`  ${name}: ${data.count} entries, ₹${data.total.toFixed(2)} total`);
  }
}

debugMonthly()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

