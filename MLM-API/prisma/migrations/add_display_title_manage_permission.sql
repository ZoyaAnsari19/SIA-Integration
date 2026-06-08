-- Migration: Add DISPLAY_TITLE_MANAGE permission for sub-admin display title feature

INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('DISPLAY_TITLE_MANAGE', 'Manage Display Title', 'Users & KYC')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
