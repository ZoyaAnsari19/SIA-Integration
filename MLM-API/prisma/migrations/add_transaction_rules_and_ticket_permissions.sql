-- Add missing permissions in production: Transaction Rules & Support Tickets
-- Run on prod: kubectl exec postgres-0 -n mlm -- psql -U mlm_user -d mlm_commission -f - < MLM-API/prisma/migrations/add_transaction_rules_and_ticket_permissions.sql

INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('TRANSACTION_RULES_MANAGE', 'Manage Transaction Rules & Limits', 'Settings'),
  ('TICKET_VIEW', 'View Support Tickets', 'Support'),
  ('TICKET_MANAGE', 'Manage Support Tickets (Assign & Reply)', 'Support')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
