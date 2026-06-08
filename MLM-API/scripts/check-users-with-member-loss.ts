import { PrismaClient } from '@prisma/client';
import { PackageStatusService } from '../src/modules/purchases/package-status.service.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

interface UserWithMemberLoss {
  user_id: string;
  display_id: string | null;
  name: string | null;
  purchase_id: string;
  package_id: number;
  package_name: string | null;
  package_cap: number;
  used_ids: number;
  global_users_count: number;
  new_ids_after_cap: number;
  cap_exceed_loss: number | null;
  is_same_package_renewal: boolean;
}

async function findUsersWithMemberLoss() {
  console.log('🔍 Checking production database for users with member loss...\n');

  try {
    // Get all active purchases (status = completed and not reached 2x)
    const allPurchases = await prisma.purchases.findMany({
      where: {
        status: 'completed',
      },
      select: {
        id: true,
        user_id: true,
        package_id: true,
        purchased_at: true,
        is_renewal: true,
        previous_package_id: true,
        amount: true,
        income: true,
      },
      orderBy: {
        purchased_at: 'desc',
      },
    });

    console.log(`📦 Total purchases found: ${allPurchases.length}\n`);

    const usersWithLoss: UserWithMemberLoss[] = [];
    let processed = 0;
    let activePurchases = 0;

    for (const purchase of allPurchases) {
      processed++;
      
      // Check if purchase is active (not reached 2x)
      const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
      const isActive = !isDoubleReached;

      if (!isActive) {
        continue;
      }

      activePurchases++;

      try {
        // Calculate global IDs info
        const globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(
          purchase.id as unknown as bigint,
          purchase.user_id as unknown as bigint
        );

        if (globalIdsInfo && globalIdsInfo.new_ids_after_cap !== null && globalIdsInfo.new_ids_after_cap > 0) {
          // Get user details
          const user = await prisma.users.findUnique({
            where: { id: purchase.user_id },
            select: {
              display_id: true,
              name: true,
            },
          });

          // Get package details
          const pkg = await prisma.packages.findUnique({
            where: { id: purchase.package_id },
            select: { name: true },
          });

          // Check if same package renewal
          const isSamePackageRenewal = purchase.is_renewal && 
            (purchase.previous_package_id === null || purchase.previous_package_id === purchase.package_id);

          usersWithLoss.push({
            user_id: purchase.user_id.toString(),
            display_id: user?.display_id || null,
            name: user?.name || null,
            purchase_id: purchase.id.toString(),
            package_id: purchase.package_id,
            package_name: pkg?.name || null,
            package_cap: globalIdsInfo.package_cap,
            used_ids: globalIdsInfo.used_ids,
            global_users_count: globalIdsInfo.total_global_users,
            new_ids_after_cap: globalIdsInfo.new_ids_after_cap,
            cap_exceed_loss: globalIdsInfo.cap_exceed_loss,
            is_same_package_renewal: isSamePackageRenewal,
          });

          console.log(`✅ Found: User ${user?.display_id || purchase.user_id} - ${globalIdsInfo.new_ids_after_cap} members lost`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing purchase ${purchase.id}:`, error.message);
      }

      if (processed % 100 === 0) {
        console.log(`⏳ Processed ${processed}/${allPurchases.length} purchases...`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total purchases: ${allPurchases.length}`);
    console.log(`   Active purchases: ${activePurchases}`);
    console.log(`   Users with member loss: ${usersWithLoss.length}\n`);

    if (usersWithLoss.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👥 USERS WITH MEMBER LOSS COUNT:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Group by user_id to show unique users
      const uniqueUsers = new Map<string, UserWithMemberLoss[]>();
      usersWithLoss.forEach(item => {
        if (!uniqueUsers.has(item.user_id)) {
          uniqueUsers.set(item.user_id, []);
        }
        uniqueUsers.get(item.user_id)!.push(item);
      });

      console.log(`Total Unique Users: ${uniqueUsers.size}\n`);

      // Sort by member loss count (descending)
      const sortedUsers = Array.from(uniqueUsers.entries()).sort((a, b) => {
        const maxLossA = Math.max(...a[1].map(x => x.new_ids_after_cap));
        const maxLossB = Math.max(...b[1].map(x => x.new_ids_after_cap));
        return maxLossB - maxLossA;
      });

      sortedUsers.forEach(([userId, purchases]) => {
        const user = purchases[0];
        const maxLoss = Math.max(...purchases.map(x => x.new_ids_after_cap));
        const totalLoss = purchases.reduce((sum, x) => sum + (x.cap_exceed_loss || 0), 0);

        console.log(`User ID: ${user.display_id || user.user_id} (${user.name || 'N/A'})`);
        console.log(`  Member Loss: ${maxLoss} members`);
        console.log(`  Total Financial Loss: ₹${totalLoss.toFixed(2)}`);
        console.log(`  Packages with loss: ${purchases.length}`);
        purchases.forEach(p => {
          console.log(`    - Package: ${p.package_name || `ID ${p.package_id}`} (Cap: ${p.package_cap}, Used: ${p.used_ids}/${p.global_users_count}, Loss: ${p.new_ids_after_cap} members)`);
        });
        console.log('');
      });

      // List all user IDs
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 USER IDs WITH MEMBER LOSS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      sortedUsers.forEach(([userId, purchases]) => {
        const user = purchases[0];
        const maxLoss = Math.max(...purchases.map(x => x.new_ids_after_cap));
        console.log(`${user.display_id || user.user_id} - ${maxLoss} members lost`);
      });
    } else {
      console.log('✅ No users found with member loss count > 0');
    }

    return usersWithLoss;
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function main() {
  try {
    const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ Error: PRODUCTION_DATABASE_URL or DATABASE_URL not set!');
      console.error('   Please set PRODUCTION_DATABASE_URL environment variable');
      process.exit(1);
    }
    
    console.log('🔗 Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
    console.log('');

    await findUsersWithMemberLoss();
  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

