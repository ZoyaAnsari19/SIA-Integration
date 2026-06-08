#!/usr/bin/env tsx
/**
 * Verify SIA00424: Migration had 1073 used (18 Dec). From 18 Dec till now, first purchases.
 * Compare: expected (1073 + new since 18 Dec) vs what we show (dynamic from purchase date 25 Feb 2025).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00424';
const MIGRATION_DATE = new Date('2024-12-18T00:00:00Z'); // 18 Dec 2024 (migration)
const NOW = new Date();

async function main() {
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });
  if (!user) {
    console.log('User not found');
    await prisma.$disconnect();
    return;
  }

  const purchase = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.purchased_at, p.effective_global_ids, p.package_id
    FROM purchases p
    JOIN packages pk ON pk.id = p.package_id
    WHERE p.user_id = ${user.id} AND p.status = 'completed'
      AND pk.global_ids = 2200
    ORDER BY p.purchased_at ASC LIMIT 1
  `.then((r) => r[0]);
  if (!purchase) {
    console.log('Package purchase (cap 2200) not found');
    await prisma.$disconnect();
    return;
  }

  const pkg = await prisma.packages.findUnique({
    where: { id: purchase.package_id },
    select: { name: true, global_ids: true },
  });
  const cap = Number(pkg?.global_ids || 2200);

  // 1) First purchases AFTER 18 Dec (migration) till now, exclude self
  const newSince18Dec = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: { gt: MIGRATION_DATE, lte: NOW },
      NOT: { user_id: user.id },
    } as any,
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const countSince18Dec = newSince18Dec.length;

  // 2) First purchases AFTER purchase date (25 Feb 2025) till now, exclude self = what we show (dynamic)
  const purchaseDate = new Date(purchase.purchased_at);
  const newSincePurchaseDate = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: { gt: purchaseDate, lte: NOW },
      NOT: { user_id: user.id },
    } as any,
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const dynamicCount = newSincePurchaseDate.length;

  // 3) Migration used (user said 1073; DB has effective_global_ids = 1057)
  const migrationUsed = 1073;
  const effectiveInDb = (purchase as any).effective_global_ids != null ? Number((purchase as any).effective_global_ids) : null;

  // Expected if we used migration logic: 1073 + (new users from 18 Dec to now), capped
  const expectedMigrationBased = Math.min(migrationUsed + countSince18Dec, cap);

  console.log('='.repeat(70));
  console.log('SIA00424 – Global IDs verification (migration 18 Dec vs current display)');
  console.log('='.repeat(70));
  console.log('');
  console.log('User:', user.display_id, '|', user.name);
  console.log('Package:', pkg?.name, '| Cap:', cap);
  console.log('Purchase date:', purchaseDate.toISOString().slice(0, 10));
  console.log('');
  console.log('--- Migration (18 Dec) ---');
  console.log('  Migration used (as per you):', migrationUsed);
  console.log('  effective_global_ids in DB:', effectiveInDb);
  console.log('');
  console.log('--- First purchases (unique users) ---');
  console.log('  From 18 Dec to now (exclude self):', countSince18Dec);
  console.log('  From purchase date (25 Feb 2025) to now (exclude self):', dynamicCount);
  console.log('');
  console.log('--- Expected vs current display ---');
  console.log('  If formula = migration_used + new_since_18Dec (capped):');
  console.log('    ', migrationUsed, '+', countSince18Dec, '=', migrationUsed + countSince18Dec, '→ capped', expectedMigrationBased);
  console.log('  Current code shows (dynamic from purchase date):', dynamicCount);
  console.log('  So package card / Global Used ID column shows:', dynamicCount + '/' + cap);
  console.log('');
  console.log('--- Summary ---');
  if (dynamicCount === expectedMigrationBased) {
    console.log('  Match: Display', dynamicCount, 'equals migration-based', expectedMigrationBased);
  } else {
    console.log('  Difference: Display', dynamicCount, 'vs migration-based', expectedMigrationBased);
    console.log('  Current logic uses ONLY dynamic from purchase date (25 Feb), not 1073 + new since 18 Dec.');
  }
  console.log('');
  console.log('  Business rule in code: For this user (not admin-assigned), we do NOT use');
  console.log('  effective_global_ids / migration 1073. We only count users who did first');
  console.log('  purchase AFTER this package purchase (25 Feb 2025). So', dynamicCount, 'is correct');
  console.log('  as per current rule. Migration 1073 is intentionally not added.');
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
