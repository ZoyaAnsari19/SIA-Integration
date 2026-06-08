import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLevels() {
  console.log('🌱 Seeding levels data with Spot Commission and Monthly Royalty percentages...');

  const levels = [
    {
      level: 0,
      title: 'Field Worker',
      description: 'Direct level - Starting position',
      reward: null,
      spot_commission_percent: 5.0,
      monthly_royalty_percent: 0.75, // 0.50%-1% average
      business_requirement: null,
    },
    {
      level: 1,
      title: 'Company Representative',
      description: '4 direct compulsory, har direct ke niche min ₹7,500, total team business ₹2.15 Lakh',
      reward: 'T-shirt and Diary',
      spot_commission_percent: 2.5,
      monthly_royalty_percent: 0.30,
      business_requirement: {
        required_leg_count: 4,
        required_leg_min_amount: 7500,
        total_business: 215000
      },
    },
    {
      level: 2,
      title: 'Company City Manager',
      description: 'Har 4 direct member ke niche se ₹3.75 Lakh ka business (total ₹15 Lakh)',
      reward: '5G Mobile',
      spot_commission_percent: 2.50,
      monthly_royalty_percent: 0.30,
      business_requirement: {
        required_leg_count: 4,
        required_leg_min_amount: 375000,
        total_business: 1500000
      },
    },
    {
      level: 3,
      title: 'Company Area Manager',
      description: 'Har 3 direct member ke niche se ₹25 Lakh ka business (total ₹75 Lakh)',
      reward: 'Laptop',
      spot_commission_percent: 2.0,
      monthly_royalty_percent: 0.25,
      business_requirement: {
        required_leg_count: 3,
        required_leg_min_amount: 2500000,
        total_business: 7500000
      },
    },
    {
      level: 4,
      title: 'Company District Manager',
      description: 'Har 3 direct member ke niche se ₹77.62 Lakh ka business (total ₹2.32 Crore)',
      reward: 'Motorcycle',
      spot_commission_percent: 2.0,
      monthly_royalty_percent: 0.25,
      business_requirement: {
        required_leg_count: 3,
        required_leg_min_amount: 7762000,
        total_business: 23286000
      },
    },
    {
      level: 5,
      title: 'Division Manager',
      description: 'Har 3 direct member ke niche se ₹2.53 Crore ka business (total ₹7.61 Crore)',
      reward: 'Car',
      spot_commission_percent: 1.50,
      monthly_royalty_percent: 0.20,
      business_requirement: {
        required_leg_count: 3,
        required_leg_min_amount: 25300000,
        total_business: 76100000
      },
    },
    {
      level: 6,
      title: 'Regional Manager',
      description: 'Har 2 direct member ke niche se ₹13.32 Crore ka business (total ₹26.65 Crore)',
      reward: 'Land in Secure City',
      spot_commission_percent: 1.50,
      monthly_royalty_percent: 0.20,
      business_requirement: {
        required_leg_count: 2,
        required_leg_min_amount: 133200000,
        total_business: 266500000
      },
    },
    {
      level: 7,
      title: 'State Manager',
      description: 'Har 2 direct member ke niche se ₹51.97 Crore ka business (total ₹103.93 Crore)',
      reward: 'Flat in Secure City',
      spot_commission_percent: 1.0,
      monthly_royalty_percent: 0.15,
      business_requirement: {
        required_leg_count: 2,
        required_leg_min_amount: 519700000,
        total_business: 1039300000
      },
    },
    {
      level: 8,
      title: 'National Manager',
      description: 'Har 2 direct member ke niche se ₹223.48 Crore ka business (total ₹446.96 Crore)',
      reward: 'Company Director',
      spot_commission_percent: 1.0,
      monthly_royalty_percent: 0.15,
      business_requirement: {
        required_leg_count: 2,
        required_leg_min_amount: 2234800000,
        total_business: 4469600000
      },
    },
    {
      level: 9,
      title: 'King',
      description: 'Total ₹2100 Crore ka business',
      reward: 'Freedom',
      spot_commission_percent: 0.50,
      monthly_royalty_percent: 0.10,
      business_requirement: {
        required_leg_count: 0,
        required_leg_min_amount: 0,
        total_business: 21000000000
      },
    },
  ];

  for (const levelData of levels) {
    await prisma.levels.upsert({
      where: { level: levelData.level },
      update: {
        title: levelData.title,
        description: levelData.description,
        reward: levelData.reward,
        spot_commission_percent: levelData.spot_commission_percent,
        monthly_royalty_percent: levelData.monthly_royalty_percent,
        business_requirement: levelData.business_requirement,
        updated_at: new Date(),
      },
      create: levelData,
    });
    console.log(`✅ Level ${levelData.level}: ${levelData.title} - Spot: ${levelData.spot_commission_percent}%, Monthly: ${levelData.monthly_royalty_percent}%`);
  }

  console.log('✅ Levels seeded successfully with percentages only!');
}

seedLevels()
  .catch((e) => {
    console.error('❌ Error seeding levels:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
