import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function main() {
  const purchaseId = BigInt(47);
  
  console.log('=== Checking Purchase 47 ===\n');
  
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
  });
  
  if (!purchase) {
    console.log('Purchase not found');
    await prisma.$disconnect();
    return;
  }
  
  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id },
  });
  
  if (!purchase) {
    console.log('Purchase not found');
    await prisma.$disconnect();
    return;
  }
  
  if (!pkg) {
    console.log('Package not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Purchase Details:');
  console.log(`  ID: ${purchase.id}`);
  console.log(`  User ID: ${purchase.user_id}`);
  console.log(`  Amount: ₹${purchase.amount}`);
  console.log(`  Status: ${purchase.status}`);
  console.log(`  Purchased At: ${purchase.purchased_at}`);
  console.log(`  Package: ${pkg.name || 'N/A'}`);
  console.log(`  Self ROI: ${pkg.self_roi_percent || 'N/A'}%`);
  console.log(`  Global IDs: ${pkg.global_ids || 'N/A'}`);
  
  // Check existing scheduled commissions
  const existingScheduled = await prisma.scheduled_commissions.findMany({
    where: { 
      receiver_user_id: purchase.user_id,
      purchase_id: purchaseId,
    },
  });
  
  console.log(`\nExisting Scheduled Commissions: ${existingScheduled.length}`);
  if (existingScheduled.length === 0) {
    console.log('\n=== Calling handlePurchase to schedule commissions ===\n');
    
    try {
      const result = await CommissionService.handlePurchase(purchaseId);
      console.log('Result:', result);
      
      // Check scheduled commissions after
      const scheduled = await prisma.scheduled_commissions.findMany({
        where: { 
          receiver_user_id: purchase.user_id,
          purchase_id: purchaseId,
        },
        orderBy: { start_date: 'desc' },
      });
      
      console.log(`\nScheduled Commissions After: ${scheduled.length}`);
      scheduled.forEach(s => {
        console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}`);
      });
    } catch (error: any) {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
  } else {
    console.log('Scheduled commissions already exist:');
    existingScheduled.forEach(s => {
      console.log(`  Type: ${s.commission_type}, Monthly: ₹${s.monthly_amount}, Start: ${s.start_date}, End: ${s.end_date}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

