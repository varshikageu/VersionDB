-- 020_relax_username_uniqueness.sql
-- Drop the case-insensitive unique constraint on lower(username) to allow duplicate display names.
-- Accounts are uniquely identified by their immutable id and unique email address.
DROP INDEX IF EXISTS users_username_uq;
