-- Review decisions. One row per reviewer per merge request (a new decision replaces the old one).
-- An approval only counts while source_head_commit_id and resolution_rev still match the merge request.
CREATE TABLE merge_approvals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merge_request_id      uuid        NOT NULL REFERENCES merge_requests (id) ON DELETE CASCADE,
  reviewer_id           uuid        NOT NULL REFERENCES users (id),
  decision              text        NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  comment               text        NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
  source_head_commit_id uuid        NOT NULL REFERENCES commits (id),
  resolution_rev        integer     NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merge_request_id, reviewer_id)
);

-- Defence in depth: an author can never review their own merge request, whatever the application does.
CREATE FUNCTION forbid_self_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM merge_requests mr WHERE mr.id = NEW.merge_request_id AND mr.author_id = NEW.reviewer_id) THEN
    RAISE EXCEPTION 'authors cannot review their own merge request' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER merge_approvals_no_self_review BEFORE INSERT OR UPDATE ON merge_approvals
  FOR EACH ROW EXECUTE FUNCTION forbid_self_review();
