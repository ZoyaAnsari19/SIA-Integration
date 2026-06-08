-- Migration: Add PACKAGE_ASSIGN permission for controlling package assignment to users

-- Add PACKAGE_ASSIGN permission to admin_permissions_master table
INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('PACKAGE_ASSIGN', 'Assign Packages to Users', 'Packages')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
