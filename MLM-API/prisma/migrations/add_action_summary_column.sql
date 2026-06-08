-- Add action_summary column to admin_activity_logs table
-- This provides a human-readable summary when action_details JSONB has issues

ALTER TABLE admin_activity_logs 
ADD COLUMN IF NOT EXISTS action_summary TEXT;

-- Add index for better query performance if needed
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_summary 
ON admin_activity_logs(action_summary) 
WHERE action_summary IS NOT NULL;

-- Add comment
COMMENT ON COLUMN admin_activity_logs.action_summary IS 'Human-readable summary of the action for quick display when action_details JSONB is unavailable';
