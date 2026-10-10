-- Registry of storage snapshots known to the backend (content-addressed, so rows are shared by identical states).
CREATE TABLE snapshots (
  repo_id      uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  hash         text        NOT NULL,
  record_count integer     NOT NULL CHECK (record_count >= 0),
  size_bytes   bigint      NOT NULL CHECK (size_bytes >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo_id, hash)
);
ALTER TABLE commits
  ADD CONSTRAINT commits_snapshot_fk FOREIGN KEY (repo_id, snapshot_hash) REFERENCES snapshots (repo_id, hash);
