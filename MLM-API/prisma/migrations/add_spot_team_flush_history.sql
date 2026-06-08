-- Flush history: kab kis user ka kitna spot/team_royalty flush hua (10x rule)
CREATE TABLE IF NOT EXISTS spot_team_flush_history (
  id                     bigserial PRIMARY KEY,
  user_id                bigint NOT NULL,
  flushed_at             timestamptz NOT NULL DEFAULT now(),
  spot_amount_flushed    numeric(18, 2) NOT NULL DEFAULT 0,
  team_royalty_amount_flushed numeric(18, 2) NOT NULL DEFAULT 0,
  trigger_commission_type text,  -- SPOT or MONTHLY (credit that triggered the flush)
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_team_flush_history_user_id ON spot_team_flush_history (user_id);
CREATE INDEX IF NOT EXISTS idx_spot_team_flush_history_flushed_at ON spot_team_flush_history (flushed_at);

COMMENT ON TABLE spot_team_flush_history IS 'Audit: when and how much spot/team_royalty was flushed (10x limit + 15 days rule)';
