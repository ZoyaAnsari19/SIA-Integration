-- Spot/Team Royalty withdrawal limit multiplier (admin-configurable, e.g. 5x or 10x)
ALTER TABLE withdrawal_transfer_rules
  ADD COLUMN IF NOT EXISTS spot_team_withdraw_multiplier INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN withdrawal_transfer_rules.spot_team_withdraw_multiplier IS 'Multiplier for Spot+Team Royalty withdraw limit (limit = active package value × this). Default 10 (10x).';
