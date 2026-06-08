-- Phase 1: Team Royalty Wallet
-- Run on Stage DB only first. For production, run after Stage verification.
-- 1. Add team_royalty_balance column to user_balances
-- 2. Add team_royalty to WithdrawType enum (PostgreSQL)

-- Add column (safe - IF NOT EXISTS)
ALTER TABLE user_balances
ADD COLUMN IF NOT EXISTS team_royalty_balance numeric(18,2) NOT NULL DEFAULT 0;

-- Add enum value (run once; if error "already exists", ignore)
ALTER TYPE "WithdrawType" ADD VALUE 'team_royalty';
