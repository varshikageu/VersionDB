-- Field/record level conflicts detected for a merge request. path is an RFC 6901 JSON Pointer ("/collection/id/field").
-- ours = target branch side, theirs = incoming source branch side. *_exists distinguishes "absent" from JSON null.
-- The foreign key to merge_requests is added in 011.
CREATE TABLE conflicts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merge_request_id uuid        NOT NULL,
  path             text        NOT NULL,
  base_exists      boolean     NOT NULL,
  base_value       jsonb,
  ours_exists      boolean     NOT NULL,
  ours_value       jsonb,
  theirs_exists    boolean     NOT NULL,
  theirs_value     jsonb,
  resolution       text        CHECK (resolution IN ('ours', 'theirs', 'manual')),
  resolved_exists  boolean,
  resolved_value   jsonb,
  resolved_by      uuid        REFERENCES users (id),
  resolved_at      timestamptz,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merge_request_id, path),
  CHECK ((resolution IS NULL) = (resolved_exists IS NULL))
);
