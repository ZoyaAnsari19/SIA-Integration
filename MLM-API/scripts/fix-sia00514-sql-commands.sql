-- Fix SIA00514 Global Commission Entries - Jan 24 to Today
-- Database: postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission
-- User: SIA00514 (User ID: 495)

-- ============================================================================
-- STEP 1: Calculate expected values for each purchase
-- ============================================================================

-- Purchase 1779: effective_global_ids = 350, Package Cap = 1100
-- Purchase 1778: effective_global_ids = 400, Package Cap = 1100
-- Purchase 1777: effective_global_ids = 400, Package Cap = 1100

-- For Jan 26, 2026:
-- New users count (from Jan 24 to Jan 26): ~6 users
-- Expected Used IDs:
--   Purchase 1779: 350 + 6 = 356
--   Purchase 1778: 400 + 6 = 406
--   Purchase 1777: 400 + 6 = 406

-- Daily rate: ₹6.25 / 31 days = ₹0.2016129 per ID
-- Expected amounts for Jan 26:
--   Purchase 1779: 356 × ₹0.2016129 = ₹71.77
--   Purchase 1778: 406 × ₹0.2016129 = ₹81.85
--   Purchase 1777: 406 × ₹0.2016129 = ₹81.85

-- ============================================================================
-- STEP 2: Update Jan 26 GLOBAL_HELPING entries
-- ============================================================================

-- Purchase 1779 (Entry 231726)
UPDATE ledger_entries
SET 
  amount = 71.77,
  metadata = jsonb_build_object(
    'used_ids', 356,
    'package_cap', 1100
  )
WHERE id = 231726
  AND commission_type = 'GLOBAL_HELPING'
  AND idempotency_key = 'daily:global:1779:2026-01-26';

-- Update corresponding wallet transaction
UPDATE wallet_transactions
SET amount = 71.77
WHERE ledger_entry_id = 231726;

-- Purchase 1778 (Entry 231739)
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE id = 231739
  AND commission_type = 'GLOBAL_HELPING'
  AND idempotency_key = 'daily:global:1778:2026-01-26';

-- Update corresponding wallet transaction
UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id = 231739;

-- Purchase 1777 (Entry 231885)
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE id = 231885
  AND commission_type = 'GLOBAL_HELPING'
  AND idempotency_key = 'daily:global:1777:2026-01-26';

-- Update corresponding wallet transaction
UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id = 231885;

-- ============================================================================
-- STEP 3: Calculate wallet balance adjustments
-- ============================================================================

-- Purchase 1779: ₹1.20 → ₹71.77 = +₹70.57
-- Purchase 1778: ₹1.20 → ₹81.85 = +₹80.65
-- Purchase 1777: ₹1.20 → ₹81.85 = +₹80.65
-- Total adjustment: ₹231.87

-- ============================================================================
-- STEP 4: Update wallet balance
-- ============================================================================

UPDATE user_balances
SET other_balance = other_balance + 231.87
WHERE user_id = 495;

-- ============================================================================
-- STEP 5: Recalculate purchase income
-- ============================================================================

-- Purchase 1779
UPDATE purchases
SET income = (
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1779
    AND commission_type IN ('SELF', 'GLOBAL_HELPING')
)
WHERE id = 1779;

-- Purchase 1778
UPDATE purchases
SET income = (
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1778
    AND commission_type IN ('SELF', 'GLOBAL_HELPING')
)
WHERE id = 1778;

-- Purchase 1777
UPDATE purchases
SET income = (
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1777
    AND commission_type IN ('SELF', 'GLOBAL_HELPING')
)
WHERE id = 1777;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check updated entries
SELECT 
  id,
  commission_type,
  amount,
  metadata->>'used_ids' as used_ids,
  idempotency_key,
  credited_at
FROM ledger_entries
WHERE id IN (231726, 231739, 231885)
ORDER BY id;

-- Check wallet balance
SELECT other_balance
FROM user_balances
WHERE user_id = 495;

-- Check purchase income
SELECT 
  id,
  income,
  amount,
  (income::numeric / amount::numeric) as income_ratio
FROM purchases
WHERE id IN (1779, 1778, 1777);
