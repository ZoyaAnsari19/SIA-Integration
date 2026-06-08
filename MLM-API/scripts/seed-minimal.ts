import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting minimal database seeding...\n');

  try {
    // 1. Create Levels (1-9)
    console.log('📊 Creating levels...');
    const levelsData = [
      { level: 1, title: 'Level 1', description: 'Direct referrals', spot_commission_percent: 5.00, monthly_royalty_percent: 0.50 },
      { level: 2, title: 'Level 2', description: 'Second level team', spot_commission_percent: 4.00, monthly_royalty_percent: 0.40 },
      { level: 3, title: 'Level 3', description: 'Third level team', spot_commission_percent: 3.00, monthly_royalty_percent: 0.30 },
      { level: 4, title: 'Level 4', description: 'Fourth level team', spot_commission_percent: 2.00, monthly_royalty_percent: 0.20 },
      { level: 5, title: 'Level 5', description: 'Fifth level team', spot_commission_percent: 1.50, monthly_royalty_percent: 0.15 },
      { level: 6, title: 'Level 6', description: 'Sixth level team', spot_commission_percent: 1.00, monthly_royalty_percent: 0.10 },
      { level: 7, title: 'Level 7', description: 'Seventh level team', spot_commission_percent: 0.75, monthly_royalty_percent: 0.08 },
      { level: 8, title: 'Level 8', description: 'Eighth level team', spot_commission_percent: 0.50, monthly_royalty_percent: 0.05 },
      { level: 9, title: 'Level 9', description: 'Ninth level team', spot_commission_percent: 0.25, monthly_royalty_percent: 0.02 },
    ];

    for (const levelData of levelsData) {
      await prisma.levels.upsert({
        where: { level: levelData.level },
        update: {},
        create: levelData,
      });
    }
    console.log('✅ Created 9 levels\n');

    // 2. Create Packages
    console.log('📦 Creating packages...');
    
    // Check if packages exist
    const existingPackages = await prisma.packages.findMany();
    if (existingPackages.length === 0) {
      await prisma.packages.createMany({
        data: [
          {
            name: 'Starter Package',
            price: 2500,
            validity_months: 3,
            validity_days: 90,
            global_ids: 10,
            self_monthly: 62.50,
            status: 'active',
          },
          {
            name: 'Premium Package',
            price: 5000,
            validity_months: 3,
            validity_days: 90,
            global_ids: 25,
            self_monthly: 125,
            status: 'active',
          },
          {
            name: 'Pro Package',
            price: 10000,
            validity_months: 3,
            validity_days: 90,
            global_ids: 60,
            self_monthly: 250,
            status: 'active',
          },
        ],
      });
      console.log('✅ Created 3 packages\n');
    } else {
      console.log('✅ Packages already exist\n');
    }

    // 3. Create Withdrawal/Transfer Rules
    console.log('💰 Creating withdrawal & transfer rules...');
    const existingRules = await prisma.withdrawal_transfer_rules.findFirst();
    if (!existingRules) {
      await prisma.withdrawal_transfer_rules.create({
        data: {
          min_withdraw_amt: 100,
          max_withdraw_amt: 50000,
          withdraw_amt_tax: 5,
          min_transfer_amt: 50,
          max_transfer_amt: 10000,
          transfer_amt_tax: 2.5,
          spot_min_withdraw: 50,
          admin_charges: 0,
          min_withdraw: 100,
        },
      });
      console.log('✅ Created withdrawal/transfer rules\n');
    } else {
      // Update spot_min_withdraw if it doesn't exist
      await prisma.withdrawal_transfer_rules.update({
        where: { id: existingRules.id },
        data: { spot_min_withdraw: 50 },
      });
      console.log('✅ Withdrawal/transfer rules already exist (updated spot_min_withdraw)\n');
    }

    // 4. Create Root/System User (for sponsor)
    console.log('👤 Creating root/system user...');
    const rootPassword = await bcrypt.hash('Root@1234', 10);
    const rootUser = await prisma.users.upsert({
      where: { email: 'root@mlm.com' },
      update: {},
      create: {
        name: 'System Root',
        email: 'root@mlm.com',
        password: rootPassword,
        role: 'admin',
        status: 'active',
        sponsor_code: 'SYSTEM',
        wallet_balance: 0,
      },
    });
    console.log(`✅ Root user created (ID: ${rootUser.id})\n`);

    // Create user profile for root
    await prisma.user_profiles.upsert({
      where: { user_id: rootUser.id },
      update: {},
      create: {
        user_id: rootUser.id,
        phone: '+910000000000',
      },
    });

    // Create tree path for root (self-reference)
    await prisma.user_tree_paths.upsert({
      where: {
        ancestor_id_descendant_id: {
          ancestor_id: rootUser.id,
          descendant_id: rootUser.id,
        },
      },
      update: {},
      create: {
        ancestor_id: rootUser.id,
        descendant_id: rootUser.id,
        depth: 0,
      },
    });

    // 5. Create Admin User
    console.log('👨‍💼 Creating admin user...');
    const adminPassword = await bcrypt.hash('Admin@1234', 10);
    const adminUser = await prisma.users.upsert({
      where: { email: 'admin@mlm.com' },
      update: {},
      create: {
        name: 'Admin User',
        email: 'admin@mlm.com',
        password: adminPassword,
        role: 'admin',
        status: 'active',
        sponsor_code: 'ADMIN001',
        sponsor_id: rootUser.id,
        wallet_balance: 0,
      },
    });
    console.log(`✅ Admin user created (ID: ${adminUser.id})\n`);

    // Create user profile for admin
    await prisma.user_profiles.upsert({
      where: { user_id: adminUser.id },
      update: {},
      create: {
        user_id: adminUser.id,
        phone: '+919999999999',
      },
    });

    // Create KYC for admin (approved)
    await prisma.kyc_documents.upsert({
      where: { user_id: adminUser.id },
      update: { kyc_status: 'approved' },
      create: {
        user_id: adminUser.id,
        kyc_status: 'approved',
        pan_number: 'ADMIN1234P',
        aadhar_number: '999999999999',
      },
    });

    // Create tree paths for admin
    await prisma.user_tree_paths.upsert({
      where: {
        ancestor_id_descendant_id: {
          ancestor_id: adminUser.id,
          descendant_id: adminUser.id,
        },
      },
      update: {},
      create: {
        ancestor_id: adminUser.id,
        descendant_id: adminUser.id,
        depth: 0,
      },
    });

    await prisma.user_tree_paths.upsert({
      where: {
        ancestor_id_descendant_id: {
          ancestor_id: rootUser.id,
          descendant_id: adminUser.id,
        },
      },
      update: {},
      create: {
        ancestor_id: rootUser.id,
        descendant_id: adminUser.id,
        depth: 1,
      },
    });

    console.log('\n✅ Minimal database seeding completed!');
    console.log('\n📋 Summary:');
    console.log('  ✅ Levels: 9');
    console.log('  ✅ Packages: 3');
    console.log('  ✅ Withdrawal Rules: 1');
    console.log('  ✅ Root User: root@mlm.com (password: Root@1234)');
    console.log('  ✅ Admin User: admin@mlm.com (password: Admin@1234)');
    console.log('\n🎉 Database is ready for testing!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

