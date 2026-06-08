import { prisma } from '../src/config/prisma.js';

async function setTransactionPin() {
  try {
    const displayId = 'SIA00299';
    const newPin = '123456';

    console.log(`\n🔧 Setting transaction PIN for ${displayId} to ${newPin}...\n`);

    // Find user by display_id
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: { id: true, display_id: true, name: true, transaction_pin: true },
    });

    if (!user) {
      console.error(`❌ User with display_id ${displayId} not found`);
      process.exit(1);
    }

    console.log('📋 Current user details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Display ID: ${user.display_id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Current Transaction PIN: ${user.transaction_pin || 'NOT SET'}`);
    console.log('');

    // Update transaction PIN
    const updated = await prisma.users.update({
      where: { id: user.id },
      data: {
        transaction_pin: newPin,
      },
      select: { id: true, display_id: true, transaction_pin: true },
    });

    console.log('✅ Transaction PIN updated successfully!');
    console.log(`   New Transaction PIN: ${updated.transaction_pin}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Error setting transaction PIN:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setTransactionPin();
