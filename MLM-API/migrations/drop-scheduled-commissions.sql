-- Migration: Drop scheduled_commissions table
-- Date: 2025-12-20
-- Reason: All commissions (SELF, GLOBAL_HELPING, MONTHLY) are now processed dynamically
--         No need for scheduled_commissions table

-- Drop indexes first
DROP INDEX IF EXISTS scheduled_commissions_receiver_user_id_idx;
DROP INDEX IF EXISTS scheduled_commissions_source_user_id_idx;
DROP INDEX IF EXISTS scheduled_commissions_purchase_id_idx;

-- Drop the table
DROP TABLE IF EXISTS scheduled_commissions;

-- Note: This migration is safe because:
-- 1. No new scheduled_commissions entries are being created
-- 2. All commissions are processed dynamically by creditDailyCommissions()
-- 3. Old data can be archived if needed, but is no longer used

