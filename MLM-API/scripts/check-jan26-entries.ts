#!/usr/bin/env tsx
/**
 * Check Jan 26 entries specifically for SIA00514
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission',
    },
  },
});

const USER_DISPLAY_ID = 'SIA00514';
const AFFECTED_PURCHASE_IDS = [1779, 1778, 1777];

async function main() {
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: { id: true },
  });

  if (!user) {
    console.log('User not found');
    await prisma.$disconnect();
    return;
  }

  console.log('Checking Jan 26 entries...\n');

  for (const purchaseId of AFFECTED_PURCHASE_IDS) {
    const entries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: BigInt(purchaseId),
        commission_type: 'GLOBAL_HELPING',
        credited_at: {
          gte: new Date('2026-01-26T00:00:00'),
          lt: new Date('2026-01-27T00:00:00'),
        },
      },
      orderBy: { credited_at: 'asc' },
    });

    console.log(`\nPurchase ${purchaseId} - Jan 26 GLOBAL_HELPING entries (${entries.length}):`);
    for (const entry of entries) {
      const metadata = entry.metadata as any;
      console.log(`  Entry ${entry.id}: ₹${Number(entry.amount).toFixed(2)}`);
      console.log(`    Used IDs: ${metadata?.used_ids || 'N/A'}`);
      console.log(`    IDK: ${entry.idempotency_key}`);
      console.log(`    Credited At: ${entry.credited_at}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
