-- Accounts. Email is stored lower-case; usernames are unique case-insensitively.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,
  username      text        NOT NULL,
  password_hash text        NOT NULL,
  global_role   text        NOT NULL DEFAULT 'user' CHECK (global_role IN ('user', 'admin')),
  disabled      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format    CHECK (email = lower(email) AND position('@' IN email) > 1 AND length(email) <= 254),
  CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$')
);
CREATE UNIQUE INDEX users_email_uq    ON users (email);
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));
