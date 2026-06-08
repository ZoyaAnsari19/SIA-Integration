#!/usr/bin/env tsx
/**
 * List users with same issue as SIA00424:
 * effective_global_ids set, but payment_type != 'admin_assignment' (or null)
 * → Commission uses pure dynamic, Package Status (before fix) showed initial+new = mismatch
 * Writes CSV: legacy-global-ids-users-local.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function escapeCsv(val: string): string {
  if (val == null) return '';
  const s = String(val).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

async function main() {
  const purchases = await prisma.$queryRaw<any[]>`
    SELECT 
      p.id AS purchase_id,
      p.user_id,
      p.package_id,
      p.purchased_at,
      p.effective_global_ids,
      p.is_manual,
      p.payment_type,
      p.income,
      p.amount,
      pk.name AS package_name,
      pk.global_ids AS package_cap
    FROM purchases p
    JOIN packages pk ON pk.id = p.package_id
    WHERE p.status = 'completed'
      AND pk.global_ids IS NOT NULL
      AND pk.global_ids > 0
      AND p.effective_global_ids IS NOT NULL
      AND p.effective_global_ids > 0
      AND (p.payment_type IS NULL OR p.payment_type != 'admin_assignment')
    ORDER BY p.user_id, p.purchased_at
  `;

  const userIds = [...new Set(purchases.map((r) => r.user_id.toString()))];
  const users = await prisma.users.findMany({
    where: { id: { in: userIds.map((id) => BigInt(id)) } as any },
    select: { id: true, display_id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  console.log('='.repeat(80));
  console.log('Users with SIA00424-type issue (effective_global_ids set, NOT admin_assignment)');
  console.log('='.repeat(80));
  console.log('Total affected purchases:', purchases.length);
  console.log('Total affected users:', userIds.length);
  console.log('');

  const byUser = new Map<string, typeof purchases>();
  for (const p of purchases) {
    const uid = p.user_id.toString();
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(p);
  }

  const list: { display_id: string; name: string; purchase_count: number; packages: string[] }[] = [];
  for (const [uid, prs] of byUser) {
    const u = userMap.get(uid);
    list.push({
      display_id: u?.display_id ?? uid,
      name: u?.name ?? 'N/A',
      purchase_count: prs.length,
      packages: prs.map((p) => `${p.package_name} (cap ${p.package_cap})`),
    });
  }
  list.sort((a, b) => (a.display_id || '').localeCompare(b.display_id || ''));

  console.log('Display ID   | Name                 | Purchases | Package(s)');
  console.log('-'.repeat(80));
  for (const row of list) {
    console.log(
      `${(row.display_id || '').padEnd(12)} | ${(row.name || '').slice(0, 20).padEnd(20)} | ${String(row.purchase_count).padStart(9)} | ${row.packages.join('; ')}`
    );
  }
  console.log('');
  console.log('Display IDs list:', list.map((r) => r.display_id).filter(Boolean).join(', '));

  // Write CSV (one row per user)
  const csvRows: string[] = [
    'display_id,name,purchase_count,packages',
    ...list.map(
      (r) =>
        [escapeCsv(r.display_id ?? ''), escapeCsv(r.name ?? ''), r.purchase_count, escapeCsv(r.packages.join('; '))].join(
          ','
        )
    ),
  ];
  const csvPath = path.join(process.cwd(), 'legacy-global-ids-users-local.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
  console.log('\nCSV written:', csvPath);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
