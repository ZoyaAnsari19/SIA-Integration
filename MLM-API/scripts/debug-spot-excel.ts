/// <reference types="node" />

import path from 'path';
import xlsx from 'xlsx';

function main() {
  const defaultSpotPath = path.resolve(process.cwd(), '..', 'Spot All Histry As Per New Excel.xlsx');
  const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSpotPath;

  console.log('Reading file:', filePath);
  const wb = xlsx.readFile(filePath, { cellDates: true });
  console.log('Sheets:', wb.SheetNames);

  const sheetName = wb.SheetNames.find((n) => /spot/i.test(n)) ?? wb.SheetNames[0];
  console.log('Using sheet:', sheetName);

  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  console.log('Total rows:', rows.length);
  console.log('First row keys:', Object.keys(rows[0] || {}));
  console.log('Sample rows (first 3):');
  console.dir(rows.slice(0, 3), { depth: null });
}

main();

