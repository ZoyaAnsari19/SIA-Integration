-- Phase 2 extension: Spot/Team Royalty 10x flush tracking
-- Adds tracking fields to user_balances:
-- - spot_team_limit_reached_at: when user first fully used 10x limit
-- - spot_team_flush_active: whether flush mode is active (no Spot/Team Royalty accruals until upgrade)

ALTER TABLE user_balances
ADD COLUMN IF NOT EXISTS spot_team_limit_reached_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS spot_team_flush_active boolean NOT NULL DEFAULT false;

