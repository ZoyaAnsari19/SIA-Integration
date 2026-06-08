import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA02079';
  
  console.log(`\n=== Checking User: ${displayId} ===\n`);
  
  // Find user
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, name: true, display_id: true },
  });
  
  if (!user) {
    console.log(`❌ User ${displayId} not found`);
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User found: ID=${user.id}, Name=${user.name}, Display=${user.display_id}\n`);
  
  // Check purchases
  const purchases = await prisma.purchases.findMany({
    where: { user_id: user.id },
    orderBy: { purchased_at: 'desc' },
  });
  
  // Get package names
  const packageIds = [...new Set(purchases.map(p => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p.name]));
  
  console.log(`📦 Total Purchases: ${purchases.length}\n`);
  purchases.forEach((p, i) => {
    console.log(`Purchase ${i + 1}:`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Package: ${packageMap.get(p.package_id) || 'N/A'} (ID: ${p.package_id})`);
    console.log(`  Amount: ₹${p.amount}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Purchased At: ${p.purchased_at}`);
    console.log(`  Is Renewal: ${p.is_renewal || false}`);
    console.log('');
  });
  
  // Check spot commissions where SIA02079 is SOURCE (who made purchase)
  const spotCommissions = await prisma.ledger_entries.findMany({
    where: {
      source_user_id: user.id,
      commission_type: 'SPOT',
    },
    orderBy: { credited_at: 'desc' },
  });
  
  // Get receiver user details
  const receiverIds = [...new Set(spotCommissions.map(e => e.receiver_user_id))];
  const receivers = await prisma.users.findMany({
    where: { id: { in: receiverIds } },
    select: { id: true, display_id: true, name: true },
  });
  const receiverMap = new Map(receivers.map(r => [r.id.toString(), r]));
  
  console.log(`💰 Total SPOT Commissions (SIA02079 as SOURCE): ${spotCommissions.length}\n`);
  
  // Group by amount and receiver
  const amountGroups = new Map<string, any[]>();
  spotCommissions.forEach(entry => {
    const key = `${entry.amount}_${entry.receiver_user_id}`;
    if (!amountGroups.has(key)) {
      amountGroups.set(key, []);
    }
    amountGroups.get(key)!.push(entry);
  });
  
  console.log('📊 SPOT Commissions Grouped by Amount and Receiver:');
  amountGroups.forEach((entries, key) => {
    const [amount, receiverId] = key.split('_');
    const receiver = receiverMap.get(receiverId.toString());
    console.log(`\n  Amount: ₹${amount}, Receiver: ${receiver?.display_id || receiverId} (${entries.length} entries)`);
    entries.slice(0, 5).forEach((e, i) => {
      console.log(`    Entry ${i + 1}: Purchase ID=${e.purchase_id}, Credited=${e.credited_at.toISOString().split('T')[0]}`);
    });
    if (entries.length > 5) {
      console.log(`    ... and ${entries.length - 5} more entries`);
    }
  });
  
  // Check pending commissions
  const pendingCommissions = await prisma.pending_commissions.findMany({
    where: {
      source_user_id: user.id,
      commission_type: 'SPOT',
    },
    orderBy: { created_at: 'desc' },
  });
  
  // Get receiver user details for pending
  const pendingReceiverIds = [...new Set(pendingCommissions.map(e => e.receiver_user_id))];
  const pendingReceivers = await prisma.users.findMany({
    where: { id: { in: pendingReceiverIds } },
    select: { id: true, display_id: true, name: true },
  });
  const pendingReceiverMap = new Map(pendingReceivers.map(r => [r.id.toString(), r]));
  
  console.log(`\n⏳ Total PENDING SPOT Commissions (SIA02079 as SOURCE): ${pendingCommissions.length}\n`);
  
  if (pendingCommissions.length > 0) {
    const pendingAmountGroups = new Map<string, any[]>();
    pendingCommissions.forEach(entry => {
      const key = `${entry.amount}_${entry.receiver_user_id}`;
      if (!pendingAmountGroups.has(key)) {
        pendingAmountGroups.set(key, []);
      }
      pendingAmountGroups.get(key)!.push(entry);
    });
    
    console.log('📊 PENDING SPOT Commissions Grouped by Amount and Receiver:');
    pendingAmountGroups.forEach((entries, key) => {
      const [amount, receiverId] = key.split('_');
      const receiver = pendingReceiverMap.get(receiverId.toString());
      console.log(`\n  Amount: ₹${amount}, Receiver: ${receiver?.display_id || receiverId} (${entries.length} entries)`);
      entries.slice(0, 5).forEach((e, i) => {
        console.log(`    Entry ${i + 1}: Purchase ID=${e.purchase_id}, Level=${e.level}, Created=${e.created_at.toISOString().split('T')[0]}`);
      });
      if (entries.length > 5) {
        console.log(`    ... and ${entries.length - 5} more entries`);
      }
    });
  }
  
  // Summary
  console.log('\n📈 SUMMARY:');
  console.log(`  Total Purchases: ${purchases.length}`);
  console.log(`  Total Credited SPOT Entries: ${spotCommissions.length}`);
  console.log(`  Total Pending SPOT Entries: ${pendingCommissions.length}`);
  console.log(`  Total SPOT Amount (Credited): ₹${spotCommissions.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)}`);
  console.log(`  Total SPOT Amount (Pending): ₹${pendingCommissions.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);

