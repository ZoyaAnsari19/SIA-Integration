-- Fix SIA00514 - Purchase 1778 (effective_global_ids = 400)
-- Production DB: postgres-0
-- User: SIA00514 (User ID: 495)
-- Date Range: Jan 24, 2026 to Jan 26, 2026

-- Expected values:
-- Jan 24: 400 IDs → ₹80.65
-- Jan 25: 406 IDs → ₹81.85
-- Jan 26: 406 IDs → ₹81.85

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
WHERE purchase_id = 1778
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
  amount = 80.65,
  metadata = jsonb_build_object(
    'used_ids', 400,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1778:2026-01-24'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 80.65
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1778:2026-01-24'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 3: Update Jan 25 entry
-- ============================================================================
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1778:2026-01-25'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1778:2026-01-25'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 4: Update Jan 26 entry
-- ============================================================================
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1778:2026-01-26'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1778:2026-01-26'
    AND commission_type = 'GLOBAL_HELPING'
);

-- ============================================================================
-- STEP 5: Update wallet balance adjustment
-- ============================================================================
UPDATE user_balances
SET other_balance = other_balance + (
  SELECT (80.65 + 81.85 + 81.85) - COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE purchase_id = 1778
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
  WHERE purchase_id = 1778
    AND commission_type IN ('SELF', 'GLOBAL_HELPING')
)
WHERE id = 1778;

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
WHERE purchase_id = 1778
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495
  AND credited_at >= '2026-01-24'
  AND credited_at < '2026-01-27'
ORDER BY credited_at;

SELECT other_balance FROM user_balances WHERE user_id = 495;

SELECT id, income, amount FROM purchases WHERE id = 1778;
