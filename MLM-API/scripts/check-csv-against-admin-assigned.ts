#!/usr/bin/env tsx
/**
 * Check: legacy-global-ids-before-after-by-user.csv mein wo users to nahi
 * jinko admin ne package assign kiya ho (payment_type = 'admin_assignment').
 * Reads the CSV and compares with DB admin-assigned users.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), 'legacy-global-ids-before-after-by-user.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('CSV not found:', csvPath);
    await prisma.$disconnect();
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const header = lines[0];
  const dataLines = lines.slice(1);
  const csvDisplayIds = new Set<string>();
  for (const line of dataLines) {
    const firstCol = line.indexOf(',') >= 0 ? line.split(',')[0].replace(/^"|"$/g, '').trim() : line.trim();
    if (firstCol) csvDisplayIds.add(firstCol);
  }

  console.log('='.repeat(80));
  console.log('CHECK: legacy-global-ids-before-after-by-user.csv vs Admin-assigned users');
  console.log('='.repeat(80));
  console.log('');
  console.log('1) CSV file:', csvPath);
  console.log('   Total display_ids in CSV:', csvDisplayIds.size);
  console.log('');

  const adminAssignedUsers = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT u.id AS user_id, u.display_id, u.name
    FROM users u
    JOIN purchases p ON p.user_id = u.id
    JOIN packages pk ON pk.id = p.package_id
    WHERE p.status = 'completed'
      AND pk.global_ids IS NOT NULL AND pk.global_ids > 0
      AND p.effective_global_ids IS NOT NULL AND p.effective_global_ids > 0
      AND p.payment_type = 'admin_assignment'
  `;

  console.log('2) Admin-assigned users (DB): users jinko admin ne package assign kiya');
  console.log('   Count:', adminAssignedUsers.length);
  if (adminAssignedUsers.length > 0) {
    console.log('   Display IDs:', adminAssignedUsers.map((r) => r.display_id || r.user_id).join(', '));
  }
  console.log('');

  const adminDisplayIds = new Set(
    adminAssignedUsers.map((r) => (r.display_id ? String(r.display_id).trim() : '')).filter(Boolean)
  );

  const inBoth = [...csvDisplayIds].filter((id) => adminDisplayIds.has(id));
  const onlyInCsv = [...csvDisplayIds].filter((id) => !adminDisplayIds.has(id));
  const onlyAdmin = [...adminDisplayIds].filter((id) => !csvDisplayIds.has(id));

  console.log('3) Result:');
  console.log('   CSV mein aise users (jinko admin ne package assign kiya) =', inBoth.length);
  if (inBoth.length > 0) {
    console.log('   Ye display_ids CSV mein bhi hain aur admin-assigned bhi hain:', inBoth.join(', '));
    console.log('   (In users ke paas koi legacy package bhi hai isliye CSV mein aaye; admin-assigned purchase alag hai.)');
  } else {
    console.log('   CSV mein koi bhi user NAHI hai jinko admin ne package assign kiya ho.');
  }
  console.log('');
  console.log('Conclusion:');
  if (inBoth.length === 0) {
    console.log('   List (CSV) mein sirf wo users hain jinko admin ne package assign NAHI kiya.');
    console.log('   Admin-assigned users list mein nahi hain.');
  } else {
    console.log('   ', inBoth.length, ' user(s) aise hain jo CSV mein bhi hain aur unke paas koi admin-assigned package bhi hai.');
    console.log('   Wo CSV mein apne LEGACY (non-admin) package ki wajah se hain; unka admin-assigned purchase list mein include nahi hota.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
