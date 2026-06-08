#!/usr/bin/env tsx
/**
 * Export affected users with BEFORE fix vs AFTER fix card display (used/cap).
 * Before fix: used = min(effective_global_ids + dynamic_count, cap)
 * After fix:  used = min(dynamic_count, cap)
 * Writes: legacy-global-ids-before-after.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

async function main() {
  // One query: get each affected purchase with its dynamic_count (users after startDate)
  const rows = await prisma.$queryRaw<any[]>`
    WITH affected AS (
      SELECT 
        p.id AS purchase_id,
        p.user_id,
        p.package_id,
        p.purchased_at,
        p.effective_global_ids,
        p.is_renewal,
        p.previous_package_id,
        pk.name AS package_name,
        pk.global_ids AS package_cap
      FROM purchases p
      JOIN packages pk ON pk.id = p.package_id
      WHERE p.status = 'completed'
        AND pk.global_ids IS NOT NULL AND pk.global_ids > 0
        AND p.effective_global_ids IS NOT NULL AND p.effective_global_ids > 0
        AND (p.payment_type IS NULL OR p.payment_type != 'admin_assignment')
    ),
    with_start AS (
      SELECT 
        a.*,
        CASE 
          WHEN a.is_renewal = true AND a.previous_package_id IS NOT NULL THEN
            (SELECT MIN(p2.purchased_at) FROM purchases p2 
             WHERE p2.user_id = a.user_id AND p2.package_id = a.previous_package_id AND p2.status = 'completed')
          ELSE a.purchased_at
        END AS start_date
      FROM affected a
    )
    SELECT 
      w.purchase_id,
      w.user_id,
      w.package_name,
      w.package_cap,
      w.effective_global_ids,
      (SELECT COUNT(DISTINCT pu.user_id)::int FROM purchases pu
       WHERE pu.status = 'completed' AND pu.is_renewal = false
         AND pu.purchased_at > w.start_date
         AND pu.purchased_at <= NOW()
         AND pu.user_id <> w.user_id
      ) AS dynamic_count
    FROM with_start w
    ORDER BY w.user_id, w.purchased_at
  `;

  const userIds = [...new Set(rows.map((r) => r.user_id.toString()))];
  const users = await prisma.users.findMany({
    where: { id: { in: userIds.map((id) => BigInt(id)) } as any },
    select: { id: true, display_id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  const cap = (v: any) => (v != null && !isNaN(Number(v)) ? Number(v) : 0);

  const csvRows: string[] = [
    'display_id,name,purchase_id,package_name,package_cap,effective_global_ids,dynamic_count,before_fix_used,after_fix_used,before_fix_display,after_fix_display',
  ];

  for (const r of rows) {
    const packageCap = cap(r.package_cap);
    const effective = cap(r.effective_global_ids);
    const dynamic = cap(r.dynamic_count);
    const beforeUsed = Math.min(effective + dynamic, packageCap);
    const afterUsed = Math.min(dynamic, packageCap);
    const u = userMap.get(r.user_id.toString());
    csvRows.push(
      [
        escapeCsv(u?.display_id ?? r.user_id),
        escapeCsv(u?.name ?? ''),
        r.purchase_id,
        escapeCsv(r.package_name),
        packageCap,
        effective,
        dynamic,
        beforeUsed,
        afterUsed,
        `${beforeUsed}/${packageCap}`,
        `${afterUsed}/${packageCap}`,
      ].join(',')
    );
  }

  const csvPath = path.join(process.cwd(), 'legacy-global-ids-before-after.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  console.log('Total affected purchases:', rows.length);
  console.log('CSV written:', csvPath);

  // Second CSV: one row per USER with ALL packages in one row (multiple packages visible)
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const uid = r.user_id.toString();
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(r);
  }

  const userDataRows: string[] = [];
  for (const [uid, prs] of byUser) {
    const u = userMap.get(uid);
    const parts = prs.map((r, i) => {
      const packageCap = cap(r.package_cap);
      const effective = cap(r.effective_global_ids);
      const dynamic = cap(r.dynamic_count);
      const beforeDisplay = `${Math.min(effective + dynamic, packageCap)}/${packageCap}`;
      const afterDisplay = `${Math.min(dynamic, packageCap)}/${packageCap}`;
      return `Package ${i + 1}: ${r.package_name} (cap ${packageCap}) | Before: ${beforeDisplay} | After: ${afterDisplay}`;
    });
    userDataRows.push(
      [
        escapeCsv(u?.display_id ?? uid),
        escapeCsv(u?.name ?? ''),
        prs.length,
        escapeCsv(parts.join('; ')),
      ].join(',')
    );
  }

  userDataRows.sort((a, b) => {
    const idA = a.split(',')[0].replace(/^"|"$/g, '');
    const idB = b.split(',')[0].replace(/^"|"$/g, '');
    return idA.localeCompare(idB);
  });

  const userCsvPath = path.join(process.cwd(), 'legacy-global-ids-before-after-by-user.csv');
  fs.writeFileSync(
    userCsvPath,
    ['display_id,name,package_count,all_packages_before_after', ...userDataRows].join('\n'),
    'utf-8'
  );
  console.log('CSV (one row per user, all packages):', userCsvPath);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
