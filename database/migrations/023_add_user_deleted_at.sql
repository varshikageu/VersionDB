-- Migration 023: Add deleted_at column to users table for soft-delete / account archival
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index to quickly filter non-deleted users
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);

