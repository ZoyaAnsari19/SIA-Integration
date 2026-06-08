-- Migration: Add legacy activation and spot history tables
-- Purpose:
-- - Store old-system activation history Excel export in a structured, queryable way
-- - Store old-system spot history Excel export similarly
-- - Keep original row data as JSONB while indexing by user for fast lookup

CREATE TABLE IF NOT EXISTS legacy_activation_history (
  id           BIGSERIAL PRIMARY KEY,
  -- Note: Stage DB me users table par id pe proper PK/unique constraint guaranteed nahi hai,
  -- isliye yaha explicit FOREIGN KEY constraint nahi lagaya (sirf reference value store kar rahe).
  user_id      BIGINT,
  display_id   TEXT NOT NULL,
  row_index    INT NOT NULL,
  source_file  TEXT NOT NULL,
  data         JSONB NOT NULL,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legacy_activation_history_unique_row UNIQUE (source_file, row_index)
);

CREATE INDEX IF NOT EXISTS idx_legacy_activation_history_user_id
  ON legacy_activation_history(user_id);

CREATE INDEX IF NOT EXISTS idx_legacy_activation_history_display_id
  ON legacy_activation_history(display_id);

CREATE INDEX IF NOT EXISTS idx_legacy_activation_history_data_gin
  ON legacy_activation_history
  USING GIN (data);

CREATE TABLE IF NOT EXISTS legacy_spot_history (
  id           BIGSERIAL PRIMARY KEY,
  -- Same reason as above: sirf numeric reference store kar rahe, FK constraint nahi.
  user_id      BIGINT,
  display_id   TEXT NOT NULL,
  row_index    INT NOT NULL,
  source_file  TEXT NOT NULL,
  data         JSONB NOT NULL,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legacy_spot_history_unique_row UNIQUE (source_file, row_index)
);

CREATE INDEX IF NOT EXISTS idx_legacy_spot_history_user_id
  ON legacy_spot_history(user_id);

CREATE INDEX IF NOT EXISTS idx_legacy_spot_history_display_id
  ON legacy_spot_history(display_id);

CREATE INDEX IF NOT EXISTS idx_legacy_spot_history_data_gin
  ON legacy_spot_history
  USING GIN (data);

