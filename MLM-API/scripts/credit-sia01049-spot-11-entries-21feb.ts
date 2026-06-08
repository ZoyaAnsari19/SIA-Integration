/**
 * One-off: Credit 11 SPOT entries to SIA01049 matching screenshot (same amounts + 21 Feb 2026 7:12 pm IST).
 * Level 1 team SPOT: receiver SIA01049, source = buyer per row.
 * Uses metadata.manual_spot_credit_bypass_flush so spot_balance updates even if flush rules apply.
 *
 * Local:
 *   DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission npx tsx scripts/credit-sia01049-spot-11-entries-21feb.ts
 *
 * Stage (NOT production — use wrapper only):
 *   CONFIRM_STAGE=yes ./azure-kube-stage/run-credit-sia01049-spot-stage.sh
 *   (port-forward stage-mlm Postgres → localhost:5440, sets RUN_ON_STAGE=1)
 *
 * Production (backup first, then wrapper — see azure-kube/README.md):
 *   CONFIRM_PRODUCTION_SPOT=yes ./azure-kube/run-credit-sia01049-spot-production.sh
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

const RECEIVER_DISPLAY_ID = 'SIA01049';

/** 21 Feb 2026 7:12 pm IST = 13:42 UTC */
const CREDITED_AT_ISO = '2026-02-21T13:42:00.000Z';

// [source display_id, amount] — order matches screenshot (SIA01940 appears twice)
const ENTRIES: [string, number][] = [
  ['SIA01516', 2500.0],
  ['SIA01605', 187.5],
  ['SIA01761', 62.5],
  ['SIA01849', 62.5],
  ['SIA01943', 187.5],
  ['SIA01940', 375.0],
  ['SIA01940', 187.5],
  ['SIA02184', 375.0],
  ['SIA02171', 2500.0],
  ['SIA02264', 375.0],
  ['SIA01503', 187.5],
];

const ADMIN_USER_ID = BigInt(1);

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (process.env.RUN_ON_STAGE === '1' && process.env.RUN_ON_PRODUCTION_SPOT === '1') {
    console.error('Set only one of RUN_ON_STAGE or RUN_ON_PRODUCTION_SPOT.');
    process.exit(1);
  }
  if (process.env.RUN_ON_STAGE === '1') {
    if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
      console.error(
        'RUN_ON_STAGE=1 requires DATABASE_URL to use localhost/127.0.0.1 (stage port-forward). Refuse to run against a remote host.'
      );
      process.exit(1);
    }
    console.log('⚠️  STAGE DB (stage-mlm) — not production. Port-forward must be active.\n');
  }
  if (process.env.RUN_ON_PRODUCTION_SPOT === '1') {
    if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
      console.error(
        'RUN_ON_PRODUCTION_SPOT=1 requires DATABASE_URL to use localhost/127.0.0.1 (prod port-forward only).'
      );
      process.exit(1);
    }
    console.log('⚠️  PRODUCTION DB (namespace mlm) — live data. Port-forward must be active.\n');
  }

  const receiver = await prisma.users.findUnique({
    where: { display_id: RECEIVER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });
  if (!receiver) {
    console.error(`Receiver ${RECEIVER_DISPLAY_ID} not found.`);
    process.exit(1);
  }
  const receiverId = receiver.id as unknown as bigint;
  console.log('Receiver:', receiver.display_id, receiver.name, 'id=', receiverId.toString());

  const sourceDisplayIds = [...new Set(ENTRIES.map((e) => e[0]))];
  const users = await prisma.users.findMany({
    where: { display_id: { in: sourceDisplayIds } },
    select: { id: true, display_id: true },
  });
  const sourceIdByDisplayId = new Map(users.map((u) => [u.display_id ?? '', u.id]));

  const creditedAt = new Date(CREDITED_AT_ISO);
  let ok = 0;
  let skip = 0;
  let err = 0;
  let totalAmount = 0;

  for (let i = 0; i < ENTRIES.length; i++) {
    const [sourceDisplayId, amount] = ENTRIES[i];
    const sourceUserId = sourceIdByDisplayId.get(sourceDisplayId);
    const sourceId = sourceUserId != null ? BigInt(sourceUserId as bigint) : ADMIN_USER_ID;
    if (sourceUserId == null) {
      console.warn(`  Source ${sourceDisplayId} not found — using admin id`);
      skip++;
    }

    const idempotencyKey = `manual:spot-sia01049:21feb0712:${i}:${sourceId}:${amount}`;

    try {
      await addLedgerAndWallet({
        receiverId,
        sourceId,
        purchaseId: null,
        amount,
        type: 'SPOT',
        metadata: {
          level: 1,
          depth: 2,
          /** Required so spot_balance updates even if user has spot_team_flush_active / 15d limit */
          manual_spot_credit_bypass_flush: true,
          manual_credit_reason: 'SIA01049 11 SPOT rows same as reference screenshot 21 Feb 2026 7:12 pm IST',
        },
        idempotencyKey,
        creditedAt,
      });
      ok++;
      totalAmount += amount;
      console.log(`  ${i + 1}. from ${sourceDisplayId} L1 ₹${amount} → ${RECEIVER_DISPLAY_ID}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code;
      if (code === 'P2002' || msg.includes('unique') || msg.includes('idempotency')) {
        console.log(`  ${i + 1}. from ${sourceDisplayId} ₹${amount} already exists (skip)`);
        ok++;
      } else {
        console.error(`  ${i + 1}. failed:`, msg);
        err++;
      }
    }
  }

  console.log(
    '\nDone.',
    RECEIVER_DISPLAY_ID,
    'credited:',
    ok,
    'entries, total ₹' + totalAmount.toFixed(2) + '. Source missing (admin used):',
    skip,
    'Errors:',
    err
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
