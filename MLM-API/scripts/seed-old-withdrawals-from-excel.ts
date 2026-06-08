/// <reference types="node" />
/**
 * Seed old withdrawal history (Excel export) into withdraw_requests table.
 *
 * هدف:
 * - Old system ki withdrawal history ko new system me dikhana
 * - Spot/Team limit ke liye past withdrawals track ho sake (via withdraw_requests)
 *
 * Safety:
 * - Duplicate-safe via reference_id = `OLD:<displayId>:<rowIndex>`
 * - If user not found, row is skipped (logged)
 *
 * Usage (local only):
 *   npx tsx scripts/seed-old-withdrawals-from-excel.ts "/absolute/path/to/file.xlsx"
 *
 * Default file (if arg missing):
 *   repo root / OLD DATA WITHDRAW AS PER NEW EXCEL.xlsx
 */

import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import { prisma } from '../src/config/prisma.js';

type OldRow = {
  'User ID'?: string;
  'Amount (₹)'?: number;
  'Withdraw Amount'?: number;
  'Wallet type'?: string;
  'Payment Method'?: string;
  'Account Details'?: string;
  'Ac hldr'?: string;
  Status?: string;
  'Request Date'?: any;
  'Processed Date'?: any;
};

function parseDisplayId(userIdCell: unknown): string | null {
  if (typeof userIdCell !== 'string') return null;
  const trimmed = userIdCell.trim();
  if (!trimmed) return null;
  // Excel format: "SIA00021 - Name ..." or sometimes just "SIA00021"
  const first = trimmed.split(/\s+/)[0];
  const displayId = first.replace(/[^A-Za-z0-9]/g, '');
  return displayId || null;
}

function parseExcelDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    // Excel serial date
    const d = xlsx.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0));
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // dd-mm-yyyy
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yy = Number(m[3]);
      return new Date(yy, mm - 1, dd);
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function mapStatus(status: unknown): 'approved' | 'rejected' | 'pending' {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'approve' || s === 'approved') return 'approved';
  if (s === 'reject' || s === 'rejected') return 'rejected';
  return 'pending';
}

function mapWithdrawType(walletType: unknown): 'spot' | 'wallet' | 'team_royalty' {
  // Excel me: main_wallet + spot_wallet
  // - main_wallet  -> new system "wallet" (Main)
  // - spot_wallet  -> new system "spot"
  const s = String(walletType || '').toLowerCase().trim();
  if (s.includes('spot')) return 'spot';
  if (s.includes('main')) return 'wallet';
  return 'wallet';
}

async function main() {
  const fileArg = process.argv[2];
  const defaultPath = path.resolve(process.cwd(), '..', 'OLD DATA WITHDRAW AS PER NEW EXCEL.xlsx');
  const filePath = path.resolve(fileArg || defaultPath);

  if (!fs.existsSync(filePath)) {
    console.error('❌ Excel file not found:', filePath);
    process.exit(1);
  }

  console.log('📄 Reading Excel:', filePath);
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<OldRow>(sheet, { defval: null });

  console.log(`📊 Rows: ${rows.length}, sheet: ${sheetName}`);

  let inserted = 0;
  let updated = 0;
  let skippedNoUser = 0;
  let skippedBadRow = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const displayId = parseDisplayId(r['User ID']);
    if (!displayId) {
      skippedBadRow++;
      continue;
    }

    const user = await prisma.users.findFirst({
      where: { display_id: displayId },
      select: { id: true, display_id: true },
    });
    if (!user) {
      skippedNoUser++;
      continue;
    }

    const amount =
      (r['Withdraw Amount'] != null ? Number(r['Withdraw Amount']) : null) ??
      (r['Amount (₹)'] != null ? Number(r['Amount (₹)']) : null) ??
      0;
    if (!Number.isFinite(amount) || amount <= 0) {
      skippedBadRow++;
      continue;
    }

    const status = mapStatus(r.Status);
    const withdrawType = mapWithdrawType(r['Wallet type']);
    const paymentMethod = (r['Payment Method'] ? String(r['Payment Method']) : 'Bank').trim() || 'Bank';

    const createdAt = parseExcelDate(r['Request Date']) ?? new Date();
    const processedAt =
      status === 'approved' || status === 'rejected'
        ? parseExcelDate(r['Processed Date']) ?? createdAt
        : null;

    const referenceId = `OLD:${displayId}:${i + 1}`;
    const existing = await prisma.withdraw_requests.findFirst({
      where: { reference_id: referenceId },
      select: { id: true },
    });

    const accountDetails = JSON.stringify({
      raw: r['Account Details'] != null ? String(r['Account Details']) : null,
      ac_holder: r['Ac hldr'] != null ? String(r['Ac hldr']) : null,
      source: 'old_excel_import',
      display_id: displayId,
    });

    if (existing) {
      await prisma.withdraw_requests.update({
        where: { id: existing.id },
        data: {
          user_id: user.id,
          withdraw_type: withdrawType as any,
          amount,
          payment_method: paymentMethod,
          account_details: accountDetails,
          status,
          processed_at: processedAt,
          updated_at: processedAt ?? createdAt,
        },
      });
      updated++;
    } else {
      await prisma.withdraw_requests.create({
        data: {
          user_id: user.id,
          withdraw_type: withdrawType as any,
          amount,
          payment_method: paymentMethod,
          account_details: accountDetails,
          status,
          reference_id: referenceId,
          processed_at: processedAt,
          // processed_by: leave null (old system)
          created_at: createdAt,
          updated_at: processedAt ?? createdAt,
        },
      });
      inserted++;
    }
  }

  console.log('✅ Done');
  console.log({
    inserted,
    updated,
    skippedNoUser,
    skippedBadRow,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

