#!/usr/bin/env tsx
/**
 * Check SIA00424 - Package shows Used 2200/2200 but Global Help Income shows 1339
 * Verify local DB: purchase data, which branch Commission vs PackageStatus uses, ledger used_ids
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00424';

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 SIA00424 - Global IDs: Package 2200 vs Ledger 1339');
  console.log('='.repeat(80));

  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('\n❌ User not found.');
    await prisma.$disconnect();
    return;
  }

  const userId = user.id;
  console.log('\n✅ User:', user.display_id, user.name);
  console.log('   user_id:', userId.toString());

  const purchases = await prisma.purchases.findMany({
    where: { user_id: userId, status: 'completed' },
    orderBy: { purchased_at: 'asc' },
  });

  const packageIds = [...new Set(purchases.map((p) => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true, global_ids: true },
  });
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  console.log('\n📦 Purchases (with global_ids cap):');
  for (const p of purchases) {
    const pkg = pkgMap.get(p.package_id);
    const cap = pkg?.global_ids ?? 0;
    const effective = (p as any).effective_global_ids;
    const isManual = (p as any).is_manual;
    const paymentType = (p as any).payment_type;
    const isRenewal = (p as any).is_renewal;
    const prevPkgId = (p as any).previous_package_id;
    console.log(`   Purchase ${p.id}: ${pkg?.name} | cap=${cap} | effective_global_ids=${effective} | is_manual=${isManual} | payment_type=${paymentType} | is_renewal=${isRenewal} | previous_package_id=${prevPkgId} | purchased_at=${p.purchased_at}`);
  }

  const purchase2200 = purchases.find((p) => {
    const pkg = pkgMap.get(p.package_id);
    return pkg && Number(pkg.global_ids) === 2200;
  });

  if (!purchase2200) {
    console.log('\n⚠️ No purchase with global_ids cap 2200 found.');
    await prisma.$disconnect();
    return;
  }

  const pkg2200 = pkgMap.get(purchase2200.package_id)!;
  const purchaseId = purchase2200.id;
  const packageCap = Number(pkg2200.global_ids) || 0;

  console.log('\n' + '-'.repeat(80));
  console.log('📌 Target: Purchase', purchaseId.toString(), '|', pkg2200.name, '| cap', packageCap);
  console.log('-'.repeat(80));

  const isManual = (purchase2200 as any).is_manual;
  const paymentType = (purchase2200 as any).payment_type;
  const effectiveGlobalIds = (purchase2200 as any).effective_global_ids;
  const isRenewal = (purchase2200 as any).is_renewal;
  const previousPackageId = (purchase2200 as any).previous_package_id;

  const isAdminAssignment =
    isManual &&
    paymentType === 'admin_assignment' &&
    effectiveGlobalIds != null &&
    Number(effectiveGlobalIds) > 0;
  const isUpgrade =
    isRenewal &&
    previousPackageId != null &&
    previousPackageId !== purchase2200.package_id &&
    effectiveGlobalIds != null &&
    Number(effectiveGlobalIds) > 0;

  console.log('\n🔀 Commission service branch:');
  console.log('   isAdminAssignment:', isAdminAssignment);
  console.log('   isUpgrade:', isUpgrade);
  console.log('   → Else (normal/legacy):', !isAdminAssignment && !isUpgrade);

  let startDate: Date;
  if (isRenewal && previousPackageId) {
    const firstPurchase = await prisma.purchases.findFirst({
      where: {
        user_id: userId,
        package_id: previousPackageId,
        status: 'completed',
      },
      orderBy: { purchased_at: 'asc' },
      select: { purchased_at: true },
    });
    startDate = firstPurchase ? new Date(firstPurchase.purchased_at) : new Date(purchase2200.purchased_at);
    console.log('   startDate (renewal):', startDate.toISOString());
  } else {
    startDate = new Date(purchase2200.purchased_at);
    console.log('   startDate (this purchase):', startDate.toISOString());
  }

  const nowForQuery = new Date();
  nowForQuery.setHours(23, 59, 59, 999);

  const uniqueFirstPurchases = await prisma.purchases.findMany({
    where: {
      status: 'completed',
      is_renewal: false,
      purchased_at: { gt: startDate, lte: nowForQuery },
      NOT: { user_id: userId },
    } as any,
    select: { user_id: true },
    distinct: ['user_id'],
  });

  const globalUsersCount = uniqueFirstPurchases.length;
  const usedIdsCommission = Math.min(globalUsersCount, packageCap);

  console.log('\n📊 Commission service (current logic):');
  console.log('   globalUsersCount (dynamic only):', globalUsersCount);
  console.log('   usedIds = min(globalUsersCount, cap):', usedIdsCommission);

  let usedIdsPackageStatus = usedIdsCommission;
  if (effectiveGlobalIds != null && Number(effectiveGlobalIds) > 0) {
    if (isManual && paymentType === 'admin_assignment') {
      const total = Number(effectiveGlobalIds) + globalUsersCount;
      usedIdsPackageStatus = Math.min(total, packageCap);
      console.log('\n📊 Package status (admin assignment): initial + new =', Number(effectiveGlobalIds), '+', globalUsersCount, '=', usedIdsPackageStatus);
    } else if (isUpgrade) {
      const remainingIds = Number(effectiveGlobalIds);
      const initialUsedIds = Math.max(0, packageCap - remainingIds);
      const upgradeDate = new Date(purchase2200.purchased_at);
      const newUsersAfterUpgrade = await prisma.purchases.findMany({
        where: {
          status: 'completed',
          is_renewal: false,
          purchased_at: { gt: upgradeDate, lte: nowForQuery },
          NOT: { user_id: userId },
        } as any,
        select: { user_id: true },
        distinct: ['user_id'],
      });
      const total = initialUsedIds + newUsersAfterUpgrade.length;
      usedIdsPackageStatus = Math.min(total, packageCap);
      console.log('\n📊 Package status (upgrade): initial_used + new_after_upgrade =', usedIdsPackageStatus);
    } else {
      const total = Number(effectiveGlobalIds) + globalUsersCount;
      usedIdsPackageStatus = Math.min(total, packageCap);
      console.log('\n📊 Package status (legacy/manual): effective_global_ids + new =', Number(effectiveGlobalIds), '+', globalUsersCount, '=', usedIdsPackageStatus);
    }
  }

  console.log('\n📌 Result:');
  console.log('   Commission service would use usedIds:', usedIdsCommission);
  console.log('   Package status (UI card) would show used_ids:', usedIdsPackageStatus);

  const globalEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'GLOBAL_HELPING',
      purchase_id: purchaseId,
    },
    orderBy: { credited_at: 'desc' },
    take: 15,
  });

  console.log('\n📜 Last 15 GLOBAL_HELPING ledger entries for this purchase:');
  console.log('   Date       | used_ids (metadata) | amount');
  for (const e of globalEntries) {
    const meta = (e.metadata as any) || {};
    const used = meta.used_ids ?? meta.effective_global_ids ?? '-';
    console.log('   ', (e.credited_at as Date).toISOString().slice(0, 10), '|', used, '|', e.amount);
  }

  if (usedIdsCommission !== usedIdsPackageStatus) {
    console.log('\n⚠️ MISMATCH: Commission uses', usedIdsCommission, ', Package Status shows', usedIdsPackageStatus);
    console.log('   Reason: Commission uses "normal/legacy" branch (pure dynamic, no effective_global_ids).');
    console.log('   Package Status uses legacy branch (effective_global_ids + new users) for this purchase.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
