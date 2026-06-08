-- Migration: Add number_of_ids column to packages table
-- Date: 2025-01-XX
-- Description: Adds a field to allow admin to configure how many IDs should be given for each package

-- Add number_of_ids column with nullable integer type
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS number_of_ids INTEGER;

-- Add comment to the column
COMMENT ON COLUMN packages.number_of_ids IS 'Number of IDs to be given for this package (admin configurable)';

