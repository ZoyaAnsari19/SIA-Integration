import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = BigInt(3);
  const courseId = 'f8dbc3d0-eeed-40aa-872a-9b31cbfea642';
  
  console.log('Testing enrollment query...');
  console.log(`UserId: ${userId}`);
  console.log(`CourseId: ${courseId}`);
  console.log(`CourseId type: ${typeof courseId}`);
  
  // Test 1: Direct Prisma query
  console.log('\n1. Direct Prisma query:');
  const purchase1 = await prisma.purchases.findFirst({
    where: {
      user_id: userId,
      course_id: courseId,
      purchase_type: 'COURSE_PURCHASE',
      status: 'completed',
    },
  });
  console.log(`Result: ${purchase1 ? 'FOUND' : 'NOT FOUND'}`);
  if (purchase1) {
    console.log(`Purchase ID: ${purchase1.id}, Course ID: ${purchase1.course_id}`);
  }
  
  // Test 2: Check all purchases for this user
  console.log('\n2. All purchases for user 3:');
  const allPurchases = await prisma.purchases.findMany({
    where: { user_id: userId }
  });
  console.log(`Total purchases: ${allPurchases.length}`);
  allPurchases.forEach(p => {
    console.log(`  - ID: ${p.id}, CourseID: ${p.course_id}, Type: ${p.purchase_type}, Status: ${p.status}`);
  });
  
  // Test 3: Check course
  console.log('\n3. Course check:');
  const course = await prisma.courses.findFirst({
    where: { slug: 'share-market-learning' }
  });
  if (course) {
    console.log(`Course ID: ${course.id}, Type: ${typeof course.id}`);
    console.log(`Match with purchase course_id: ${allPurchases[0]?.course_id === course.id}`);
  }
  
  // Test 4: Raw query
  console.log('\n4. Raw SQL query:');
  const rawResult = await prisma.$queryRaw<Array<{id: bigint}>>`
    SELECT id FROM purchases 
    WHERE user_id = ${userId}::bigint
      AND course_id = ${courseId}
      AND purchase_type = 'COURSE_PURCHASE'
      AND status = 'completed'
    LIMIT 1
  `;
  console.log(`Raw query result: ${rawResult.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

