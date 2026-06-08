/**
 * One-off: Credit SPOT to SIA00404 (385) only — list = this user's spot history.
 * All entries (amount + date) go to 385's spot wallet and ledger. Source = list row's display_id (source user).
 * EXCLUDED: SIA02384 Level 1 ₹750 21 Feb 2026 07:12 pm.
 *
 * Local: DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission npx tsx scripts/credit-sia00404-spot-history-from-list.ts
 * Prod:  After backup, set DATABASE_URL to production (or port-forward) then run this script, then run prod-remove-two-spot-sia00404.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

const RECEIVER_ID = BigInt(385); // SIA00404

// [source display_id, level, amount, creditedAt ISO] — EXCLUDED: SIA02384 750 21 Feb 07:12
const ENTRIES: [string, number, number, string][] = [
  ['SIA02069', 1, 62.5, '2026-02-22T06:58:00.000Z'],
  ['SIA00465', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00465', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00466', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00512', 1, 375, '2026-02-21T13:42:00.000Z'],
  ['SIA00519', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00539', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00555', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00555', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00571', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00610', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00648', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00675', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00762', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00767', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00861', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01053', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01098', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01140', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01141', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01189', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01192', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01309', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01601', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01790', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01817', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01846', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01945', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA01818', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00465', 1, 750, '2026-02-21T13:42:00.000Z'],
  ['SIA01140', 1, 31.25, '2026-02-21T13:42:00.000Z'],
  ['SIA00512', 1, 93.75, '2026-02-21T13:42:00.000Z'],
  ['SIA02098', 1, 375, '2026-02-21T13:42:00.000Z'],
  ['SIA02214', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA02246', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA02390', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  // SIA02384 750 EXCLUDED
  ['SIA02247', 1, 62.5, '2026-02-21T13:42:00.000Z'],
  ['SIA02407', 1, 187.5, '2026-02-21T13:42:00.000Z'],
  ['SIA00571', 1, 31.25, '2026-02-21T13:42:00.000Z'],
  ['SIA00477', 0, 125, '2026-02-14T12:05:00.000Z'], // Direct
];

const ADMIN_USER_ID = BigInt(1);

async function main() {
  const sourceDisplayIds = [...new Set(ENTRIES.map((e) => e[0]))];
  const users = await prisma.users.findMany({
    where: { display_id: { in: sourceDisplayIds } },
    select: { id: true, display_id: true },
  });
  const sourceIdByDisplayId = new Map(users.map((u) => [u.display_id ?? '', u.id]));

  let ok = 0;
  let skip = 0;
  let err = 0;
  let totalAmount = 0;

  for (let i = 0; i < ENTRIES.length; i++) {
    const [sourceDisplayId, level, amount, creditedAtStr] = ENTRIES[i];
    const sourceUserId = sourceIdByDisplayId.get(sourceDisplayId);
    const sourceId = sourceUserId != null ? BigInt(sourceUserId) : ADMIN_USER_ID;
    if (sourceUserId == null) skip++;
    const creditedAt = new Date(creditedAtStr);

    const idempotencyKey = `manual:spot-sia00404:${i}:${sourceId}:${amount}:${creditedAtStr}`;
    try {
      await addLedgerAndWallet({
        receiverId: RECEIVER_ID,
        sourceId,
        purchaseId: null,
        amount,
        type: 'SPOT',
        metadata: { level, manual_credit_reason: 'SIA00404 spot history from list (excl SIA02384 750)' },
        idempotencyKey,
        creditedAt,
      });
      ok++;
      totalAmount += amount;
      console.log(`  ${i + 1}. from ${sourceDisplayId} L${level} ₹${amount} → SIA00404`);
    } catch (e: any) {
      if (e?.code === 'P2002' || (e?.message && e.message.includes('unique') && e.message.includes('idempotency'))) {
        console.log(`  ${i + 1}. from ${sourceDisplayId} L${level} ₹${amount} already exists (idempotent)`);
        ok++;
        totalAmount += amount;
      } else {
        console.error(`  ${i + 1}. from ${sourceDisplayId} ₹${amount} failed:`, e?.message || e);
        err++;
      }
    }
  }

  console.log('\nDone. SIA00404 credited:', ok, 'entries, total ₹' + totalAmount.toFixed(2) + '. Skipped (source not found):', skip, 'Errors:', err);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
