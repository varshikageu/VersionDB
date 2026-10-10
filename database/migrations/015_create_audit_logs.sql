-- Append-only, hash-chained audit trail. Each row's hash covers the previous row's hash (per repository chain;
-- repo_id NULL is the global chain for account events), so any tampering is detectable by /audit/verify.
CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repo_id     uuid        REFERENCES repositories (id),
  actor_id    uuid        REFERENCES users (id),
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  prev_hash   text        NOT NULL,
  hash        text        NOT NULL,
  created_at  timestamptz NOT NULL
);
