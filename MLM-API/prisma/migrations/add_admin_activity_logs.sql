-- Migration: Add admin_activity_logs table for tracking sub-admin actions

-- Create admin_activity_logs table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id BIGINT,
  target_entity_type TEXT,
  target_entity_id TEXT,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_admin_activity_logs_admin
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_type ON admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_target_user_id ON admin_activity_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_status ON admin_activity_logs(status);

-- Composite index for common queries (admin + date range)
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_created ON admin_activity_logs(admin_user_id, created_at DESC);
