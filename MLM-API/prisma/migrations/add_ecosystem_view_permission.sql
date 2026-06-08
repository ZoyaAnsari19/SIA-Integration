-- Permission: show Ecosystem quick-link cards on admin dashboard (grant per sub-admin)

INSERT INTO admin_permissions_master (key, label, "group")
VALUES ('ECOSYSTEM_VIEW', 'View Ecosystem Cards', 'Dashboard')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
