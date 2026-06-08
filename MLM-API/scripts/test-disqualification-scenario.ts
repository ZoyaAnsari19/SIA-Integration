#!/usr/bin/env tsx
/**
 * Disqualification Chain Scenario:
 *
 * A1 -> A2 -> A3 -> A4 -> A5
 * (then A2 disqualified)
 * A2 -> A7 -> A8 (new chain)
 *
 * Expectations:
 * - Before disqualify:
 *   - A1 gets SPOT from A2/A3/A4/A5 as per levels.
 * - After disqualify A2:
 *   - A1 still gets from old chain (A3/A4/A5 purchases done earlier)
 *   - A1 does NOT get SPOT/MONTHLY from new chain (A7/A8)
 *   - A2 can earn from new chain based on new level qualification.
 */

import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import { DisqualificationService } from '../src/modules/commissions/disqualification.service.js';

async function resetDb() {
  console.log('🧹 Resetting core tables for scenario...');
  await prisma.$transaction([
    prisma.wallet_transactions.deleteMany(),
    prisma.ledger_entries.deleteMany(),
    prisma.scheduled_commissions.deleteMany(),
    prisma.pending_commissions.deleteMany(),
    prisma.level_eligibility.deleteMany(),
    prisma.user_balances.deleteMany(),
    prisma.purchases.deleteMany(),
    prisma.user_tree_paths.deleteMany(),
    prisma.users.deleteMany(),
  ]);
  console.log('✅ DB reset\n');
}

async function seedLevelsAndPackage() {
  console.log('📋 Seeding levels + package...');

  // Simple level config: we only really need first 3 levels for this scenario
  const now = new Date();
  await prisma.levels.upsert({
    where: { level: 1 },
    update: {
      title: 'Level 1',
      spot_commission_percent: 5, // arbitrary, focus is chain behavior
      monthly_royalty_percent: 0.5,
      business_requirement: { required_leg_count: 1, required_leg_min_amount: 2500 },
      updated_at: now,
    },
    create: {
      level: 1,
      title: 'Level 1',
      spot_commission_percent: 5,
      monthly_royalty_percent: 0.5,
      business_requirement: { required_leg_count: 1, required_leg_min_amount: 2500 },
      created_at: now,
      updated_at: now,
    },
  });

  await prisma.levels.upsert({
    where: { level: 2 },
    update: {
      title: 'Level 2',
      spot_commission_percent: 3,
      monthly_royalty_percent: 0.3,
      business_requirement: { required_leg_count: 2, required_leg_min_amount: 2500 },
      updated_at: now,
    },
    create: {
      level: 2,
      title: 'Level 2',
      spot_commission_percent: 3,
      monthly_royalty_percent: 0.3,
      business_requirement: { required_leg_count: 2, required_leg_min_amount: 2500 },
      created_at: now,
      updated_at: now,
    },
  });

  await prisma.levels.upsert({
    where: { level: 3 },
    update: {
      title: 'Level 3',
      spot_commission_percent: 2,
      monthly_royalty_percent: 0.2,
      business_requirement: { required_leg_count: 3, required_leg_min_amount: 2500 },
      updated_at: now,
    },
    create: {
      level: 3,
      title: 'Level 3',
      spot_commission_percent: 2,
      monthly_royalty_percent: 0.2,
      business_requirement: { required_leg_count: 3, required_leg_min_amount: 2500 },
      created_at: now,
      updated_at: now,
    },
  });

  const pkg = await prisma.packages.create({
    data: {
      name: '₹2,500 Course',
      price: 2500,
      min_amount: 2500,
      max_amount: 2500,
      self_monthly: 62.5,
      self_roi_percent: 2.5,
      global_ids: 55,
      global_monthly_per_id: 6.25,
      recurring_rate_percent: 0.5,
      validity_months: 12,
      status: 'active',
    } as any,
  });

  console.log(`✅ Seeded levels 1–3 and package ID=${pkg.id}\n`);
  return pkg.id;
}

async function createUserWithTree(name: string, email: string, referrerId?: bigint) {
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        name,
        email,
        referrer_user_id: referrerId ?? null,
      },
    });

    // self path depth 0
    await tx.user_tree_paths.create({
      data: { ancestor_id: created.id, descendant_id: created.id, depth: 0 },
    });

    // inherit ancestors from referrer
    if (created.referrer_user_id) {
      // referrer as ancestor depth 1
      await tx.user_tree_paths.create({
        data: {
          ancestor_id: created.referrer_user_id,
          descendant_id: created.id,
          depth: 1,
        },
      });

      const ancestors = await tx.user_tree_paths.findMany({
        where: {
          descendant_id: created.referrer_user_id,
          NOT: { ancestor_id: created.referrer_user_id },
        },
      });
      for (const a of ancestors) {
        await tx.user_tree_paths.create({
          data: {
            ancestor_id: a.ancestor_id,
            descendant_id: created.id,
            depth: a.depth + 1,
          },
        });
      }
    }

    return created;
  });

  console.log(`   👤 Created ${name} (ID=${user.id})${referrerId ? ` under ${referrerId}` : ''}`);
  return user.id as unknown as bigint;
}

async function createPurchaseAndProcess(userId: bigint, packageId: number) {
  const today = new Date();
  const activeUntil = new Date(today);
  activeUntil.setMonth(activeUntil.getMonth() + 12);

  const purchase = await prisma.purchases.create({
    data: {
      user_id: userId,
      package_id: packageId,
      amount: 2500,
      purchased_at: today,
      active_until: activeUntil,
      status: 'completed',
    } as any,
  });
  console.log(`     🛒 Purchase created for user ${userId} (purchase ID=${purchase.id})`);

  await CommissionService.handlePurchase(purchase.id as unknown as bigint);
  console.log(`     💸 Commissions processed for purchase ${purchase.id}\n`);

  return purchase.id as unknown as bigint;
}

async function printSpotForSources(label: string, sourceIds: bigint[]) {
  console.log(`\n📊 ${label} – SPOT ledger by receiver:`);
  const rows = await prisma.ledger_entries.groupBy({
    by: ['receiver_user_id'],
    where: {
      commission_type: 'SPOT',
      source_user_id: { in: sourceIds as any },
    },
    _sum: { amount: true },
  });

  if (!rows.length) {
    console.log('   (no SPOT rows)');
    return;
  }

  for (const r of rows) {
    console.log(
      `   Receiver ${r.receiver_user_id.toString()}: SPOT = ₹${Number(
        r._sum.amount ?? 0,
      ).toFixed(2)}`,
    );
  }
}

async function printMonthlyForSources(label: string, sourceIds: bigint[]) {
  console.log(`\n📊 ${label} – MONTHLY scheduled by receiver:`);
  const rows = await prisma.scheduled_commissions.groupBy({
    by: ['receiver_user_id'],
    where: {
      commission_type: 'MONTHLY',
      source_user_id: { in: sourceIds as any },
    },
    _sum: { monthly_amount: true },
  });

  if (!rows.length) {
    console.log('   (no MONTHLY rows)');
    return;
  }

  for (const r of rows) {
    console.log(
      `   Receiver ${r.receiver_user_id.toString()}: MONTHLY = ₹${Number(
        r._sum.monthly_amount ?? 0,
      ).toFixed(2)}/month`,
    );
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  DISQUALIFICATION CHAIN SCENARIO (A1–A8)    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await resetDb();
    const pkgId = await seedLevelsAndPackage();

    console.log('👥 Creating initial chain: A1 -> A2 -> A3 -> A4 -> A5\n');
    const A1 = await createUserWithTree('A1', 'a1@test.com');
    const A2 = await createUserWithTree('A2', 'a2@test.com', A1);
    const A3 = await createUserWithTree('A3', 'a3@test.com', A2);
    const A4 = await createUserWithTree('A4', 'a4@test.com', A3);
    const A5 = await createUserWithTree('A5', 'a5@test.com', A4);

    console.log('\n💰 Creating purchases for A1–A5 and processing commissions...\n');
    await createPurchaseAndProcess(A1, pkgId);
    await createPurchaseAndProcess(A2, pkgId);
    await createPurchaseAndProcess(A3, pkgId);
    await createPurchaseAndProcess(A4, pkgId);
    await createPurchaseAndProcess(A5, pkgId);

    // Recompute eligibility so higher-level SPOT/MONTHLY logic is consistent
    console.log('🔁 Recomputing eligibility after initial purchases...\n');
    await CommissionService.recalculateEligibility();

    // Snapshot 1: before disqualification
    await printSpotForSources('Before disqualification (A5 purchase impact)', [A5]);
    await printMonthlyForSources('Before disqualification (A5 as source)', [A5]);

    console.log('\n🚫 Disqualifying A2 (simulate 21+ days inactivity)...\n');
    await DisqualificationService.disqualifyUser(A2);

    console.log('👥 Creating new chain under A2: A2 -> A7 -> A8\n');
    const A7 = await createUserWithTree('A7', 'a7@test.com', A2);
    const A8 = await createUserWithTree('A8', 'a8@test.com', A7);

    console.log('\n💰 Creating purchases for A7 & A8 and processing commissions...\n');
    await createPurchaseAndProcess(A7, pkgId);
    await createPurchaseAndProcess(A8, pkgId);

    console.log('🔁 Recomputing eligibility after new-chain purchases...\n');
    await CommissionService.recalculateEligibility();

    // Snapshot 2: after disqualification + new chain
    await printSpotForSources('After disqualification (A7/A8 purchases impact)', [A7, A8]);
    await printMonthlyForSources('After disqualification (A7/A8 as source)', [A7, A8]);

    console.log('\n✅ Scenario completed. Review SPOT / MONTHLY summaries above.');
  } catch (err) {
    console.error('❌ Scenario failed:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });


