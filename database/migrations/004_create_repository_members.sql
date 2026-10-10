-- Per-repository RBAC: viewer < reviewer < maintainer < owner.
CREATE TABLE repository_members (
  repo_id    uuid        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('viewer', 'reviewer', 'maintainer', 'owner')),
  added_by   uuid        REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo_id, user_id)
);
