import { prisma } from './src/config/prisma.js';

async function test() {
  const requestId = BigInt(253);
  
  // Check request
  const request = await prisma.purchase_requests.findUnique({
    where: { id: requestId }
  });
  
  console.log('📋 Request Details:');
  console.log('  ID:', request?.id.toString());
  console.log('  Status:', request?.status);
  console.log('  Package ID:', request?.package_id);
  console.log('  Previous Package ID:', request?.previous_package_id);
  console.log('  Previous Purchase ID:', request?.previous_purchase_id?.toString() || 'NULL');
  console.log('  Request Type:', request?.request_type);
  
  if (request && request.previous_purchase_id) {
    console.log('\n✅ Request has previous_purchase_id:', request.previous_purchase_id.toString());
  } else {
    console.log('\n❌ Request does NOT have previous_purchase_id');
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
