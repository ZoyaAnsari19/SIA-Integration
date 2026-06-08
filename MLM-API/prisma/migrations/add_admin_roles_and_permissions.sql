-- Migration: Add SUPER_ADMIN and SUB_ADMIN roles and admin permissions tables

-- 1) Extend UserRole enum with SUPER_ADMIN and SUB_ADMIN (if not already present)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';

-- 2) Migrate existing ADMIN users to SUPER_ADMIN
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE role = 'ADMIN';

-- 3) Create admin_permissions_master table
CREATE TABLE IF NOT EXISTS admin_permissions_master (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  "group" TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Seed default permissions
INSERT INTO admin_permissions_master (key, label, "group")
VALUES
  ('USERS_VIEW', 'View Users', 'Users & KYC'),
  ('KYC_VIEW', 'View KYC', 'Users & KYC'),
  ('KYC_APPROVE', 'Approve/Reject KYC', 'Users & KYC'),
  ('WITHDRAW_VIEW', 'View Withdrawals', 'Withdrawals'),
  ('WITHDRAW_APPROVE', 'Approve/Reject Withdrawals', 'Withdrawals'),
  ('WITHDRAW_RULES_MANAGE', 'Manage Withdrawal Rules', 'Withdrawals'),
  ('PACKAGE_VIEW', 'View Packages', 'Packages'),
  ('PACKAGE_MANAGE', 'Manage Packages', 'Packages'),
  ('INCOME_REPORT_VIEW', 'View Income Reports', 'Reports'),
  ('LEDGER_VIEW', 'View Ledger Logs', 'Reports'),
  ('NOTICE_MANAGE', 'Manage Notices', 'Settings'),
  ('ADMIN_MANAGE', 'Manage Admins', 'Settings'),
  ('FEE_RULES_MANAGE', 'Manage Fee Rules', 'Settings'),
  ('COMPANY_BANK_MANAGE', 'Manage Company Bank', 'Settings')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  "group" = EXCLUDED."group";

-- 5) Create admin_user_permissions mapping table
CREATE TABLE IF NOT EXISTS admin_user_permissions (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_admin_user_permissions_user
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_permissions_permission
    FOREIGN KEY (permission_key) REFERENCES admin_permissions_master(key) ON DELETE CASCADE,
  CONSTRAINT admin_user_permissions_unique UNIQUE (admin_user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_user
  ON admin_user_permissions(admin_user_id);


