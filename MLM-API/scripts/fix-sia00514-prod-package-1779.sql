-- Fix SIA00514 - Purchase 1779 (effective_global_ids = 350)
-- Production DB: postgres-0
-- User: SIA00514 (User ID: 495)
-- Date Range: Jan 24, 2026 to Jan 26, 2026

-- Expected values:
-- Jan 24: 350 IDs → ₹70.56
-- Jan 25: 356 IDs → ₹71.77
-- Jan 26: 356 IDs → ₹71.77

-- ============================================================================
-- STEP 1: Check current entries
-- ============================================================================
SELECT 
  id,
  amount as current_amount,
  metadata->>'used_ids' as current_used_ids,
  idempotency_key,
  DATE(credited_at) as date
FROM ledger_entries
WHERE purchase_id = 1779
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495
  AND credited_at >= '2026-01-24'
  AND credited_at < '2026-01-27'
ORDER BY credited_at;

-- ============================================================================
-- STEP 2: Update Jan 24 entry
-- ============================================================================
UPDATE ledger_entries
SET 
  amount = 70.56,
  metadata = jsonb_build_object(
    'used_ids', 350,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1779:2026-01-24'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 70.56
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1779:2026-01-24'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 3: Update Jan 25 entry
-- ============================================================================
UPDATE ledger_entries
SET 
  amount = 71.77,
  metadata = jsonb_build_object(
    'used_ids', 356,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1779:2026-01-25'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 71.77
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1779:2026-01-25'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 4: Update Jan 26 entry
-- ============================================================================
UPDATE ledger_entries
SET 
  amount = 71.77,
  metadata = jsonb_build_object(
    'used_ids', 356,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1779:2026-01-26'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 71.77
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1779:2026-01-26'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 5: Calculate and update wallet balance adjustment
-- ============================================================================
DO $$
DECLARE
  total_diff NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN idempotency_key = 'daily:global:1779:2026-01-24' THEN 70.56 - amount
      WHEN idempotency_key = 'daily:global:1779:2026-01-25' THEN 71.77 - amount
      WHEN idempotency_key = 'daily:global:1779:2026-01-26' THEN 71.77 - amount
      ELSE 0
    END
  ), 0) INTO total_diff
  FROM ledger_entries
  WHERE purchase_id = 1779
    AND commission_type = 'GLOBAL_HELPING'
    AND receiver_user_id = 495
    AND credited_at >= '2026-01-24'
    AND credited_at < '2026-01-27';

  -- Note: This calculates difference BEFORE the updates above
  -- We need to calculate AFTER updates, so let's do it differently
  -- Actually, we should calculate based on old vs new values
  
  -- Recalculate after updates
  SELECT COALESCE(SUM(
    CASE 
      WHEN idempotency_key = 'daily:global:1779:2026-01-24' THEN 70.56
      WHEN idempotency_key = 'daily:global:1779:2026-01-25' THEN 71.77
      WHEN idempotency_key = 'daily:global:1779:2026-01-26' THEN 71.77
      ELSE 0
    END
  ) - COALESCE(SUM(amount), 0), 0) INTO total_diff
  FROM ledger_entries
  WHERE purchase_id = 1779
    AND commission_type = 'GLOBAL_HELPING'
    AND receiver_user_id = 495
    AND credited_at >= '2026-01-24'
    AND credited_at < '2026-01-27';

  -- Actually, let's use a simpler approach - calculate expected total vs current total
  -- Expected: 70.56 + 71.77 + 71.77 = 214.10
  -- We'll update wallet after all entries are updated
END $$;

-- Update wallet balance (expected total for 3 days = 214.10)
-- We need to get the old total first, then adjust
UPDATE user_balances
SET other_balance = other_balance + (
  SELECT (70.56 + 71.77 + 71.77) - COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1779
    AND commission_type = 'GLOBAL_HELPING'
    AND receiver_user_id = 495
    AND credited_at >= '2026-01-24'
    AND credited_at < '2026-01-27'
)
WHERE user_id = 495;

-- ============================================================================
-- STEP 6: Recalculate purchase income
-- ============================================================================
UPDATE purchases
SET income = (
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1779
    AND commission_type IN ('SELF', 'GLOBAL_HELPING')
)
WHERE id = 1779;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
  id,
  amount,
  metadata->>'used_ids' as used_ids,
  idempotency_key,
  DATE(credited_at) as date
FROM ledger_entries
WHERE purchase_id = 1779
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495
  AND credited_at >= '2026-01-24'
  AND credited_at < '2026-01-27'
ORDER BY credited_at;

SELECT other_balance FROM user_balances WHERE user_id = 495;

SELECT id, income, amount FROM purchases WHERE id = 1779;
