-- A branch is a movable pointer to a commit. head_commit_id is NULL only for an empty repository's default branch.
-- The foreign key to commits is added in 006 once that table exists.
CREATE TABLE branches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id        uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  name           text        NOT NULL CHECK (name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' AND name !~ '\.\.' AND name !~ '\.lock$'),
  head_commit_id uuid,
  created_by     uuid        REFERENCES users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo_id, name)
);
