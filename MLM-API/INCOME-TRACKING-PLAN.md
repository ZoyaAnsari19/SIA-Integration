# Income Tracking Per Package - Implementation Plan

## 📋 Requirements

1. **Daily Income Tracking:** Har package ke liye `income` column me daily commissions add karna (12:05 AM)
2. **2x Check:** `income` column se 2x check karna (ledger_entries se calculate karne ki zarurat nahi)
3. **Renewal Reset:** Renewal pe `income` reset to 0 karna, taaki phir se 2x tak commissions aaye

---

## 🔧 Changes Needed

### 1. Database Schema Update

**Add `income` column to `purchases` table:**

```sql
ALTER TABLE purchases 
ADD COLUMN income DECIMAL(18, 2) DEFAULT 0;
```

**Or via Prisma migration:**
```prisma
model purchases {
  // ... existing fields ...
  income              Decimal      @default(0) @db.Decimal(18, 2)  // NEW: Track SELF + GLOBAL_HELPING income
}
```

---

### 2. Daily Commission Update

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Function:** `creditDailyCommissions()`

**Change:** After crediting SELF or GLOBAL_HELPING commission, update `purchase.income`:

```typescript
// After crediting commission (line ~680)
if (row.commission_type === 'SELF' || row.commission_type === 'GLOBAL_HELPING') {
  if (row.purchase_id) {
    // Update purchase income
    await prisma.purchases.update({
      where: { id: row.purchase_id },
      data: {
        income: {
          increment: amount // Add today's commission to income
        }
      }
    });
  }
}
```

---

### 3. 2x Check Using Income Column

**File:** `MLM-API/src/modules/commissions/commission.service.ts`

**Function:** `isPurchaseDoubleReached()`

**Change:** Use `purchase.income` instead of calculating from `ledger_entries`:

```typescript
static async isPurchaseDoubleReached(purchaseId: bigint): Promise<boolean> {
  const purchase = await prisma.purchases.findUnique({
    where: { id: purchaseId },
    select: { amount: true, user_id: true, income: true }, // Add income
  });
  if (!purchase) return false;

  const investmentAmount = Number(purchase.amount);
  const doubleAmount = investmentAmount * 2;
  const currentIncome = Number(purchase.income || 0); // Use income column
  
  const isReached = currentIncome >= doubleAmount;
  
  if (isReached) {
    // ... update active_until ...
  }
  
  return isReached;
}
```

**Benefits:**
- ✅ Faster (no ledger_entries query)
- ✅ Accurate (direct from purchase table)
- ✅ Simpler logic

---

### 4. Renewal Reset Income

**File:** `MLM-API/src/routes/admin-purchase-requests.ts`

**Function:** Purchase approval (renewal case)

**Change:** When creating renewal purchase, set `income = 0`:

```typescript
// When creating renewal purchase (line ~407)
const purchase = await prisma.purchases.create({
  data: {
    user_id: request.user_id,
    package_id: request.package_id,
    amount: Number(request.amount),
    purchased_at: purchasedAt,
    active_until: activeUntil,
    // ... other fields ...
    is_renewal: isRenewal,
    previous_package_id: previousPackageId,
    effective_global_ids: effectiveGlobalIds,
    status: 'completed',
    income: 0, // NEW: Reset income to 0 for renewal
  },
});
```

---

## 📊 Flow Diagram

### Daily Commission Flow:
```
12:05 AM → creditDailyCommissions()
  ↓
For each SELF/GLOBAL commission:
  ↓
1. Check 2x (using purchase.income)
  ↓
2. If not 2x:
   - Credit to ledger_entries
   - Update user wallet
   - Update purchase.income += amount  ← NEW
  ↓
3. If 2x:
   - Skip commission
   - Update purchase.active_until = today
```

### Renewal Flow:
```
User renews package
  ↓
Admin approves renewal
  ↓
Create new purchase:
  - income = 0  ← Reset
  - is_renewal = true
  - previous_package_id = old purchase
  ↓
handlePurchase() called
  ↓
New scheduled commissions created
  ↓
Daily commissions start again
  ↓
Income accumulates from 0
  ↓
When income >= 2x → Expire
```

---

## ✅ Benefits

1. **Performance:** No need to query `ledger_entries` for 2x check
2. **Accuracy:** Direct income tracking per package
3. **Simplicity:** Single column check instead of complex aggregation
4. **Renewal Support:** Easy reset on renewal

---

## 🧪 Testing

1. **Daily Update Test:**
   - Verify `purchase.income` increases daily
   - Check amount matches ledger_entries

2. **2x Check Test:**
   - Verify 2x check uses `income` column
   - Verify purchase expires when `income >= 2x`

3. **Renewal Test:**
   - Create renewal purchase
   - Verify `income = 0`
   - Verify commissions start again
   - Verify 2x check works for new purchase

---

## 📝 Implementation Steps

1. ✅ Add `income` column to schema
2. ✅ Update `creditDailyCommissions()` to increment income
3. ✅ Update `isPurchaseDoubleReached()` to use income column
4. ✅ Reset income to 0 on renewal
5. ✅ Test daily update
6. ✅ Test 2x check
7. ✅ Test renewal reset

---

**Status:** Plan Ready for Implementation ✅

