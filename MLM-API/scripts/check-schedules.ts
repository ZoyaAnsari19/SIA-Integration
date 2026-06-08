#!/usr/bin/env tsx
import { prisma } from '../src/config/prisma.js';

async function main() {
  const userId = process.argv[2] ? BigInt(process.argv[2]) : undefined;
  
  const schedules = await prisma.scheduled_commissions.findMany({
    where: userId ? { receiver_user_id: userId } : {},
    select: {
      commission_type: true,
      monthly_amount: true,
      daily_amount: true,
      start_date: true,
      end_date: true
    }
  });
  
  console.log('Scheduled Commissions:');
  schedules.forEach(s => {
    console.log(`  • ${s.commission_type}: Monthly=₹${s.monthly_amount}, Daily=₹${s.daily_amount}`);
    console.log(`    Start: ${s.start_date.toISOString().slice(0,10)}, End: ${s.end_date.toISOString().slice(0,10)}`);
  });
  
  await prisma.$disconnect();
}

main();

