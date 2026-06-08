import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function checkAdminPassword() {
  try {
    console.log('\n=== Checking Admin Users in Database ===\n');

    // Find all admin users
    const adminUsers = await prisma.users.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        password_hash: true,
        status: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found in database\n');
      return;
    }

    console.log(`✅ Found ${adminUsers.length} admin user(s):\n`);

    for (const admin of adminUsers) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Admin ID: ${admin.id}`);
      console.log(`Name: ${admin.name || 'N/A'}`);
      console.log(`Email: ${admin.email || 'N/A'}`);
      console.log(`Status: ${admin.status}`);
      console.log(`Created At: ${admin.created_at}`);
      
      if (admin.password_hash) {
        console.log(`Password Hash: ${admin.password_hash.substring(0, 20)}...`);
        console.log(`Password Set: ✅ Yes`);
        
        // Test common passwords
        const commonPasswords = [
          'Admin@1234',
          'admin123',
          'nashik2nagpur',
          'Root@1234',
          'root@1234',
          'Root1234',
          'root1234',
          'Test@123',
          'Test@1234',
          'password',
          'admin',
          'root',
          'Root',
          'Admin',
        ];
        
        console.log('\nTesting common passwords:');
        let found = false;
        for (const testPassword of commonPasswords) {
          const isValid = await bcrypt.compare(testPassword, admin.password_hash);
          if (isValid) {
            console.log(`  ✅ Password matches: ${testPassword}`);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log(`  ❌ Password does not match any common passwords`);
        }
      } else {
        console.log(`Password Set: ❌ No password set`);
      }
      
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Error checking admin password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminPassword();

