-- Add forced password reset flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Force ALL existing users (except admin role_id=0) to change password on next login
-- This secures migrated accounts with initial/default passwords
UPDATE users 
SET must_change_password = TRUE 
WHERE role_id != 0 
  AND deleted_at IS NULL
  AND status = 1;
