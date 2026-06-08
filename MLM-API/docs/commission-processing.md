# Commission Processing — Atomic Precision and Progressive Global Helping

> **Status (2026):** Sections below that reference **`scheduled_commissions`** and “schedule at purchase time” describe the **legacy** design before **Dec 20, 2025**. Production now runs **`creditDailyCommissions`** on a cron with **no** `scheduled_commissions` table; SELF, GLOBAL_HELPING, and MONTHLY are computed each run. **GLOBAL_HELPING** uses **`getGlobalContributorWindowCounts`** — payout **`used_ids` = active contributors** (first qualifying purchase in the window still below 2×), capped. See `MLM-API/README.md` (Daily Commission Processing + May 2026 global update).

## Overview
This document explains the finalized implementation for daily commission processing with:
- Atomic, lossless rounding (paise-level precision)
- Pre-calculated daily amounts (using tomorrow’s month at schedule time)
- Progressive Global Helping (dynamic user counts, capped)
- Simplified daily worker logic

## Key Concepts
- All monthly amounts are converted to paise and divided by the number of days in the month of the next midnight (tomorrow’s month). The daily amount is stored alongside the schedule.
- The daily worker uses the stored daily amount, ensuring no re-computation or month confusion.
- Global Helping stores per-ID daily rate, then multiplies by the active global user count at midnight (capped by package configuration).

## Scheduling Logic (at Purchase Time)
1) Determine tomorrow’s midnight and its month day count
2) Compute daily amount with integer math (paise) to avoid rounding loss
3) Store into `scheduled_commissions`:
   - `monthly_amount`
   - `daily_amount` (pre-calculated)
   - `start_date`, `end_date`
   - `idempotency_key`

SELF example (₹2,500 package):
- Monthly: ₹62.50
- Tomorrow’s month days: e.g., 31 → daily = 6250 paise ÷ 31 = 201 paise → ₹2.01 (with last-day adjustment if needed)

GLOBAL_HELPING example:
- Per-ID monthly: ₹6.25 → per-ID daily stored as ₹6.25 ÷ days(tomorrow)

## Daily Worker Logic (00:05)
- Select `scheduled_commissions` active for the current date window
- Ensure both source and receiver are active
- Use stored `daily_amount`
- For `GLOBAL_HELPING`:
  - Determine per-ID daily rate from schedule
  - Count completed purchases up to now (excluding receiver), apply cap from package
  - Today’s amount = per-ID daily × effectiveUserCount
- Credit ledger + wallet (idempotent per day + schedule id)

## Atomic Precision (Rounding)
- All computations use paise (integers): multiply ₹ by 100, divide, then convert back
- Last-day behavior guarantees the monthly total equals exactly the configured amount when applicable
- Eliminates cumulative rounding drift

## Progressive Global Helping
- Progressive, date-based: counts contributors in the **same window** as package-status (first non-renewal purchase after the purchase’s start date through “now”)
- **Raw vs active:** **Raw** = distinct qualifying joiners in the window; **active** = those whose qualifying row still has `income < 2×` — **daily payout uses active**, capped by package / effective cap
- Enforces package cap on the **active** payout count; UI/API also expose raw, active, and **inactive** (`raw − active`) for transparency

## Benefits
- No rounding loss: exact monthly totals over time
- Deterministic, idempotent daily payouts
- Clean separation: schedule-time math vs runtime payout
- Scalable: simple worker; heavy math happens once at schedule-time

## Testing: Time-Travel Simulation

### Problem with Real-Time Testing
Real production systems require waiting for actual days to pass. To solve this:

### Solution: Time-Travel Testing
We've implemented a clock abstraction that allows testing without waiting:

**Clock Abstraction (`src/utils/clock.ts`):**
```typescript
export interface Clock {
  now(): Date;
  today(): Date;
}

export const SystemClock: Clock = {
  now: () => new Date(),
  today: () => { /* ... */ }
};

export class TestClock implements Clock {
  // Can set arbitrary dates for testing
  setTime(date: Date): void;
  advance(days: number): void;
}
```

**Updated Functions:**
- `getNextMidnight(baseDate?: Date)` - Accepts optional date
- `calculateDailyAmount(amount, calcDate?: Date)` - Accepts optional calculation date
- `CommissionService.creditDailyCommissions(asOfDate?: Date)` - Accepts optional "as of" date
- `ensureScheduledCommission(..., calcDate?: Date)` - Passes date to calculation

**Usage:**
```bash
# Time-travel to specific date
npx tsx scripts/run-daily-commission.ts 2025-10-31

# Run automated 90-day test
./scripts/time-travel-test.sh
```

### Test Script Features:
- ✅ Creates users and purchases on Oct 30, 2025
- ✅ Time-travels through 90 days (Oct 31 → Jan 29)
- ✅ Verifies progressive global helping (user count increases)
- ✅ Validates atomic precision (zero rounding loss)
- ✅ Checks all commission types (SELF, GLOBAL, SPOT, MONTHLY)
- ✅ Completes in seconds instead of 90 days

## Notes
- Simulation runs that process many days on the same calendar date will differ from real-time behavior (since real production runs once per day and counts evolve daily). Production behavior aligns with the business rules and this design.
- With time-travel testing, we can now validate the entire 3-month cycle instantly, ensuring atomic precision and progressive logic work correctly.
