-- Migration: Add password_plain column to users table
-- Date: 2025-01-15
-- Description: Adds a plain text password field for admin to view user passwords

-- Add password_plain column with nullable text type
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- Add comment to the column
COMMENT ON COLUMN users.password_plain IS 'Plain text password for admin view (stored for admin convenience)';

