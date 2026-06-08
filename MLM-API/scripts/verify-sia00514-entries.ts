#!/usr/bin/env tsx
/**
 * Verify SIA00514's actual ledger entries to see what needs to be fixed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log('Checking actual ledger entries...\n');

  for (const purchaseId of AFFECTED_PURCHASE_IDS) {
    const entries = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: BigInt(purchaseId),
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
      orderBy: { credited_at: 'asc' },
    });

    console.log(`\nPurchase ${purchaseId} - ${entries.length} entries:`);
    for (const entry of entries) {
      const metadata = entry.metadata as any;
      console.log(`  ${entry.credited_at.toISOString().split('T')[0]} ${entry.commission_type}: ₹${Number(entry.amount).toFixed(2)} (Used IDs: ${metadata?.used_ids || 'N/A'})`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
