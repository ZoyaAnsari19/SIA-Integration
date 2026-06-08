-- Migration: Add action PIN for sub-admins
-- This PIN is required for sub-admins to perform critical actions

-- Add action_pin column (hashed PIN)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS action_pin VARCHAR(255) NULL;

-- Add failed attempts counter
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS action_pin_failed_attempts INT DEFAULT 0;

-- Add lock timestamp (locked until this time if too many failed attempts)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS action_pin_locked_until TIMESTAMPTZ NULL;

-- Add timestamp when PIN was set
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS action_pin_set_at TIMESTAMPTZ NULL;

-- Add who set the PIN (super admin user id)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS action_pin_set_by BIGINT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.action_pin IS 'Hashed action PIN for sub-admins to perform critical actions';
COMMENT ON COLUMN users.action_pin_failed_attempts IS 'Number of consecutive failed PIN verification attempts';
COMMENT ON COLUMN users.action_pin_locked_until IS 'PIN is locked until this timestamp after too many failed attempts';
COMMENT ON COLUMN users.action_pin_set_at IS 'Timestamp when the action PIN was set or last changed';
COMMENT ON COLUMN users.action_pin_set_by IS 'User ID of the super admin who set this PIN';

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_action_pin_locked 
ON users(action_pin_locked_until) 
WHERE action_pin_locked_until IS NOT NULL;
