import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking local database...\n');
  
  const userCount = await prisma.users.count();
  const courseCount = await prisma.courses.count();
  const purchaseCount = await prisma.purchases.count();
  
  console.log(`Users: ${userCount}`);
  console.log(`Courses: ${courseCount}`);
  console.log(`Purchases: ${purchaseCount}`);
  
  if (userCount === 0) {
    console.log('\n⚠️  Database is empty. Need to seed data.');
    process.exit(1);
  }
  
  // Check Siddhant's purchase - try by ID first, then email
  let siddhant = await prisma.users.findUnique({
    where: { id: BigInt(3) }
  });
  
  if (!siddhant) {
    siddhant = await prisma.users.findFirst({
      where: { email: 'siddhant@truelink.ai' }
    });
  }
  
  if (siddhant) {
    console.log(`\n✅ Siddhant found: ID=${siddhant.id}, Email=${siddhant.email}`);
    
    const purchase = await prisma.purchases.findFirst({
      where: {
        user_id: siddhant.id,
        purchase_type: 'COURSE_PURCHASE',
        status: 'completed'
      }
    });
    
    if (purchase) {
      console.log(`✅ Purchase found: ID=${purchase.id}, CourseID=${purchase.course_id}`);
      
      const course = await prisma.courses.findFirst({
        where: { slug: 'share-market-learning' }
      });
      
      if (course) {
        console.log(`✅ Course found: ID=${course.id}, Slug=${course.slug}`);
        console.log(`\n🔍 Testing enrollment check:`);
        console.log(`   Purchase course_id: ${purchase.course_id}`);
        console.log(`   Course id: ${course.id}`);
        console.log(`   Match: ${purchase.course_id === course.id}`);
        console.log(`   Type of purchase.course_id: ${typeof purchase.course_id}`);
        console.log(`   Type of course.id: ${typeof course.id}`);
      } else {
        console.log('❌ Course not found');
      }
    } else {
      console.log('❌ Purchase not found for Siddhant');
    }
  } else {
    console.log('❌ Siddhant user not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

