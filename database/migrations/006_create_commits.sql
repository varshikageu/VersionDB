-- Immutable commits. The snapshot (record data) lives in the storage engine, addressed by snapshot_hash.
CREATE TABLE commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  snapshot_hash text        NOT NULL,
  author_id     uuid        NOT NULL REFERENCES users (id),
  message       text        NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  kind          text        NOT NULL CHECK (kind IN ('initial', 'normal', 'merge', 'revert')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo_id, id)
);

-- A branch head must be a commit of the same repository (not enforced while head is NULL).
ALTER TABLE branches
  ADD CONSTRAINT branches_head_fk FOREIGN KEY (repo_id, head_commit_id) REFERENCES commits (repo_id, id);

-- Commits are immutable.
CREATE FUNCTION forbid_commit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'commits are immutable' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER commits_immutable BEFORE UPDATE ON commits FOR EACH ROW EXECUTE FUNCTION forbid_commit_mutation();
