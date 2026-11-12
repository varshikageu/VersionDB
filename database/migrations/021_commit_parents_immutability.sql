-- Migration 021: Enforce commit_parents immutability and atomic commit creation

-- 1. Function to insert commit with parents atomically
CREATE OR REPLACE FUNCTION create_commit_with_parents(
  p_repo_id uuid,
  p_snapshot_hash text,
  p_author_id uuid,
  p_message text,
  p_kind text,
  p_parents uuid[]
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_commit_id uuid;
  v_parent_id uuid;
  v_ord integer := 0;
BEGIN
  -- Insert the commit record
  INSERT INTO commits (repo_id, snapshot_hash, author_id, message, kind, created_at)
  VALUES (p_repo_id, p_snapshot_hash, p_author_id, p_message, p_kind, date_trunc('milliseconds', clock_timestamp()))
  RETURNING id INTO v_commit_id;

  -- Set session authorization context for inserting parents of this commit
  PERFORM set_config('versiondb.creating_commit_id', v_commit_id::text, true);

  -- Insert parent records in order
  IF p_parents IS NOT NULL AND array_length(p_parents, 1) > 0 THEN
    FOREACH v_parent_id IN ARRAY p_parents LOOP
      INSERT INTO commit_parents (commit_id, parent_id, ord)
      VALUES (v_commit_id, v_parent_id, v_ord);
      v_ord := v_ord + 1;
    END LOOP;
  END IF;

  -- Clear the creating commit context
  PERFORM set_config('versiondb.creating_commit_id', '', true);

  RETURN v_commit_id;
END $$;

-- 2. Trigger function to enforce immutability on commit_parents
CREATE OR REPLACE FUNCTION enforce_commit_parents_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_creating_commit text := coalesce(current_setting('versiondb.creating_commit_id', true), '');
  v_recovery text := coalesce(current_setting('versiondb.recovery_mode', true), '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'commit_parents records are strictly immutable' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    -- Allow deletion during recovery or when cascading commit deletion
    IF v_recovery = 'on' THEN
      RETURN OLD;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM commits WHERE id = OLD.commit_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'commit_parents records cannot be deleted directly' USING ERRCODE = '42501';
  ELSIF TG_OP = 'INSERT' THEN
    -- Only allow insert if it matches the commit currently being created or recovery mode
    IF v_recovery = 'on' THEN
      RETURN NEW;
    END IF;
    IF v_creating_commit = '' OR v_creating_commit <> NEW.commit_id::text THEN
      RAISE EXCEPTION 'cannot retroactively add parents to an existing commit: parents must be attached during commit creation' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commit_parents_immutable_trg ON commit_parents;
CREATE TRIGGER commit_parents_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON commit_parents
FOR EACH ROW EXECUTE FUNCTION enforce_commit_parents_immutability();

