-- Phase 2: 10x Withdrawal Limit (Spot + Team Royalty)
-- Tracks total amount withdrawn from Spot + Team Royalty wallets against 10x package value limit.
-- Reset to 0 when user completes a new package purchase/upgrade.

ALTER TABLE user_balances
ADD COLUMN IF NOT EXISTS spot_team_withdraw_used numeric(18,2) NOT NULL DEFAULT 0;
