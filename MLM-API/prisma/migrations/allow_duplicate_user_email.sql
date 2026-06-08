-- Remove DB-level unique email constraint so admins/sub-admins can share emails with users.
-- App-level checks still block duplicates on register/profile; admin user edit + sub-admin create/edit allow reuse.
DROP INDEX IF EXISTS users_email_key;

COMMENT ON COLUMN users.email IS 'User email (DB not unique; duplicate allowed only via admin user edit)';
