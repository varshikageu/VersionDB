-- Commit DAG edges. ord 0 = first parent (the branch being merged into); ord 1 = merged-in parent.
CREATE TABLE commit_parents (
  commit_id uuid     NOT NULL REFERENCES commits (id) ON DELETE CASCADE,
  parent_id uuid     NOT NULL REFERENCES commits (id),
  ord       smallint NOT NULL CHECK (ord >= 0),
  PRIMARY KEY (commit_id, parent_id),
  UNIQUE (commit_id, ord),
  CHECK (commit_id <> parent_id)
);
CREATE INDEX commit_parents_parent_idx ON commit_parents (parent_id);
