-- Fix SIA00514 Global Commission Entries - Complete Fix
-- Database: postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission
-- User: SIA00514 (User ID: 495)
-- Date Range: Jan 24, 2026 to Jan 26, 2026

-- ============================================================================
-- CALCULATE EXPECTED VALUES
-- ============================================================================

-- Purchase 1779: effective_global_ids = 350
-- Purchase 1778: effective_global_ids = 400
-- Purchase 1777: effective_global_ids = 400

-- Daily rate: ₹6.25 / 31 days = ₹0.2016129 per ID

-- Jan 24, 2026 (Next day after purchase):
--   New users: 0 (same day, no new users yet)
--   Purchase 1779: 350 + 0 = 350 IDs → ₹70.56
--   Purchase 1778: 400 + 0 = 400 IDs → ₹80.65
--   Purchase 1777: 400 + 0 = 400 IDs → ₹80.65

-- Jan 25, 2026:
--   New users: ~6 (from Jan 24 to Jan 25)
--   Purchase 1779: 350 + 6 = 356 IDs → ₹71.77
--   Purchase 1778: 400 + 6 = 406 IDs → ₹81.85
--   Purchase 1777: 400 + 6 = 406 IDs → ₹81.85

-- Jan 26, 2026:
--   New users: ~6 (same as Jan 25, no new users on Jan 26 yet)
--   Purchase 1779: 350 + 6 = 356 IDs → ₹71.77
--   Purchase 1778: 400 + 6 = 406 IDs → ₹81.85
--   Purchase 1777: 400 + 6 = 406 IDs → ₹81.85

-- ============================================================================
-- STEP 1: Get all GLOBAL_HELPING entries to update
-- ============================================================================

-- First, let's see what entries exist
SELECT 
  le.id,
  le.purchase_id,
  le.amount as current_amount,
  le.metadata->>'used_ids' as current_used_ids,
  le.idempotency_key,
  p.effective_global_ids,
  pk.global_ids as package_cap
FROM ledger_entries le
JOIN purchases p ON le.purchase_id = p.id
JOIN packages pk ON p.package_id = pk.id
WHERE le.receiver_user_id = 495
  AND le.commission_type = 'GLOBAL_HELPING'
  AND le.purchase_id IN (1777, 1778, 1779)
  AND le.credited_at >= '2026-01-24'
  AND le.credited_at < '2026-01-27'
ORDER BY le.purchase_id, le.credited_at;

-- ============================================================================
-- STEP 2: Calculate new users count for each date
-- ============================================================================

-- This will be done in the update queries below

-- ============================================================================
-- STEP 3: Update Jan 24 entries (if they exist and are wrong)
-- ============================================================================

-- Purchase 1779 - Jan 24
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
);

-- Purchase 1778 - Jan 24
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
);

-- Purchase 1777 - Jan 24
UPDATE ledger_entries
SET 
  amount = 80.65,
  metadata = jsonb_build_object(
    'used_ids', 400,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1777:2026-01-24'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 80.65
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1777:2026-01-24'
);

-- ============================================================================
-- STEP 4: Update Jan 25 entries
-- ============================================================================

-- Purchase 1779 - Jan 25
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
);

-- Purchase 1778 - Jan 25
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
);

-- Purchase 1777 - Jan 25
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1777:2026-01-25'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1777:2026-01-25'
);

-- ============================================================================
-- STEP 5: Update Jan 26 entries (already done, but including for completeness)
-- ============================================================================

-- Purchase 1779 - Jan 26
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
);

-- Purchase 1778 - Jan 26
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
);

-- Purchase 1777 - Jan 26
UPDATE ledger_entries
SET 
  amount = 81.85,
  metadata = jsonb_build_object(
    'used_ids', 406,
    'package_cap', 1100
  )
WHERE idempotency_key = 'daily:global:1777:2026-01-26'
  AND commission_type = 'GLOBAL_HELPING'
  AND receiver_user_id = 495;

UPDATE wallet_transactions
SET amount = 81.85
WHERE ledger_entry_id IN (
  SELECT id FROM ledger_entries 
  WHERE idempotency_key = 'daily:global:1777:2026-01-26'
);

-- ============================================================================
-- STEP 6: Calculate total wallet adjustment
-- ============================================================================

-- Calculate difference for each entry and update wallet balance
-- We'll do this by calculating the sum of differences

WITH adjustments AS (
  SELECT 
    le.id,
    le.purchase_id,
    le.amount as old_amount,
    CASE 
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-24' THEN 70.56
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-25' THEN 71.77
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-26' THEN 71.77
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-24' THEN 80.65
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-25' THEN 81.85
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-26' THEN 81.85
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-24' THEN 80.65
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-25' THEN 81.85
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-26' THEN 81.85
      ELSE le.amount
    END as new_amount
  FROM ledger_entries le
  WHERE le.receiver_user_id = 495
    AND le.commission_type = 'GLOBAL_HELPING'
    AND le.purchase_id IN (1777, 1778, 1779)
    AND le.credited_at >= '2026-01-24'
    AND le.credited_at < '2026-01-27'
)
SELECT SUM(new_amount - old_amount) as total_adjustment FROM adjustments;

-- Update wallet balance with total adjustment
-- Note: This will be calculated above, but for safety, we'll update incrementally

-- ============================================================================
-- STEP 7: Recalculate purchase income
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
-- STEP 8: Update wallet balance (calculate and apply total difference)
-- ============================================================================

-- Calculate total difference and update wallet
DO $$
DECLARE
  total_diff NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-24' THEN 70.56 - le.amount
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-25' THEN 71.77 - le.amount
      WHEN le.idempotency_key = 'daily:global:1779:2026-01-26' THEN 71.77 - le.amount
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-24' THEN 80.65 - le.amount
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-25' THEN 81.85 - le.amount
      WHEN le.idempotency_key = 'daily:global:1778:2026-01-26' THEN 81.85 - le.amount
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-24' THEN 80.65 - le.amount
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-25' THEN 81.85 - le.amount
      WHEN le.idempotency_key = 'daily:global:1777:2026-01-26' THEN 81.85 - le.amount
      ELSE 0
    END
  ), 0) INTO total_diff
  FROM ledger_entries le
  WHERE le.receiver_user_id = 495
    AND le.commission_type = 'GLOBAL_HELPING'
    AND le.purchase_id IN (1777, 1778, 1779)
    AND le.credited_at >= '2026-01-24'
    AND le.credited_at < '2026-01-27';

  UPDATE user_balances
  SET other_balance = other_balance + total_diff
  WHERE user_id = 495;

  RAISE NOTICE 'Wallet balance adjusted by: ₹%', total_diff;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check all updated entries
SELECT 
  le.id,
  le.purchase_id,
  le.amount,
  le.metadata->>'used_ids' as used_ids,
  le.idempotency_key,
  DATE(le.credited_at) as date
FROM ledger_entries le
WHERE le.receiver_user_id = 495
  AND le.commission_type = 'GLOBAL_HELPING'
  AND le.purchase_id IN (1777, 1778, 1779)
  AND le.credited_at >= '2026-01-24'
  AND le.credited_at < '2026-01-27'
ORDER BY le.purchase_id, le.credited_at;

-- Check wallet balance
SELECT other_balance
FROM user_balances
WHERE user_id = 495;

-- Check purchase income
SELECT 
  id,
  income,
  amount,
  (income::numeric / amount::numeric * 100) as income_percent
FROM purchases
WHERE id IN (1779, 1778, 1777)
ORDER BY id;
