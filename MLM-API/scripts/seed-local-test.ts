import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding local test data...\n');

  // Check if Siddhant exists
  let siddhant = await prisma.users.findFirst({
    where: { email: 'siddhant@truelink.ai' }
  });

  if (!siddhant) {
    // Try to find by ID
    siddhant = await prisma.users.findUnique({
      where: { id: BigInt(3) }
    });

    if (!siddhant) {
      // Create root user first if doesn't exist
      let root = await prisma.users.findFirst({
        where: { id: BigInt(2) }
      });

      if (!root) {
        try {
          root = await prisma.users.create({
            data: {
              id: BigInt(2),
              display_id: 'SIA00002',
              name: 'System Root',
              email: 'root@sia.com',
              phone: '9999999998',
              password_hash: await bcrypt.hash('root@secure123', 10),
              role: 'ADMIN',
              referrer_user_id: BigInt(1),
              status: 'active'
            }
          });
          console.log('✅ Created root user');
        } catch (e: any) {
          if (e.code !== 'P2002') throw e;
          root = await prisma.users.findUnique({ where: { id: BigInt(2) } });
        }
      }

      // Create Siddhant
      try {
        siddhant = await prisma.users.create({
          data: {
            id: BigInt(3),
            display_id: 'SIA02000',
            name: 'Siddhant Gour',
            email: 'siddhant@truelink.ai',
            phone: '9893680353',
            password_hash: await bcrypt.hash('sid@9893680353', 10),
            role: 'STUDENT',
            referrer_user_id: BigInt(2),
            status: 'active',
            kyc_status: 'approved',
            kyc_verified_at: new Date()
          }
        });
        console.log('✅ Created Siddhant user');
      } catch (e: any) {
        if (e.code !== 'P2002') throw e;
        siddhant = await prisma.users.findUnique({ where: { id: BigInt(3) } });
        console.log('✅ Siddhant user already exists');
      }
    } else {
      console.log('✅ Siddhant user found by ID');
    }
  } else {
    console.log('✅ Siddhant user found by email');
  }

  // Get or create course
  let course = await prisma.courses.findFirst({
    where: { slug: 'share-market-learning' }
  });

  if (!course) {
    course = await prisma.courses.create({
      data: {
        slug: 'share-market-learning',
        title: 'Share Market Learning',
        short_description: "Secure Infinite Association's expert-level programme",
        price: 50000,
        language: 'HINDI',
        level: 'EXPERT',
        category: 'Investment',
        package_id: 5,
        total_lessons: 6,
        total_duration: 18000,
        is_published: true
      }
    });
    console.log('✅ Created course');
  }

  // Check if purchase exists
  let purchase = await prisma.purchases.findFirst({
    where: {
      user_id: siddhant.id,
      course_id: course.id,
      purchase_type: 'COURSE_PURCHASE'
    }
  });

  if (!purchase) {
    try {
      purchase = await prisma.purchases.create({
        data: {
          user_id: siddhant.id,
          package_id: 5,
          course_id: course.id,
          purchase_type: 'COURSE_PURCHASE',
          amount: 50000,
          purchased_at: new Date(),
          active_until: new Date(Date.now() + 11 * 30 * 24 * 60 * 60 * 1000), // 11 months
          status: 'completed',
          txn_id: 'TXN_TEST_001',
          payment_type: 'bank_transfer',
          is_manual: true,
          effective_global_ids: 1100
        }
      });
      console.log('✅ Created purchase');
    } catch (e: any) {
      if (e.code === 'P2002') {
        purchase = await prisma.purchases.findFirst({
          where: {
            user_id: siddhant.id,
            course_id: course.id
          }
        });
        console.log('✅ Purchase already exists');
      } else {
        throw e;
      }
    }
  } else {
    console.log('✅ Purchase already exists');
  }

  // Create user balance
  await prisma.user_balances.upsert({
    where: { user_id: siddhant.id },
    update: { balance: 2225 },
    create: { user_id: siddhant.id, balance: 2225 }
  });
  console.log('✅ Created user balance');

  console.log('\n✅ Test data seeded!');
  console.log(`\nTest credentials:`);
  console.log(`  Email: siddhant@truelink.ai`);
  console.log(`  Password: sid@9893680353`);
  console.log(`  Course: ${course.slug}`);
  console.log(`  Purchase Course ID: ${course.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

