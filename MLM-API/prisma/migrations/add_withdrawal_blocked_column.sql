-- Migration: Add withdrawal_blocked column to users table
-- Description: Allows admin to block withdrawal for a specific user without blocking the account

ALTER TABLE users
ADD COLUMN IF NOT EXISTS withdrawal_blocked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.withdrawal_blocked IS 'When true, this user cannot create withdrawal requests (admin-only setting)';
