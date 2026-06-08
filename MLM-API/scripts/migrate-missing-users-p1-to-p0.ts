/**
 * Migration Script: Migrate Missing Users from postgres-p1 to postgres-0 (Production)
 * 
 * This script migrates 9 missing users (SIA02096-SIA02104) from postgres-p1 to postgres-0
 * along with all their related data:
 * - Users table
 * - User tree paths
 * - User balances
 * - Any purchases (if any)
 * 
 * Usage:
 *   tsx scripts/migrate-missing-users-p1-to-p0.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Source database (postgres-p1) - read-only
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL || 'postgresql://mlm_user:mlm_password_prod_2024_secure@postgres-p1-service:5432/mlm_commission?schema=public',
    },
  },
});

// Target database (postgres-0) - production
const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_prod_2024_secure@postgres-service:5432/mlm_commission?schema=public',
    },
  },
});

const MISSING_DISPLAY_IDS = [
  'SIA02096',
  'SIA02097',
  'SIA02098',
  'SIA02099',
  'SIA02100',
  'SIA02101',
  'SIA02102',
  'SIA02103',
  'SIA02104',
];

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ display_id: string; error: string }>;
}

async function getReferrerIdInTarget(referrerDisplayId: string | null): Promise<bigint | null> {
  if (!referrerDisplayId) return null;
  
  const referrer = await targetPrisma.users.findUnique({
    where: { display_id: referrerDisplayId },
    select: { id: true },
  });
  
  if (!referrer) {
    throw new Error(`Referrer not found in target DB: ${referrerDisplayId}`);
  }
  
  return referrer.id;
}

async function migrateUserTreePaths(
  sourceUserId: bigint,
  targetUserId: bigint,
  referrerDisplayId: string | null
): Promise<void> {
  // Get all tree paths for this user from source
  const sourcePaths = await sourcePrisma.user_tree_paths.findMany({
    where: { descendant_id: sourceUserId },
  });

  // Get referrer's upline chain in target DB
  let referrerId: bigint | null = null;
  if (referrerDisplayId) {
    const referrer = await targetPrisma.users.findUnique({
      where: { display_id: referrerDisplayId },
      select: { id: true },
    });
    referrerId = referrer?.id || null;
  }

  // Create self path (depth 0)
  await targetPrisma.user_tree_paths.upsert({
    where: {
      ancestor_id_descendant_id: {
        ancestor_id: targetUserId,
        descendant_id: targetUserId,
      },
    },
    update: {},
    create: {
      ancestor_id: targetUserId,
      descendant_id: targetUserId,
      depth: 0,
    },
  });

  // If user has referrer, create paths for all ancestors
  if (referrerId) {
    // Get referrer's upline chain (all ancestors)
    const referrerAncestors = await targetPrisma.user_tree_paths.findMany({
      where: { descendant_id: referrerId },
      select: { ancestor_id: true, depth: true },
    });

    // Create paths: user -> each ancestor (depth = ancestor.depth + 1)
    for (const ancestor of referrerAncestors) {
      const newDepth = ancestor.depth + 1;
      await targetPrisma.user_tree_paths.upsert({
        where: {
          ancestor_id_descendant_id: {
            ancestor_id: ancestor.ancestor_id,
            descendant_id: targetUserId,
          },
        },
        update: { depth: newDepth },
        create: {
          ancestor_id: ancestor.ancestor_id,
          descendant_id: targetUserId,
          depth: newDepth,
        },
      });
    }

    // Create direct referrer path (depth 1)
    await targetPrisma.user_tree_paths.upsert({
      where: {
        ancestor_id_descendant_id: {
          ancestor_id: referrerId,
          descendant_id: targetUserId,
        },
      },
      update: { depth: 1 },
      create: {
        ancestor_id: referrerId,
        descendant_id: targetUserId,
        depth: 1,
      },
    });
  }
}

async function migrateUser(displayId: string): Promise<boolean> {
  try {
    console.log(`\n📦 Migrating user: ${displayId}`);

    // Check if user already exists in target
    const existingUser = await targetPrisma.users.findUnique({
      where: { display_id: displayId },
    });

    if (existingUser) {
      console.log(`  ⚠️  User ${displayId} already exists in target DB, skipping...`);
      return false; // Skipped
    }

    // Get user from source
    const sourceUser = await sourcePrisma.users.findUnique({
      where: { display_id: displayId },
      include: {
        // Get referrer display_id
      },
    });

    if (!sourceUser) {
      throw new Error(`User ${displayId} not found in source DB`);
    }

    // Get referrer display_id from source
    let referrerDisplayId: string | null = null;
    if (sourceUser.referrer_user_id) {
      const referrer = await sourcePrisma.users.findUnique({
        where: { id: sourceUser.referrer_user_id },
        select: { display_id: true },
      });
      referrerDisplayId = referrer?.display_id || null;
    }

    // Get referrer ID in target DB
    const targetReferrerId = await getReferrerIdInTarget(referrerDisplayId);

    // Create user in target DB
    const targetUser = await targetPrisma.users.create({
      data: {
        display_id: sourceUser.display_id,
        name: sourceUser.name,
        email: sourceUser.email,
        phone: sourceUser.phone,
        password_hash: sourceUser.password_hash,
        password_plain: sourceUser.password_plain,
        transaction_pin: sourceUser.transaction_pin,
        referrer_user_id: targetReferrerId,
        role: sourceUser.role,
        kyc_status: sourceUser.kyc_status,
        kyc_verified_at: sourceUser.kyc_verified_at,
        status: sourceUser.status,
        is_disqualified: sourceUser.is_disqualified,
        disqualified_at: sourceUser.disqualified_at,
        created_at: sourceUser.created_at,
        updated_at: sourceUser.updated_at,
      },
    });

    console.log(`  ✅ User created in target DB: ID ${targetUser.id}`);

    // Migrate user tree paths
    console.log(`  🌳 Migrating user tree paths...`);
    await migrateUserTreePaths(sourceUser.id, targetUser.id, referrerDisplayId);
    console.log(`  ✅ User tree paths migrated`);

    // Create user balance (if doesn't exist)
    const sourceBalance = await sourcePrisma.user_balances.findUnique({
      where: { user_id: sourceUser.id },
    });

    if (sourceBalance) {
      await targetPrisma.user_balances.upsert({
        where: { user_id: targetUser.id },
        update: {
          other_balance: sourceBalance.other_balance,
          spot_balance: sourceBalance.spot_balance,
        },
        create: {
          user_id: targetUser.id,
          other_balance: sourceBalance.other_balance,
          spot_balance: sourceBalance.spot_balance,
        },
      });
      console.log(`  ✅ User balance migrated`);
    } else {
      // Create empty balance
      await targetPrisma.user_balances.upsert({
        where: { user_id: targetUser.id },
        update: {},
        create: {
          user_id: targetUser.id,
          other_balance: 0,
          spot_balance: 0,
        },
      });
      console.log(`  ✅ Empty user balance created`);
    }

    // Check for purchases (should be none based on earlier check, but verify)
    const sourcePurchases = await sourcePrisma.purchases.findMany({
      where: { user_id: sourceUser.id },
    });

    if (sourcePurchases.length > 0) {
      console.log(`  ⚠️  Found ${sourcePurchases.length} purchases - these need manual migration if required`);
    }

    return true; // Success
  } catch (error: any) {
    console.error(`  ❌ Error migrating user ${displayId}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Migrating Missing Users from postgres-p1 to postgres-0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Verify source and target connections
  try {
    await sourcePrisma.$connect();
    console.log('✅ Connected to source DB (postgres-p1)');
  } catch (error) {
    console.error('❌ Failed to connect to source DB:', error);
    process.exit(1);
  }

  try {
    await targetPrisma.$connect();
    console.log('✅ Connected to target DB (postgres-0)');
  } catch (error) {
    console.error('❌ Failed to connect to target DB:', error);
    process.exit(1);
  }

  console.log('');

  // Migrate each user
  for (const displayId of MISSING_DISPLAY_IDS) {
    try {
      const migrated = await migrateUser(displayId);
      if (migrated) {
        result.success++;
      } else {
        result.skipped++;
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        display_id: displayId,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Migration Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Successfully migrated: ${result.success}`);
  console.log(`  ⚠️  Skipped (already exists): ${result.skipped}`);
  console.log(`  ❌ Failed: ${result.failed}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach((err) => {
      console.log(`  - ${err.display_id}: ${err.error}`);
    });
    console.log('');
  }

  await sourcePrisma.$disconnect();
  await targetPrisma.$disconnect();

  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
