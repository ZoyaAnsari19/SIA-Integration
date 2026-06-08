import { prisma } from '../src/config/prisma.js';

async function main() {
  console.log('🔍 Checking reversal status on production...\n');

  // Check how many reversal entries exist
  const reversalEntries = await prisma.ledger_entries.findMany({
    where: {
      idempotency_key: { startsWith: 'reversal:expired:' },
    },
    select: { id: true, idempotency_key: true, amount: true },
  });

  console.log(`📊 Reversal Entries Found: ${reversalEntries.length}`);
  console.log(`   Total Reversal Amount: ₹${reversalEntries.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0).toFixed(2)}\n`);

  // Check expired purchases
  const expiredPurchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
    },
    select: {
      id: true,
      amount: true,
      income: true,
    } as any,
  });

  const expired = expiredPurchases.filter(p => {
    const amount = Number(p.amount);
    const income = Number((p as any).income || 0);
    return income >= amount * 2;
  });

  console.log(`📊 Expired Purchases: ${expired.length}\n`);

  // Sample check: Find entries for one expired purchase
  if (expired.length > 0) {
    const samplePurchase = expired[0];
    const purchaseId = samplePurchase.id as unknown as bigint;
    
    console.log(`🔍 Sample Check - Purchase ${purchaseId}:`);
    console.log(`   Amount: ₹${Number(samplePurchase.amount).toFixed(2)}`);
    console.log(`   Income: ₹${Number((samplePurchase as any).income || 0).toFixed(2)}\n`);

    // Find all entries for this purchase
    const allEntries = await prisma.ledger_entries.findMany({
      where: { purchase_id: purchaseId },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
        idempotency_key: true,
      },
      orderBy: { credited_at: 'asc' },
      take: 10,
    });

    console.log(`   Recent Entries (first 10):`);
    for (const entry of allEntries) {
      const isReversal = entry.idempotency_key?.startsWith('reversal:expired:');
      console.log(`     - ${entry.commission_type}: ₹${Number(entry.amount).toFixed(2)} ${isReversal ? '(REVERSAL)' : ''} at ${entry.credited_at.toISOString().split('T')[0]}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
