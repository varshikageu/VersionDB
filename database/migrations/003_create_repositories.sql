CREATE TABLE repositories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL CHECK (name ~ '^[A-Za-z0-9_.-]{1,64}$'),
  description    text        NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  owner_id       uuid        NOT NULL REFERENCES users (id),
  default_branch text        NOT NULL DEFAULT 'main',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
