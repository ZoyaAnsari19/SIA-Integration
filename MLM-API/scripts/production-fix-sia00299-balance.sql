-- SIA00299 (user_id 280): Set spot + team_royalty to same as local fix. NO ledger/admin_ops.
-- Run ONLY after taking production backup.
-- Amounts: spot_balance = 10432.00, team_royalty_balance = 14300.66 (main wallet untouched).

UPDATE user_balances
SET
  spot_balance = 10432.00,
  team_royalty_balance = 14300.66,
  balance = other_balance + 10432.00 + 14300.66,
  spot_team_limit_reached_at = NULL,
  spot_team_flush_active = false,
  updated_at = now()
WHERE user_id = 280;
