CREATE TABLE merge_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id               uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  number                integer     NOT NULL CHECK (number > 0),
  title                 text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description           text        NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  source_branch_id      uuid        REFERENCES branches (id) ON DELETE SET NULL,
  target_branch_id      uuid        REFERENCES branches (id) ON DELETE SET NULL,
  source_branch_name    text        NOT NULL,
  target_branch_name    text        NOT NULL,
  author_id             uuid        NOT NULL REFERENCES users (id),
  status                text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'closed')),
  base_commit_id        uuid        REFERENCES commits (id),
  source_head_commit_id uuid        NOT NULL REFERENCES commits (id),
  target_head_commit_id uuid        NOT NULL REFERENCES commits (id),
  has_conflicts         boolean     NOT NULL DEFAULT false,
  resolution_rev        integer     NOT NULL DEFAULT 0,   -- bumped whenever the merge outcome changes; approvals are pinned to it
  merge_id              uuid        REFERENCES merges (id),
  merged_by             uuid        REFERENCES users (id),
  merged_at             timestamptz,
  closed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo_id, number),
  CHECK (source_branch_name <> target_branch_name)
);
-- At most one open merge request per source/target pair.
CREATE UNIQUE INDEX merge_requests_one_open_per_pair
  ON merge_requests (repo_id, source_branch_name, target_branch_name) WHERE status = 'open';

ALTER TABLE conflicts
  ADD CONSTRAINT conflicts_merge_request_fk FOREIGN KEY (merge_request_id) REFERENCES merge_requests (id) ON DELETE CASCADE;
