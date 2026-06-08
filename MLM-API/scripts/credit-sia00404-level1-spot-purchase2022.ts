/**
 * One-off: Credit Level 1 SPOT to SIA00404 (385) for purchase 2022 (SIA02384, 2326).
 * Amount: 2.5% of 30000 = 750. credited_at = purchase date so hold/display is correct.
 *
 * IMPACT (only these change; nothing else affected):
 *   - 1 row inserted: ledger_entries (receiver 385, source 2326, purchase 2022, SPOT 750)
 *   - 1 row inserted: wallet_transactions (linked to that ledger)
 *   - user_balances for user 385: balance and spot_balance each +750
 *
 * IDEMPOTENT: idempotency_key = 'manual:teamspot:2:2022:385'. If run again, no duplicate
 * (addLedgerAndWallet returns existing entry and does not double-credit).
 *
 * Local:  DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission npx tsx scripts/credit-sia00404-level1-spot-purchase2022.ts
 * Prod:   From mlm-api pod: npx tsx scripts/credit-sia00404-level1-spot-purchase2022.ts  (uses pod DATABASE_URL)
 */
import { addLedgerAndWallet } from '../src/utils/wallet.js';

const RECEIVER_ID = BigInt(385);   // SIA00404
const SOURCE_ID = BigInt(2326);    // SIA02384
const PURCHASE_ID = BigInt(2022);
const AMOUNT = 750;                // 2.5% of 30000
const CREDITED_AT = new Date('2026-02-16T04:09:45.000Z');
const IDEMPOTENCY_KEY = 'manual:teamspot:2:2022:385';

async function main() {
  console.log('Crediting Level 1 SPOT to SIA00404 (385) for purchase 2022 (SIA02384)...');
  console.log('Amount:', AMOUNT, 'credited_at:', CREDITED_AT.toISOString());

  const entry = await addLedgerAndWallet({
    receiverId: RECEIVER_ID,
    sourceId: SOURCE_ID,
    purchaseId: PURCHASE_ID,
    amount: AMOUNT,
    type: 'SPOT',
    metadata: {
      level: 1,
      depth: 2,
      is_reinvestment: false,
      manual_credit_reason: 'SIA00404 Level 1 SPOT missed for purchase 2022 (SIA02384)',
    },
    idempotencyKey: IDEMPOTENCY_KEY,
    creditedAt: CREDITED_AT,
  });

  console.log('Done. Ledger entry id:', entry.id.toString());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
