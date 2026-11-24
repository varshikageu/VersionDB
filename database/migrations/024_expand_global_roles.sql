-- Migration 024: Expand global_role to support platform roles: admin, developer, reviewer, viewer
-- Backward compatibility: existing 'user' roles default to 'developer'

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_global_role_check;

-- Update existing 'user' roles to 'developer'
UPDATE users SET global_role = 'developer' WHERE global_role = 'user';

-- Set default to 'developer'
ALTER TABLE users ALTER COLUMN global_role SET DEFAULT 'developer';

-- Add new CHECK constraint allowing platform roles (and 'user' for backwards compatibility during migration)
ALTER TABLE users ADD CONSTRAINT users_global_role_check
  CHECK (global_role IN ('admin', 'developer', 'reviewer', 'viewer', 'user'));

