-- Migration: Remove number_of_ids column from packages table
-- Date: 2025-01-XX
-- Description: Removes the number_of_ids column as it's no longer needed

-- Drop the number_of_ids column
ALTER TABLE packages 
DROP COLUMN IF EXISTS number_of_ids;

