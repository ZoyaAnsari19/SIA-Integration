-- Migration: Add USERS_EDIT permission for sub-admin user edit (update, activate, deactivate)

INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('USERS_EDIT', 'Edit Users', 'Users & KYC')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
