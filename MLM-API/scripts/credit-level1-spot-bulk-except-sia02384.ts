/**
 * One-off: Credit Level 1 (and one Direct) SPOT entries to users' spot wallet + ledger.
 * List from user: all entries EXCEPT BHUSHAN MARGHADE (SIA02384) Level 1 ₹750 21 Feb 2026 07:12 pm.
 *
 * Uses addLedgerAndWallet → ledger_entries + wallet_transactions + user_balances (spot_balance).
 * Source/purchase: from pending_commissions if found for (receiver, amount, level), else admin (1) + null.
 *
 * Local: DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission npx tsx scripts/credit-level1-spot-bulk-except-sia02384.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

// [displayId, level (1 = Level 1, 0 = Direct), amount, creditedAt ISO]
// EXCLUDED: SIA02384 Level 1 750 21 Feb 2026 07:12 pm
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
  const displayIds = [...new Set(ENTRIES.map((e) => e[0]))];
  const users = await prisma.users.findMany({
    where: { display_id: { in: displayIds } },
    select: { id: true, display_id: true },
  });
  const userByDisplayId = new Map(users.map((u) => [u.display_id ?? '', u.id]));

  let ok = 0;
  let skip = 0;
  let err = 0;

  for (let i = 0; i < ENTRIES.length; i++) {
    const [displayId, level, amount, creditedAtStr] = ENTRIES[i];
    const userId = userByDisplayId.get(displayId);
    if (!userId) {
      console.log(`Skip ${i + 1}: ${displayId} not found`);
      skip++;
      continue;
    }
    const receiverId = BigInt(userId);
    const creditedAt = new Date(creditedAtStr);

    let sourceId = ADMIN_USER_ID;
    let purchaseId: bigint | null = null;
    const pending = await prisma.pending_commissions.findFirst({
      where: {
        receiver_user_id: receiverId,
        level: level,
        amount,
      },
    });
    if (pending) {
      sourceId = BigInt(pending.source_user_id);
      purchaseId = pending.purchase_id != null ? BigInt(pending.purchase_id) : null;
    }

    const idempotencyKey = `manual:spot-bulk:${i}:${receiverId}:${amount}:${creditedAtStr}`;
    try {
      await addLedgerAndWallet({
        receiverId,
        sourceId,
        purchaseId,
        amount,
        type: 'SPOT',
        metadata: { level, manual_credit_reason: 'Level 1 release bulk (except SIA02384 750)' },
        idempotencyKey,
        creditedAt,
      });
      ok++;
      console.log(`  ${i + 1}. ${displayId} L${level} ₹${amount} credited`);
    } catch (e: any) {
      if (e?.code === 'P2002' || (e?.message && e.message.includes('unique') && e.message.includes('idempotency'))) {
        console.log(`  ${i + 1}. ${displayId} L${level} ₹${amount} already exists (idempotent)`);
        ok++;
      } else {
        console.error(`  ${i + 1}. ${displayId} L${level} ₹${amount} failed:`, e?.message || e);
        err++;
      }
    }
  }

  console.log('\nDone. Credited:', ok, 'Skipped (user not found):', skip, 'Errors:', err);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
