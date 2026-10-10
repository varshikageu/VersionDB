-- Queue for storage maintenance work (gc, compaction, fsck). Created here by Role 1; executed by Role 2's jobs runner.
CREATE TABLE jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id     uuid        REFERENCES repositories (id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('gc', 'compaction', 'fsck')),
  status      text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  attempts    integer     NOT NULL DEFAULT 0,
  run_at      timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  created_by  uuid        REFERENCES users (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
