-- One row per completed merge (branch names are copied so history survives branch deletion).
CREATE TABLE merges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id          uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  source_branch    text        NOT NULL,
  target_branch    text        NOT NULL,
  base_commit_id   uuid        REFERENCES commits (id),
  source_commit_id uuid        NOT NULL REFERENCES commits (id),
  target_commit_id uuid        NOT NULL REFERENCES commits (id),
  result_commit_id uuid        NOT NULL REFERENCES commits (id),
  strategy         text        NOT NULL DEFAULT 'three_way' CHECK (strategy IN ('three_way')),
  conflict_count   integer     NOT NULL DEFAULT 0,
  merged_by        uuid        NOT NULL REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
