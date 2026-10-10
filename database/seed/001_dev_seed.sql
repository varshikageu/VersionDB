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

INSERT INTO branches (repo_id, name, head_commit_id, created_by) VALUES
  ('10000000-0000-4000-8000-000000000001', 'main', NULL, '00000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;
INSERT INTO protected_branches (repo_id, branch_name, required_approvals) VALUES
  ('10000000-0000-4000-8000-000000000001', 'main', 1)
ON CONFLICT DO NOTHING;
