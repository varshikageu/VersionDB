-- Migration 022: Recovery migration to repair the retroactive invalid parent relationship
-- Repository: 10000000-0000-4000-8000-000000000001
-- Invalid relationship: (ce675614-83a1-45f5-83ae-8911d46be9ab, a934a46c-5d8a-407e-bb45-aae1ed8887cb, 0)

DO $$
DECLARE
  v_repo_id uuid := '10000000-0000-4000-8000-000000000001';
  v_alice_commit uuid := 'ce675614-83a1-45f5-83ae-8911d46be9ab';
  v_main_init_commit uuid := 'a934a46c-5d8a-407e-bb45-aae1ed8887cb';
  v_merge_commit uuid := '3e57868c-2d18-43b9-8ca6-c694206feebc';
  v_invalid_exists boolean;
  v_merge_parents_count integer;
  v_alice_snapshot text;
BEGIN
  -- 1. Check if the invalid edge is present
  SELECT EXISTS (
    SELECT 1 FROM commit_parents
    WHERE commit_id = v_alice_commit AND parent_id = v_main_init_commit AND ord = 0
  ) INTO v_invalid_exists;

  -- If not present, this migration has already run or the state is already clean (idempotent)
  IF NOT v_invalid_exists THEN
    RAISE NOTICE 'Recovery migration 022: Invalid edge not found or already repaired. Skipping.';
    RETURN;
  END IF;

  -- 2. Precondition: verify the merge commit has exactly two parents (main init and alice commit)
  SELECT count(*) INTO v_merge_parents_count
  FROM commit_parents
  WHERE commit_id = v_merge_commit;

  IF v_merge_parents_count <> 2 THEN
    RAISE EXCEPTION 'Precondition failed: merge commit % does not have exactly 2 parents (found %)', v_merge_commit, v_merge_parents_count;
  END IF;

  -- 3. Precondition: verify Alice commit snapshot matches expected student data
  SELECT snapshot_hash INTO v_alice_snapshot
  FROM commits
  WHERE id = v_alice_commit AND repo_id = v_repo_id;

  IF v_alice_snapshot <> '74ddfc3862b430e20721ea9ef6ce315620be82d471f4ef3236e68598b3fdbeed' THEN
    RAISE EXCEPTION 'Precondition failed: Alice commit snapshot hash mismatch (found %)', v_alice_snapshot;
  END IF;

  -- 4. Execute removal under recovery mode
  PERFORM set_config('versiondb.recovery_mode', 'on', true);

  DELETE FROM commit_parents
  WHERE commit_id = v_alice_commit AND parent_id = v_main_init_commit AND ord = 0;

  PERFORM set_config('versiondb.recovery_mode', '', true);

  RAISE NOTICE 'Recovery migration 022: Successfully repaired commit ancestry for Alice root commit.';
END $$;

