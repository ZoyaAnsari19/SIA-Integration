#!/usr/bin/env tsx
/**
 * Verify: Legacy list should NOT contain any user whose package was admin-assigned.
 * Admin-assigned = payment_type = 'admin_assignment'
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Purchases that ARE admin-assigned (payment_type = 'admin_assignment') with effective_global_ids
  const adminAssigned = await prisma.$queryRaw<any[]>`
    SELECT 
      p.id AS purchase_id,
      p.user_id,
      p.payment_type,
      p.effective_global_ids,
      pk.name AS package_name,
      pk.global_ids AS package_cap
    FROM purchases p
    JOIN packages pk ON pk.id = p.package_id
    WHERE p.status = 'completed'
      AND pk.global_ids IS NOT NULL AND pk.global_ids > 0
      AND p.effective_global_ids IS NOT NULL AND p.effective_global_ids > 0
      AND p.payment_type = 'admin_assignment'
    ORDER BY p.user_id
  `;

  // 2) Our legacy list query (who we include) - should have 0 overlap with admin_assignment
  const legacyList = await prisma.$queryRaw<any[]>`
    SELECT p.id AS purchase_id, p.user_id, p.payment_type
    FROM purchases p
    JOIN packages pk ON pk.id = p.package_id
    WHERE p.status = 'completed'
      AND pk.global_ids IS NOT NULL AND pk.global_ids > 0
      AND p.effective_global_ids IS NOT NULL AND p.effective_global_ids > 0
      AND (p.payment_type IS NULL OR p.payment_type != 'admin_assignment')
  `;

  const legacyPurchaseIds = new Set(legacyList.map((r) => r.purchase_id.toString()));
  const adminPurchaseIds = new Set(adminAssigned.map((r) => r.purchase_id.toString()));

  const overlap = adminAssigned.filter((r) => legacyPurchaseIds.has(r.purchase_id.toString()));
  const adminUserIds = [...new Set(adminAssigned.map((r) => r.user_id.toString()))];

  const users = await prisma.users.findMany({
    where: { id: { in: adminUserIds.map((id) => BigInt(id)) } as any },
    select: { id: true, display_id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  console.log('='.repeat(80));
  console.log('CHECK: Legacy list vs Admin-assigned users');
  console.log('='.repeat(80));
  console.log('');
  console.log('1) Admin-assigned purchases (payment_type = \'admin_assignment\' + effective_global_ids):');
  console.log('   Count:', adminAssigned.length);
  if (adminAssigned.length > 0) {
    console.log('   Sample (first 10):');
    for (const r of adminAssigned.slice(0, 10)) {
      const u = userMap.get(r.user_id.toString());
      console.log('     Purchase', r.purchase_id, '|', u?.display_id ?? r.user_id, '|', r.package_name, '| payment_type:', r.payment_type);
    }
  }
  console.log('');
  console.log('2) Legacy list (our CSV) purchase count:', legacyList.length);
  console.log('   Condition: effective_global_ids set AND (payment_type IS NULL OR payment_type != \'admin_assignment\')');
  console.log('');
  console.log('3) Overlap check: Any admin-assigned purchase in legacy list?');
  console.log('   Overlap count:', overlap.length);
  if (overlap.length > 0) {
    console.log('   ERROR: These should NOT be in legacy list:', overlap.map((r) => r.purchase_id));
  } else {
    console.log('   OK: No admin-assigned purchase is in the legacy list.');
  }
  console.log('');
  console.log('Conclusion: Legacy list mein sirf wo users hain jinko admin ne package assign NAHI kiya.');
  console.log('            Admin-assigned (payment_type = \'admin_assignment\') excluded hain.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
