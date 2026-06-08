import { prisma } from '../src/config/prisma.js';

async function checkTransactionPin() {
  try {
    const displayId = 'SIA00299';

    console.log(`\n🔍 Checking transaction PIN for ${displayId}...\n`);

    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: { 
        id: true, 
        display_id: true, 
        name: true, 
        transaction_pin: true,
        password_plain: true,
      },
    });

    if (!user) {
      console.error(`❌ User with display_id ${displayId} not found`);
      process.exit(1);
    }

    console.log('📋 User details from database:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Display ID: ${user.display_id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Password (plain): ${user.password_plain || 'NOT SET'}`);
    console.log(`   Transaction PIN: ${user.transaction_pin || 'NOT SET'}`);
    console.log(`   Transaction PIN Type: ${typeof user.transaction_pin}`);
    console.log(`   Transaction PIN Length: ${user.transaction_pin?.length || 0}`);
    console.log(`   Transaction PIN Value (raw):`, JSON.stringify(user.transaction_pin));
    console.log('');

  } catch (error: any) {
    console.error('❌ Error checking transaction PIN:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactionPin();
