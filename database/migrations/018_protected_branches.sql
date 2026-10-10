-- Protected branches (main by default). Direct head updates are rejected by the database itself; only a
-- transaction that explicitly sets versiondb.protected_write = 'on' (merge, rollback) may move a protected head.
-- The very first commit (head NULL -> commit) is the allowed bootstrap.
CREATE TABLE protected_branches (
  repo_id            uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  branch_name        text        NOT NULL,
  required_approvals integer     NOT NULL DEFAULT 1 CHECK (required_approvals BETWEEN 0 AND 10),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo_id, branch_name)
);

CREATE FUNCTION enforce_protected_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  is_protected boolean;
  allowed      boolean := coalesce(current_setting('versiondb.protected_write', true), '') = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM protected_branches pb WHERE pb.repo_id = OLD.repo_id AND pb.branch_name = OLD.name) INTO is_protected;
    IF is_protected AND NOT allowed THEN
      RAISE EXCEPTION 'branch % is protected and cannot be deleted', OLD.name USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.head_commit_id IS DISTINCT FROM OLD.head_commit_id AND OLD.head_commit_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM protected_branches pb WHERE pb.repo_id = NEW.repo_id AND pb.branch_name = NEW.name) INTO is_protected;
    IF is_protected AND NOT allowed THEN
      RAISE EXCEPTION 'branch % is protected: only merges and rollbacks may move it', NEW.name USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER branches_protected_update BEFORE UPDATE OF head_commit_id ON branches
  FOR EACH ROW EXECUTE FUNCTION enforce_protected_branch();
CREATE TRIGGER branches_protected_delete BEFORE DELETE ON branches
  FOR EACH ROW EXECUTE FUNCTION enforce_protected_branch();
