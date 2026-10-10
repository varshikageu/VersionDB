-- Server-side token records. Only a SHA-256 hash of the token is stored, never the token itself.
-- kind 'refresh' = rotating refresh tokens issued at login; kind 'api' is reserved for personal access tokens.
CREATE TABLE api_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('refresh', 'api')),
  name         text,
  token_hash   text        NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
