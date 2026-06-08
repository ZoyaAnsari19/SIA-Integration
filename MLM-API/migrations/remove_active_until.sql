-- Migration: Remove active_until column from purchases table
-- Expiry is ONLY based on 2x income, NOT date-based
-- Run this migration on production database

ALTER TABLE purchases DROP COLUMN IF EXISTS active_until;

