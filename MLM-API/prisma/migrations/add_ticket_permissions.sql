-- Migration: Add TICKET_VIEW and TICKET_MANAGE permissions for support/ticket feature
-- Run after add_support_ticket_system.sql on local DB first

INSERT INTO admin_permissions_master (key, label, "group")
SELECT 'TICKET_VIEW', 'View Support Tickets', 'Support'
WHERE NOT EXISTS (SELECT 1 FROM admin_permissions_master WHERE key = 'TICKET_VIEW');

INSERT INTO admin_permissions_master (key, label, "group")
SELECT 'TICKET_MANAGE', 'Manage Support Tickets (Assign & Reply)', 'Support'
WHERE NOT EXISTS (SELECT 1 FROM admin_permissions_master WHERE key = 'TICKET_MANAGE');
