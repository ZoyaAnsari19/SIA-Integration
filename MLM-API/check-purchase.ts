import { prisma } from './src/config/prisma.js';

async function check() {
  // Check purchase 1774
  const purchase = await prisma.purchases.findUnique({
    where: { id: BigInt(1774) },
    select: {
      id: true,
      package_id: true,
      previous_package_id: true,
      previous_purchase_id: true,
      is_renewal: true,
      purchased_at: true,
    }
  });
  
  console.log('📦 Purchase 1774:');
  console.log('  ID:', purchase?.id.toString());
  console.log('  Package ID:', purchase?.package_id);
  console.log('  Previous Package ID:', purchase?.previous_package_id);
  console.log('  Previous Purchase ID:', purchase?.previous_purchase_id?.toString() || 'NULL');
  console.log('  Is Renewal:', purchase?.is_renewal);
  
  // Check request 253
  const request = await prisma.purchase_requests.findUnique({
    where: { id: BigInt(253) },
    select: {
      id: true,
      previous_package_id: true,
      previous_purchase_id: true,
      status: true,
    }
  });
  
  console.log('\n📋 Request 253:');
  console.log('  Previous Package ID:', request?.previous_package_id);
  console.log('  Previous Purchase ID:', request?.previous_purchase_id?.toString() || 'NULL');
  console.log('  Status:', request?.status);
  
  await prisma.$disconnect();
}

check().catch(console.error);
