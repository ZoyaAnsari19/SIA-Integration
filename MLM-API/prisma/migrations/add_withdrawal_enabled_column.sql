-- Migration: Add withdrawal_enabled column to withdrawal_transfer_rules table
-- Date: 2024
-- Description: Adds a boolean field to allow admin to enable/disable withdrawals for all users

-- Add withdrawal_enabled column with default value true
ALTER TABLE withdrawal_transfer_rules 
ADD COLUMN IF NOT EXISTS withdrawal_enabled BOOLEAN DEFAULT true NOT NULL;

-- Update existing records to have withdrawal_enabled = true (if any exist)
UPDATE withdrawal_transfer_rules 
SET withdrawal_enabled = true 
WHERE withdrawal_enabled IS NULL;

-- Add comment to the column
COMMENT ON COLUMN withdrawal_transfer_rules.withdrawal_enabled IS 'Admin toggle to enable/disable withdrawals for all users';

