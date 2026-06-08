-- Migration: Add WALLET_MANAGE permission for controlling wallet management by sub-admins

-- Add WALLET_MANAGE permission to admin_permissions_master table
INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('WALLET_MANAGE', 'Manage User Wallets', 'Users & KYC')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";
