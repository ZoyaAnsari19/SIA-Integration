# Package Status and Loss Tracking - Test Guide

## Overview
This document describes how to test the new Package Status and Loss Tracking features:
1. **Global IDs Tracking** - Shows remaining/used global IDs for active packages
2. **Expired Package Loss Calculation** - Shows day-wise potential income loss for expired packages

## Test Scenarios

### Scenario 1: Active Package with Global IDs Tracking

**Test Steps:**
1. Create a user and purchase a package
2. Check `GET /api/v1/my-course/:id` endpoint
3. Verify `global_ids_info` is present in response
4. Verify calculations match database

**Expected Response:**
```json
{
  "id": "1",
  "package_id": 1,
  "is_active": true,
  "global_ids_info": {
    "package_cap": 55,
    "used_ids": 42,
    "remaining_ids": 13,
    "is_cap_reached": false,
    "new_ids_after_cap": null
  }
}
```

**Database Verification:**
```sql
-- Check global users count
SELECT COUNT(*) 
FROM purchases 
WHERE status = 'completed' 
  AND user_id != <user_id> 
  AND purchased_at <= NOW();

-- Check package cap
SELECT 
  p.effective_global_ids,
  pk.global_ids
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = <purchase_id>;
```

### Scenario 2: Active Package with Cap Reached

**Test Steps:**
1. Create a package with small global_ids cap (e.g., 5)
2. Create 10+ purchases by other users
3. Check `global_ids_info` for the purchase
4. Verify `is_cap_reached: true` and `new_ids_after_cap` shows count

**Expected Response:**
```json
{
  "global_ids_info": {
    "package_cap": 5,
    "used_ids": 5,
    "remaining_ids": 0,
    "is_cap_reached": true,
    "new_ids_after_cap": 8
  }
}
```

### Scenario 3: Expired Package with Loss Calculation

**Test Steps:**
1. Create a user with purchase
2. Create downline users with active purchases
3. Expire the main user's package (set `active_until` to past date)
4. Create new downline purchases after expiry
5. Check `GET /api/v1/my-course/:id` endpoint
6. Verify `expiry_loss` is present

**Expected Response:**
```json
{
  "id": "1",
  "is_active": false,
  "expiry_loss": {
    "total_loss": 1250.50,
    "days_since_expiry": 15,
    "daily_breakdown": [
      {
        "day": 1,
        "date": "2025-01-16",
        "self_income": 2.08,
        "monthly_royalty": 45.50,
        "spot_income": 125.00,
        "total": 172.58
      }
    ]
  }
}
```

**Calculation Verification:**
- **SELF Income**: `package.self_monthly / days_in_month`
- **MONTHLY Royalty**: Sum of daily MONTHLY from active downline members
- **SPOT Income**: Sum of SPOT commissions from new downline purchases on that day

### Scenario 4: Edge Case - User with No Downline

**Test Steps:**
1. Create a user with no referrals
2. Create and expire a purchase
3. Check `expiry_loss`
4. Verify `monthly_royalty` and `spot_income` are 0

**Expected Response:**
```json
{
  "expiry_loss": {
    "daily_breakdown": [
      {
        "day": 1,
        "self_income": 2.08,
        "monthly_royalty": 0,
        "spot_income": 0,
        "total": 2.08
      }
    ]
  }
}
```

### Scenario 5: Multiple Purchases (List Endpoint)

**Test Steps:**
1. Create user with multiple purchases (some active, some expired)
2. Check `GET /api/v1/my-course` endpoint
3. Verify each purchase has appropriate info:
   - Active purchases: `global_ids_info`
   - Expired purchases: `expiry_loss`

## Test Scripts

### Simple Test (No Admin Required)
```bash
cd MLM-API
./scripts/test-package-status-simple.sh
```

This script:
- Finds existing user with purchase
- Tests login
- Checks all purchases for `global_ids_info` and `expiry_loss`
- Verifies in database
- Shows ledger entries

### Full Test (Requires Admin Token)
```bash
cd MLM-API
export ADMIN_TOKEN="your_admin_token"
./scripts/test-package-status-loss.sh
```

This script:
- Creates test users
- Creates purchases
- Tests global IDs tracking
- Expires packages
- Tests loss calculation
- Verifies all scenarios

## Manual Testing with curl

### 1. Get User's Purchases
```bash
curl -X GET "http://localhost:3000/api/v1/my-course" \
  -H "Authorization: Bearer <token>"
```

### 2. Get Specific Purchase Details
```bash
curl -X GET "http://localhost:3000/api/v1/my-course/<purchase_id>" \
  -H "Authorization: Bearer <token>"
```

### 3. Verify Global IDs in Database
```sql
-- Total global users (excluding self)
SELECT COUNT(*) 
FROM purchases 
WHERE status = 'completed' 
  AND user_id != <user_id> 
  AND purchased_at <= NOW();

-- Package details
SELECT 
  p.id,
  p.effective_global_ids,
  pk.global_ids,
  p.active_until,
  CASE WHEN p.active_until >= NOW() THEN 'Active' ELSE 'Expired' END as status
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = <purchase_id>;
```

### 4. Verify Loss Calculation Components

**SELF Income:**
```sql
SELECT 
  pk.self_monthly,
  EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) as days_in_month,
  pk.self_monthly / EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) as daily_self
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = <purchase_id>;
```

**MONTHLY Royalty (from downline):**
```sql
-- Active downline on a specific date
SELECT 
  COUNT(*) as active_downline_count,
  SUM(p.amount * pk.recurring_rate_percent / 100) as total_monthly
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
JOIN user_tree_paths utp ON p.user_id = utp.descendant_id
WHERE utp.ancestor_id = <user_id>
  AND utp.depth = 1
  AND p.status = 'completed'
  AND p.purchased_at <= '<target_date>'
  AND p.active_until >= '<target_date>';
```

**SPOT Income (new purchases on a date):**
```sql
-- New downline purchases on a specific date
SELECT 
  COUNT(*) as new_purchases,
  SUM(p.amount * 0.05) as total_spot -- 5% for direct referrer
FROM purchases p
JOIN user_tree_paths utp ON p.user_id = utp.descendant_id
WHERE utp.ancestor_id = <user_id>
  AND utp.depth = 1
  AND p.status = 'completed'
  AND DATE(p.purchased_at) = '<target_date>';
```

### 5. Verify Ledger Entries
```sql
-- Commission summary
SELECT 
  commission_type,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total_amount
FROM ledger_entries
WHERE receiver_user_id = <user_id>
GROUP BY commission_type
ORDER BY commission_type;
```

## Expected Behavior

### Global IDs Tracking
- ✅ Only shown for active purchases (`is_active: true`)
- ✅ `package_cap` = `effective_global_ids` (if renewal) or `package.global_ids` (if first purchase)
- ✅ `used_ids` = min(global_users_count, package_cap)
- ✅ `remaining_ids` = max(0, package_cap - used_ids)
- ✅ `new_ids_after_cap` only shown when `is_cap_reached: true`

### Expiry Loss Calculation
- ✅ Only shown for expired purchases (`is_active: false`)
- ✅ Calculated up to 20 days after expiry
- ✅ SELF income: Daily rate from `package.self_monthly`
- ✅ MONTHLY royalty: From active downline members on each day
- ✅ SPOT income: From new downline purchases on each day
- ✅ All amounts rounded to 2 decimal places

## Common Issues and Solutions

### Issue: `global_ids_info` not showing
**Solution:** Check if purchase is active:
```sql
SELECT active_until >= NOW() as is_active FROM purchases WHERE id = <purchase_id>;
```

### Issue: `expiry_loss` not showing
**Solution:** Check if purchase is expired:
```sql
SELECT active_until < NOW() as is_expired FROM purchases WHERE id = <purchase_id>;
```

### Issue: Loss calculation seems incorrect
**Solution:** Verify:
1. Downline users exist: `SELECT * FROM user_tree_paths WHERE ancestor_id = <user_id>;`
2. Downline purchases exist: `SELECT * FROM purchases WHERE user_id IN (SELECT descendant_id FROM user_tree_paths WHERE ancestor_id = <user_id>);`
3. Package rates: `SELECT self_monthly, recurring_rate_percent FROM packages WHERE id = <package_id>;`

## Performance Notes

- Global IDs calculation: O(1) - Single COUNT query
- Expiry loss calculation: O(n * m) where n = days (max 20), m = downline purchases
- For users with many downlines, calculation may take a few seconds
- Consider caching for frequently accessed purchases

