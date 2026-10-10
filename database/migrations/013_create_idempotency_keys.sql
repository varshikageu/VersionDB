-- Replay protection for mutating requests that carry an Idempotency-Key header.
CREATE TABLE idempotency_keys (
  user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (length(key) BETWEEN 8 AND 128),
  method          text        NOT NULL,
  path            text        NOT NULL,
  request_hash    text        NOT NULL,
  state           text        NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress', 'completed')),
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  PRIMARY KEY (user_id, key)
);
