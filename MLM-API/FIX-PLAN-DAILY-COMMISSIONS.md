# Daily Commissions Fix Plan

## 📋 Overview

This document outlines the complete plan to fix daily commission processing for SELF and GLOBAL_HELPING commissions.

**Key Requirements:**
- Daily commissions should credit at 12:05 AM
- SELF commission: Calculated from `price × self_roi_percent / 100` (monthly amount divided by days in month)
- GLOBAL_HELPING commission: ₹6.25 per global ID per month (divided by days in month, multiplied by current global user count)
- Package expires when SELF + GLOBAL_HELPING reaches 2x investment (not by validity date)

---

## 🔍 Current Issues

### Issue 1: Daily Commission Job Not Scheduled
- **Status:** Worker registered but schedule missing
- **Location:** `MLM-API/src/jobs/index.ts`
- **Problem:** `boss.schedule('daily-commission', '5 0 * * *')` call missing
- **Impact:** Daily commissions not running automatically

### Issue 2: SELF Monthly Calculation
- **Status:** Code checks `pkg.self_monthly` from DB (which is NULL)
- **Location:** `MLM-API/src/modules/commissions/commission.service.ts` (Line 87)
- **Problem:** Should calculate dynamically: `price × self_roi_percent / 100`
- **Impact:** Scheduled commissions not created for SELF

### Issue 3: GLOBAL_HELPING Per-ID Rate
- **Status:** Code checks `pkg.global_monthly_per_id` from DB (which is NULL)
- **Location:** `MLM-API/src/modules/commissions/commission.service.ts` (Line 102)
- **Problem:** Should be hardcoded constant: `6.25` (₹6.25 per global ID per month)
- **Impact:** Scheduled commissions not created for GLOBAL_HELPING

### Issue 4: Package Status Not Updated on 2x
- **Status:** Commissions stop but purchase not marked as expired
- **Location:** `MLM-API/src/modules/commissions/commission.service.ts` (Line 354-395)
- **Problem:** `isPurchaseDoubleReached()` doesn't update `purchase.active_until`
- **Impact:** Package remains "active" even after reaching 2x

### Issue 5: Existing Purchases Missing Scheduled Commissions
- **Status:** 96 active purchases, 0 scheduled commissions
- **Problem:** Purchases processed before fixes, no scheduled commissions created
- **Impact:** No daily commissions for existing users

---

## ✅ Fix Plan

### Fix 1: SELF Monthly Calculation - Dynamic in Code

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Location:** Line 86-98

**Current Code:**
```typescript
// 1) Schedule SELF (use purchase date for daily amount calculation)
if (pkg.self_monthly) {  // ❌ Checks DB field (NULL)
  await CommissionService.ensureScheduledCommission({
    receiver_user_id: buyerId,
    source_user_id: buyerId,
    purchase_id: purchase.id as unknown as bigint,
    commission_type: 'SELF',
    monthly_amount: Number(pkg.self_monthly),  // ❌ NULL value
    start_date: startDate,
    end_date: endDate,
    idempotency_key: `sch:self:${purchase.id}`,
  }, purchaseDate);
}
```

**New Code:**
```typescript
// 1) Schedule SELF (use purchase date for daily amount calculation)
// Calculate self_monthly dynamically: price × self_roi_percent / 100
if (pkg.self_roi_percent) {
  const selfMonthly = Number(pkg.price) * Number(pkg.self_roi_percent) / 100;
  await CommissionService.ensureScheduledCommission({
    receiver_user_id: buyerId,
    source_user_id: buyerId,
    purchase_id: purchase.id as unknown as bigint,
    commission_type: 'SELF',
    monthly_amount: selfMonthly, // ✅ Dynamically calculated
    start_date: startDate,
    end_date: endDate,
    idempotency_key: `sch:self:${purchase.id}`,
  }, purchaseDate);
}
```

**Formula:**
- `self_monthly = price × self_roi_percent / 100`
- Example: ₹15,000 × 3.5% = ₹525/month
- Daily: ₹525 / days_in_month (varies by month: 31/30/28 days)

---

### Fix 2: GLOBAL_HELPING Per-ID Rate - Hardcoded Constant

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Location:** Line 100-113

**Current Code:**
```typescript
// 2) Schedule GLOBAL_HELPING with DYNAMIC progressive calculation
// Store per-ID rate in monthly_amount, actual count will be calculated daily
if (pkg.global_ids && pkg.global_monthly_per_id) {  // ❌ Checks DB field (NULL)
  await CommissionService.ensureScheduledCommission({
    receiver_user_id: buyerId,
    source_user_id: buyerId,
    purchase_id: purchase.id as unknown as bigint,
    commission_type: 'GLOBAL_HELPING',
    monthly_amount: Number(pkg.global_monthly_per_id), // ❌ NULL value
    start_date: startDate,
    end_date: endDate,
    idempotency_key: `sch:global:${purchase.id}`,
  }, purchaseDate);
}
```

**New Code:**
```typescript
// 2) Schedule GLOBAL_HELPING with DYNAMIC progressive calculation
// Store per-ID rate in monthly_amount, actual count will be calculated daily
// Fixed rate: ₹6.25 per global ID per month (625 paise)
const GLOBAL_MONTHLY_PER_ID = 6.25; // Fixed constant for all packages

if (pkg.global_ids) {
  await CommissionService.ensureScheduledCommission({
    receiver_user_id: buyerId,
    source_user_id: buyerId,
    purchase_id: purchase.id as unknown as bigint,
    commission_type: 'GLOBAL_HELPING',
    monthly_amount: GLOBAL_MONTHLY_PER_ID, // ✅ Hardcoded ₹6.25
    start_date: startDate,
    end_date: endDate,
    idempotency_key: `sch:global:${purchase.id}`,
  }, purchaseDate);
}
```

**Formula:**
- `global_monthly_per_id = 6.25` (fixed for all packages)
- Daily per ID: `6.25 / days_in_month`
- Total daily: `(6.25 / days_in_month) × current_global_user_count` (capped at package.global_ids)
- Progressive: Global user count increases daily → daily amount increases

---

### Fix 3: Daily Commission Job Schedule

**File:** `MLM-API/src/jobs/index.ts`

**Location:** After line 29

**Current Code:**
```typescript
await registerDailyCommission();
console.log('  ✅ Daily commission worker registered');
// ❌ Missing: boss.schedule() call
```

**New Code (TEST - 2 minutes):**
```typescript
await registerDailyCommission();
console.log('  ✅ Daily commission worker registered');

// TEST: Schedule for 2 minutes (for testing)
await boss.schedule('daily-commission', '*/2 * * * *');
console.log('  ✅ Daily commission scheduled (TEST: every 2 minutes)');
```

**After Testing Passes:**
```typescript
// PRODUCTION: Change to 12:05 AM daily
await boss.schedule('daily-commission', '5 0 * * *');
console.log('  ✅ Daily commission scheduled (PRODUCTION: 12:05 AM daily)');
```

**Cron Schedule:**
- Test: `*/2 * * * *` = Every 2 minutes
- Production: `5 0 * * *` = 00:05 AM daily (12:05 AM IST)

---

### Fix 4: 2x Purchase Update Logic

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Location:** Line 388-394 (in `isPurchaseDoubleReached` function)

**Current Code:**
```typescript
const isReached = combinedTotal >= doubleAmount;

if (isReached) {
  console.log(`    📊 Purchase ${purchaseId}: ... REACHED`);
  // ❌ Missing: Purchase status update
}

return isReached;
```

**New Code:**
```typescript
const isReached = combinedTotal >= doubleAmount;

if (isReached) {
  console.log(`    📊 Purchase ${purchaseId}: Invested ₹${investmentAmount}, SELF: ₹${selfTotal.toFixed(2)}, GLOBAL: ₹${globalTotal.toFixed(2)}, Combined: ₹${combinedTotal.toFixed(2)}, Double: ₹${doubleAmount.toFixed(2)} - REACHED`);
  
  // Mark purchase as expired (update active_until to today)
  const currentPurchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: { active_until: true }
  });
  
  if (currentPurchase && currentPurchase.active_until > new Date()) {
    await prisma.purchases.update({
      where: { id: purchaseId },
      data: { active_until: new Date() } // Mark as expired today
    });
    console.log(`    ✅ Purchase ${purchaseId} marked as expired (reached 2x)`);
  }
}

return isReached;
```

**Logic:**
- When SELF + GLOBAL_HELPING >= 2x purchase amount
- Update `purchase.active_until = current_date`
- Package becomes "expired" (not by validity date, but by 2x)

---

### Fix 5: Reprocess Existing Purchases

**File:** `MLM-API/scripts/reprocess-purchases.ts` (NEW FILE)

**Purpose:** Create scheduled commissions for existing active purchases

**Script Content:**
```typescript
import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function reprocessPurchases() {
  try {
    const purchases = await prisma.purchases.findMany({
      where: { 
        status: 'completed',
        active_until: { gte: new Date() }
      },
      orderBy: { purchased_at: 'asc' }
    });
    
    console.log(`Found ${purchases.length} active purchases to reprocess`);
    
    for (const purchase of purchases) {
      try {
        console.log(`\nProcessing Purchase ID: ${purchase.id}, User: ${purchase.user_id}`);
        const result = await CommissionService.handlePurchase(purchase.id as unknown as bigint);
        console.log(`  ✅ Processed: ${result.ok ? 'Success' : result.message}`);
      } catch (error: any) {
        console.error(`  ❌ Error processing purchase ${purchase.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ All purchases processed!`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessPurchases();
```

**Usage:**
```bash
cd MLM-API
npx tsx scripts/reprocess-purchases.ts
```

---

## 📊 Implementation Summary

| # | Fix | File | Line | Change Type |
|---|-----|------|------|-------------|
| 1 | SELF monthly calculation | `commission.service.ts` | 86-98 | Calculate dynamically |
| 2 | GLOBAL per-ID hardcode | `commission.service.ts` | 100-113 | Add constant `6.25` |
| 3 | Daily job schedule | `src/jobs/index.ts` | After 29 | Add `boss.schedule()` |
| 4 | 2x purchase update | `commission.service.ts` | 388-394 | Update `active_until` |
| 5 | Reprocess purchases | New script | - | Create scheduled commissions |

---

## 🧪 Testing Plan

### Phase 1: Code Changes
1. ✅ Update `handlePurchase()` - SELF calculation
2. ✅ Update `handlePurchase()` - GLOBAL constant
3. ✅ Update `startJobs()` - Add schedule (2 min test)
4. ✅ Update `isPurchaseDoubleReached()` - Purchase update

### Phase 2: Data Migration
5. ✅ Run reprocess script for existing purchases
6. ✅ Verify `scheduled_commissions` entries created

### Phase 3: Testing
7. ✅ Wait 2 minutes → verify job runs
8. ✅ Check `ledger_entries` → verify commissions credited
9. ✅ Check `purchase.active_until` → verify 2x update
10. ✅ Verify daily amounts (SELF and GLOBAL)

### Phase 4: Production
11. ✅ Change schedule to `5 0 * * *` (12:05 AM)
12. ✅ Monitor first day execution

---

## 📝 Detailed Code Changes

### Change 1: SELF Commission Calculation

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Before:**
```typescript
if (pkg.self_monthly) {
  await CommissionService.ensureScheduledCommission({
    ...
    monthly_amount: Number(pkg.self_monthly),
    ...
  }, purchaseDate);
}
```

**After:**
```typescript
if (pkg.self_roi_percent) {
  const selfMonthly = Number(pkg.price) * Number(pkg.self_roi_percent) / 100;
  await CommissionService.ensureScheduledCommission({
    ...
    monthly_amount: selfMonthly,
    ...
  }, purchaseDate);
}
```

---

### Change 2: GLOBAL_HELPING Constant

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Before:**
```typescript
if (pkg.global_ids && pkg.global_monthly_per_id) {
  await CommissionService.ensureScheduledCommission({
    ...
    monthly_amount: Number(pkg.global_monthly_per_id),
    ...
  }, purchaseDate);
}
```

**After:**
```typescript
const GLOBAL_MONTHLY_PER_ID = 6.25; // Fixed: ₹6.25 per global ID per month

if (pkg.global_ids) {
  await CommissionService.ensureScheduledCommission({
    ...
    monthly_amount: GLOBAL_MONTHLY_PER_ID,
    ...
  }, purchaseDate);
}
```

---

### Change 3: Daily Job Schedule

**File:** `MLM-API/src/jobs/index.ts`

**Add after line 29:**
```typescript
await registerDailyCommission();
console.log('  ✅ Daily commission worker registered');

// TEST: Schedule for 2 minutes
await boss.schedule('daily-commission', '*/2 * * * *');
console.log('  ✅ Daily commission scheduled (TEST: every 2 minutes)');
```

---

### Change 4: 2x Purchase Update

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Add in `isPurchaseDoubleReached()` function after line 390:**
```typescript
if (isReached) {
  console.log(`    📊 Purchase ${purchaseId}: ... REACHED`);
  
  // Mark purchase as expired
  const currentPurchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: { active_until: true }
  });
  
  if (currentPurchase && currentPurchase.active_until > new Date()) {
    await prisma.purchases.update({
      where: { id: purchaseId },
      data: { active_until: new Date() }
    });
    console.log(`    ✅ Purchase ${purchaseId} marked as expired (reached 2x)`);
  }
}
```

---

## 🔄 Daily Commission Flow

### How It Works:

1. **Purchase Approve:**
   - `handlePurchase()` called
   - Calculate `self_monthly = price × self_roi_percent / 100`
   - Use `GLOBAL_MONTHLY_PER_ID = 6.25`
   - Create entries in `scheduled_commissions` table

2. **Daily 12:05 AM:**
   - `creditDailyCommissions()` runs
   - Fetch active `scheduled_commissions`
   - For each entry:
     - **SELF:** `monthly_amount / days_in_current_month` = daily amount
     - **GLOBAL:** `(6.25 / days_in_current_month) × global_user_count` = daily amount
     - Check 2x: If reached, skip commission and update purchase
     - Credit to `ledger_entries` and `user_balances`

3. **2x Check:**
   - Calculate: SELF + GLOBAL_HELPING from this purchase
   - If >= 2x purchase amount:
     - Skip commission
     - Update `purchase.active_until = today`
     - Package marked as expired

---

## 📈 Expected Results

### After Fixes:

**Example: User 50 (Platinum Package - ₹50,000)**

**SELF:**
- Monthly: ₹2,250 (50000 × 4.5%)
- December (31 days): ₹2,250 / 31 = ₹72.58/day
- Daily credit: ₹72.58

**GLOBAL_HELPING:**
- Per-ID monthly: ₹6.25
- Per-ID daily (Dec): ₹6.25 / 31 = ₹0.20/day per ID
- Global users (Dec 2): e.g., 88 users
- Cap: 1100 (package limit)
- Daily: ₹0.20 × 88 = ₹17.60

**Total Daily:** ₹72.58 + ₹17.60 = ₹90.18

**2x Check:**
- Target: ₹100,000 (2 × ₹50,000)
- Current: ₹136 (existing)
- After today: ₹136 + ₹90.18 = ₹226.18
- Status: Not reached → Continue

---

## ✅ Verification Checklist

- [ ] Code changes implemented
- [ ] Reprocess script created
- [ ] Existing purchases reprocessed
- [ ] `scheduled_commissions` entries created
- [ ] Daily job scheduled (2 min test)
- [ ] Job runs successfully
- [ ] Commissions credited to `ledger_entries`
- [ ] Wallet balances updated
- [ ] 2x check working (purchase update)
- [ ] Production schedule set (12:05 AM)

---

## 🚀 Implementation Order

1. **Fix 1 & 2:** Update `handlePurchase()` - SELF and GLOBAL calculation
2. **Fix 3:** Add daily job schedule (2 min test)
3. **Fix 4:** Add 2x purchase update logic
4. **Fix 5:** Create and run reprocess script
5. **Test:** Wait 2 minutes, verify commissions
6. **Production:** Change schedule to 12:05 AM

---

## 📌 Notes

- **No DB changes needed** - All calculations in code
- **Paise arithmetic** - Already implemented in `calculateDailyPaise()`
- **Progressive GLOBAL** - User count increases daily, amount increases
- **2x expiry** - Package expires when 2x reached, not by validity date
- **Per-purchase tracking** - Each purchase tracked separately via `purchase_id`

---

**Status:** Plan Ready for Review ✅

