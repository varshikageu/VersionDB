-- ADDED BY ROLE 1 (approved workflow fix #7: "Edit JSON data" needs an uncommitted working state).
-- One row per pending record edit, per user, per branch. Committing applies and clears them atomically.
CREATE TABLE working_changes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  branch_id  uuid        NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  collection text        NOT NULL CHECK (collection ~ '^[A-Za-z0-9_.-]{1,64}$'),
  record_id  text        NOT NULL CHECK (record_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  op         text        NOT NULL CHECK (op IN ('put', 'delete')),
  data       jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, user_id, collection, record_id),
  CHECK ((op = 'put') = (data IS NOT NULL))
);
CREATE INDEX working_changes_branch_user_idx ON working_changes (branch_id, user_id);
