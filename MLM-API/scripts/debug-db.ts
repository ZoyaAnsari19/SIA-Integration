#!/usr/bin/env tsx
import { prisma } from '../src/config/prisma.js';

async function main() {
  console.log('\n🔍 PURCHASES:');
  const purchases = await prisma.purchases.findMany({ 
    select: { id: true, user_id: true, package_id: true, status: true, amount: true } 
  });
  purchases.forEach(p => {
    console.log(`  • ID=${p.id}, User=${p.user_id}, Package=${p.package_id}, Status=${p.status}, Amount=₹${p.amount}`);
  });
  
  console.log('\n🔍 SCHEDULED COMMISSIONS:');
  const schedules = await prisma.scheduled_commissions.findMany({ 
    select: { id: true, receiver_user_id: true, commission_type: true, monthly_amount: true, daily_amount: true } 
  });
  if (schedules.length === 0) {
    console.log('  ❌ NO SCHEDULES FOUND!');
  } else {
    schedules.forEach(s => {
      console.log(`  • ID=${s.id}, User=${s.receiver_user_id}, Type=${s.commission_type}, Monthly=₹${s.monthly_amount}, Daily=₹${s.daily_amount}`);
    });
  }
  
  console.log('\n🔍 LEDGER ENTRIES:');
  const ledger = await prisma.ledger_entries.findMany({ 
    select: { receiver_user_id: true, amount: true, type: true } 
  });
  if (ledger.length === 0) {
    console.log('  ❌ NO LEDGER ENTRIES!');
  } else {
    ledger.forEach(l => {
      console.log(`  • User=${l.receiver_user_id}, Type=${l.type}, Amount=₹${l.amount}`);
    });
  }
  
  console.log('\n🔍 WALLET BALANCES:');
  const wallets = await prisma.user_balances.findMany({ 
    select: { user_id: true, balance: true } 
  });
  if (wallets.length === 0) {
    console.log('  ❌ NO WALLET BALANCES!');
  } else {
    wallets.forEach(w => {
      console.log(`  • User=${w.user_id}, Balance=₹${w.balance}`);
    });
  }
  
  await prisma.$disconnect();
}

main();

