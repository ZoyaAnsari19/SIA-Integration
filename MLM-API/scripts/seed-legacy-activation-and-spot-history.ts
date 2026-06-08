/// <reference types="node" />

/**
 * Seed legacy activation + spot history (Excel exports) into dedicated legacy tables.
 *
 * Goal:
 * - Old system ki activation + spot history ko new system me read-only view ke liye store karna
 * - Admin UI se simple listing/filtering possible ho
 *
 * Safety:
 * - Duplicate-safe via UNIQUE (source_file, row_index)
 * - If user (display_id) not found, row skip ho jayega (counted in summary)
 *
 * Usage (local only):
 *   # Default file paths from repo root:
 *   #  - Activation History Old Data As per New Excel.xlsx
 *   #  - Spot All Histry As Per New Excel.xlsx
 *   npx tsx scripts/seed-legacy-activation-and-spot-history.ts
 *
 *   # Custom paths (activation, spot):
 *   npx tsx scripts/seed-legacy-activation-and-spot-history.ts "/path/to/activation.xlsx" "/path/to/spot.xlsx"
 */

import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import { prisma } from '../src/config/prisma.js';

type LegacyRow = Record<string, unknown>;

function parseDisplayId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Excel format: "SIA00021 - Name ..." or sometimes just "SIA00021"
  const first = trimmed.split(/\s+/)[0];
  const displayId = first.replace(/[^A-Za-z0-9]/g, '');
  return displayId || null;
}

function extractDisplayId(row: LegacyRow): string | null {
  // Common header: "User ID"
  if (row['User ID'] != null) {
    const id = parseDisplayId(row['User ID']);
    if (id) return id;
  }

  // Fallback: try to find a key containing "user id"
  const key = Object.keys(row).find((k) => k.toLowerCase().includes('user id'));
  if (key && row[key] != null) {
    return parseDisplayId(row[key]);
  }

  return null;
}

function extractSpotDisplayId(row: LegacyRow): string | null {
  // Spot sheet uses "user_id" (lowercase with underscore)
  const candidate = row['user_id'] ?? row['User ID'] ?? row['USER_ID'];
  if (candidate == null) return null;
  return parseDisplayId(candidate);
}

async function importExcelToTable(options: { tableName: 'legacy_activation_history' | 'legacy_spot_history'; filePath: string }) {
  const { tableName, filePath } = options;

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Excel file not found for ${tableName}:`, filePath);
    return;
  }

  const sourceFile = path.basename(filePath);
  console.log(`\n📄 Reading Excel for ${tableName}:`, filePath);

  const wb = xlsx.readFile(filePath, { cellDates: true });
  // Activation file: first sheet is correct.
  // Spot file: actual spot data may be in a sheet named with "Spot" – prefer that.
  const sheetName =
    tableName === 'legacy_spot_history'
      ? wb.SheetNames.find((name) => /spot/i.test(name)) ?? wb.SheetNames[0]
      : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<LegacyRow>(sheet, { defval: null });

  console.log(`📊 Rows: ${rows.length}, sheet: ${sheetName}, table: ${tableName}`);

  let upserted = 0;
  let skippedNoUser = 0;
  let skippedBadRow = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const displayId =
      tableName === 'legacy_spot_history' ? extractSpotDisplayId(row) : extractDisplayId(row);
    if (!displayId) {
      skippedBadRow++;
      continue;
    }

    const user = await prisma.users.findFirst({
      where: { display_id: { equals: displayId, mode: 'insensitive' } },
      select: { id: true, display_id: true },
    });

    if (!user) {
      skippedNoUser++;
      continue;
    }

    const rowIndex = i + 1;

    if (tableName === 'legacy_activation_history') {
      await prisma.$executeRaw`
        INSERT INTO legacy_activation_history (user_id, display_id, row_index, source_file, data)
        VALUES (${user.id}, ${user.display_id ?? displayId}, ${rowIndex}, ${sourceFile}, ${row as any})
        ON CONFLICT (source_file, row_index)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          display_id = EXCLUDED.display_id,
          data = EXCLUDED.data,
          imported_at = NOW();
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO legacy_spot_history (user_id, display_id, row_index, source_file, data)
        VALUES (${user.id}, ${user.display_id ?? displayId}, ${rowIndex}, ${sourceFile}, ${row as any})
        ON CONFLICT (source_file, row_index)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          display_id = EXCLUDED.display_id,
          data = EXCLUDED.data,
          imported_at = NOW();
      `;
    }

    upserted++;

    if (upserted % 500 === 0) {
      console.log(`  → ${tableName}: processed ${upserted} rows so far...`);
    }
  }

  console.log(`✅ Done seeding ${tableName}`);
  console.log({
    table: tableName,
    upserted,
    skippedNoUser,
    skippedBadRow,
    totalRows: rows.length,
    sourceFile,
  });
}

async function main() {
  const activationArg = process.argv[2];
  const spotArg = process.argv[3];

  const defaultActivationPath = path.resolve(process.cwd(), '..', 'Activation History Old Data As per New Excel.xlsx');
  const defaultSpotPath = path.resolve(process.cwd(), '..', 'Spot All Histry As Per New Excel.xlsx');

  const activationPath = path.resolve(activationArg || defaultActivationPath);
  const spotPath = path.resolve(spotArg || defaultSpotPath);

  console.log('🗄 Using database:', process.env.DATABASE_URL || '(from .env)');

  await importExcelToTable({ tableName: 'legacy_activation_history', filePath: activationPath });
  await importExcelToTable({ tableName: 'legacy_spot_history', filePath: spotPath });

  console.log('\n🎉 Legacy activation + spot history seeding complete.');
}

main()
  .catch((err) => {
    console.error('❌ Legacy history seed failed:', err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

