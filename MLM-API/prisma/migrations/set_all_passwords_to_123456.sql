-- Migration: Set all existing users' passwords to 123456 (plain text)
-- Date: 2025-01-15
-- Description: Sets password_plain to '123456' for all existing users so admin can view passwords

-- Update all existing users to have password_plain = '123456'
UPDATE users 
SET password_plain = '123456'
WHERE password_plain IS NULL;

-- Also update password_hash to '123456' for consistency (plain text, no bcrypt)
-- Note: This removes bcrypt hashing - passwords are now stored in plain text
UPDATE users 
SET password_hash = '123456'
WHERE password_hash IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.password_plain IS 'Plain text password for admin view';
COMMENT ON COLUMN users.password_hash IS 'Plain text password (no bcrypt hashing)';

