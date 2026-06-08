import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProfile() {
  try {
    // Get the most recent user profiles
    const profiles = await prisma.user_profiles.findMany({
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        user_id: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        bank_account_no: true,
        bank_ifsc: true,
        bank_name: true,
        updated_at: true,
      },
    });

    console.log('\n=== Recent User Profiles ===\n');
    profiles.forEach((profile) => {
      console.log(`User ID: ${profile.user_id}`);
      console.log(`Phone: ${profile.phone || 'NULL'}`);
      console.log(`Address: ${profile.address || 'NULL'}`);
      console.log(`City: ${profile.city || 'NULL'}`);
      console.log(`State: ${profile.state || 'NULL'}`);
      console.log(`Pincode: ${profile.pincode || 'NULL'}`);
      console.log(`Bank Account: ${profile.bank_account_no || 'NULL'}`);
      console.log(`Bank IFSC: ${profile.bank_ifsc || 'NULL'}`);
      console.log(`Bank Name: ${profile.bank_name || 'NULL'}`);
      console.log(`Updated At: ${profile.updated_at}`);
      console.log('---\n');
    });

    // Also check users table for phone, email
    const users = await prisma.users.findMany({
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        updated_at: true,
      },
    });

    console.log('\n=== Recent Users (from users table) ===\n');
    users.forEach((user) => {
      console.log(`User ID: ${user.id}`);
      console.log(`Name: ${user.name || 'NULL'}`);
      console.log(`Email: ${user.email || 'NULL'}`);
      console.log(`Phone: ${user.phone || 'NULL'}`);
      console.log(`Updated At: ${user.updated_at}`);
      console.log('---\n');
    });
  } catch (error) {
    console.error('Error checking profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfile();

