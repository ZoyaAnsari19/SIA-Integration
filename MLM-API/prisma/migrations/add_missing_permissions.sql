-- Migration: Add missing permissions for P2P, Levels, Course Master, Activation Request, Website Settings, and Transaction Rules

-- Add missing permissions to admin_permissions_master table
INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  -- P2P Permissions
  ('P2P_VIEW', 'View P2P History', 'P2P'),
  ('P2P_MANAGE', 'Manage P2P Transfers', 'P2P'),
  
  -- Transaction Rules & Limits
  ('TRANSACTION_RULES_MANAGE', 'Manage Transaction Rules & Limits', 'Settings'),
  
  -- Levels Permissions
  ('LEVELS_VIEW', 'View Levels', 'Levels'),
  ('LEVELS_MANAGE', 'Manage Levels', 'Levels'),
  
  -- Course Master Permissions
  ('COURSE_VIEW', 'View Courses', 'Course Master'),
  ('COURSE_MANAGE', 'Manage Courses', 'Course Master'),
  
  -- Activation Request Permissions
  ('ACTIVATION_REQUEST_VIEW', 'View Activation Requests', 'Activation Requests'),
  ('ACTIVATION_REQUEST_APPROVE', 'Approve/Reject Activation Requests', 'Activation Requests'),
  
  -- Website Settings Permissions
  ('WEBSITE_SETTINGS_MANAGE', 'Manage Website Settings', 'Website Settings')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";

