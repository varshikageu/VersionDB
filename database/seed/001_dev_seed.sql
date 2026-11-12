-- DEVELOPMENT ONLY demo data (loaded by `npm run db:seed`; refused when NODE_ENV=production).
-- All demo accounts share the password:  Passw0rd!demo
INSERT INTO users (id, email, username, password_hash, global_role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin@versiondb.local', 'admin', '$2a$12$3vCegB46D.GzTEpOYGgU0OsX7mHM/3x8jTkP7Kpv0oeA5idT5.UTC', 'admin'),
  ('00000000-0000-4000-8000-000000000002', 'alice@versiondb.local', 'alice', '$2a$12$3vCegB46D.GzTEpOYGgU0OsX7mHM/3x8jTkP7Kpv0oeA5idT5.UTC', 'user'),
  ('00000000-0000-4000-8000-000000000003', 'bob@versiondb.local',   'bob',   '$2a$12$3vCegB46D.GzTEpOYGgU0OsX7mHM/3x8jTkP7Kpv0oeA5idT5.UTC', 'user'),
  ('00000000-0000-4000-8000-000000000004', 'carol@versiondb.local', 'carol', '$2a$12$3vCegB46D.GzTEpOYGgU0OsX7mHM/3x8jTkP7Kpv0oeA5idT5.UTC', 'user')
ON CONFLICT DO NOTHING;

INSERT INTO repositories (id, name, description, owner_id) VALUES
  ('10000000-0000-4000-8000-000000000001', 'inventory', 'Demo repository', '00000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO repository_members (repo_id, user_id, role, added_by) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'owner',      '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'reviewer',   '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'viewer',     '00000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- Initial snapshot for empty repository (SHA-256 of '{}')
INSERT INTO snapshots (repo_id, hash, record_count, size_bytes) VALUES
  ('10000000-0000-4000-8000-000000000001', '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a', 0, 2)
ON CONFLICT DO NOTHING;

-- Initial commit on repository creation
INSERT INTO commits (id, repo_id, snapshot_hash, author_id, message, kind) VALUES
  ('a934a46c-5d8a-407e-bb45-aae1ed8887cb', '10000000-0000-4000-8000-000000000001', '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a', '00000000-0000-4000-8000-000000000002', 'Initial commit', 'initial')
ON CONFLICT DO NOTHING;

INSERT INTO branches (id, repo_id, name, head_commit_id, created_by) VALUES
  ('3056ce39-3443-45e6-bf10-11ecfff32548', '10000000-0000-4000-8000-000000000001', 'main', 'a934a46c-5d8a-407e-bb45-aae1ed8887cb', '00000000-0000-4000-8000-000000000002')
ON CONFLICT (repo_id, name) DO UPDATE SET head_commit_id = EXCLUDED.head_commit_id;

INSERT INTO protected_branches (repo_id, branch_name, required_approvals) VALUES
  ('10000000-0000-4000-8000-000000000001', 'main', 1)
ON CONFLICT DO NOTHING;
