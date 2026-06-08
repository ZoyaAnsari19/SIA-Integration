# Write tools E2E (admin)

- Generated at: `2026-04-26T21:53:25`

- Passed: **9 / 10**

- Skipped: **1**


## Results

| Status | ID | Title | Notes |
|---|---|---|---|
| PASS | S01 | Approve 1 pending KYC |  |
| PASS | S02 | Cancel approve 1 pending KYC |  |
| PASS | S03 | Approve 2 pending KYCs |  |
| PASS | S04 | List pending KYCs (should not ask IDs) |  |
| PASS | S05 | Wallet manage (no-op 0 amounts) |  |
| PASS | S06 | Wallet manage cancel |  |
| SKIP | S07 | Approve withdrawals by date cancel | no_pending_withdrawals_today_or_model_did_not_propose_write |
| PASS | S08 | Approve withdrawals by date (spot) max 1 |  |
| PASS | S09 | Approve one pending withdrawal by id |  |
| PASS | S10 | Reject one pending withdrawal by id (cancel) |  |

## Raw JSON report

- `write-e2e-20260426_215325.json`
