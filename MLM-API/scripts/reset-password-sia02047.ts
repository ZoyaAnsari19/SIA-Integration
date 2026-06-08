import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPasswordForSIA02047() {
  try {
    const displayId = 'SIA02047';
    const newPassword = 'Test@1234';

    console.log(`\n=== Resetting password for user ${displayId} ===\n`);

    // Find user by display_id
    const user = await prisma.users.findUnique({
      where: { display_id: displayId },
      select: {
        id: true,
        display_id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!user) {
      console.error(`❌ User with display_id ${displayId} not found`);
      process.exit(1);
    }

    console.log(`✅ Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Display ID: ${user.display_id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Phone: ${user.phone || 'N/A'}`);

    if (!user.phone) {
      console.error(`❌ User does not have a phone number. Cannot use reset password API.`);
      console.log(`\n⚠️  Note: Reset password API requires mobile number.`);
      console.log(`   However, we can directly update the password hash (same as what API does).\n`);
    }

    // Hash the new password (same as reset password API does)
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password in database (same as reset password API does)
    await prisma.users.update({
      where: { id: user.id },
      data: { password_hash: passwordHash },
    });

    console.log(`\n✅ Password successfully reset to: ${newPassword}`);
    console.log(`   Password hash updated in database`);
    console.log(`\n✅ User ${displayId} can now login with the new password.\n`);

  } catch (error: any) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswordForSIA02047();

