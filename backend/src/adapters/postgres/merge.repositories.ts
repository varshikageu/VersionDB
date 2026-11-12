import type { Queryable } from './pool';
import { toJsonb } from './pool';
import type {
  ConflictRepo,
  MergeApprovalRepo,
  MergeRepo,
  MergeRequestRepo,
  NewConflict,
  NewMerge,
  NewMergeRequest,
} from '../../ports/repositories.port';
import { mapConflict, mapMerge, mapMergeApproval, mapMergeRequest } from './mappers';
import type { ApprovalDecision, ConflictResolutionMode, JsonValue, MergeApproval, MergeConflict, MergeRecord, MergeRequest } from '../../domain/types';

const MR_SELECT = `
  SELECT mr.*, u.username AS author_name
  FROM merge_requests mr
  JOIN users u ON u.id = mr.author_id
`;

export class PgMergeRequestRepo implements MergeRequestRepo {
  constructor(private db: Queryable) {}

  async create(mr: NewMergeRequest): Promise<MergeRequest> {
    const r = await this.db.query(
      `INSERT INTO merge_requests (
         repo_id, number, title, description,
         source_branch_id, target_branch_id, source_branch_name, target_branch_name,
         author_id, base_commit_id, source_head_commit_id, target_head_commit_id,
         has_conflicts, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open')
       RETURNING *`,
      [
        mr.repoId,
        mr.number,
        mr.title,
        mr.description,
        mr.sourceBranchId,
        mr.targetBranchId,
        mr.sourceBranchName,
        mr.targetBranchName,
        mr.authorId,
        mr.baseCommitId,
        mr.sourceHeadCommitId,
        mr.targetHeadCommitId,
        mr.hasConflicts,
      ],
    );
    return (await this.findById(r.rows[0].id))!;
  }

  async findById(id: string): Promise<MergeRequest | null> {
    const r = await this.db.query(`${MR_SELECT} WHERE mr.id = $1`, [id]);
    return r.rows[0] ? mapMergeRequest(r.rows[0]) : null;
  }

  async findByNumber(repoId: string, number: number): Promise<MergeRequest | null> {
    const r = await this.db.query(`${MR_SELECT} WHERE mr.repo_id = $1 AND mr.number = $2`, [repoId, number]);
    return r.rows[0] ? mapMergeRequest(r.rows[0]) : null;
  }

  async findOpenByBranchPair(repoId: string, sourceBranch: string, targetBranch: string): Promise<MergeRequest | null> {
    const r = await this.db.query(
      `${MR_SELECT} WHERE mr.repo_id = $1 AND mr.source_branch_name = $2 AND mr.target_branch_name = $3 AND mr.status = 'open'`,
      [repoId, sourceBranch, targetBranch],
    );
    return r.rows[0] ? mapMergeRequest(r.rows[0]) : null;
  }

  async list(repoId: string, status?: string): Promise<MergeRequest[]> {
    let sql = `${MR_SELECT} WHERE mr.repo_id = $1`;
    const params: unknown[] = [repoId];
    if (status && status !== 'all' && status !== 'ALL') {
      params.push(status.toLowerCase());
      sql += ` AND mr.status = $${params.length}`;
    }
    sql += ' ORDER BY mr.number DESC';
    const r = await this.db.query(sql, params);
    return r.rows.map(mapMergeRequest);
  }

  async nextNumber(repoId: string): Promise<number> {
    const r = await this.db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next_num FROM merge_requests WHERE repo_id = $1',
      [repoId],
    );
    return Number(r.rows[0].next_num);
  }

  async close(id: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE merge_requests
       SET status = 'closed', closed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'open'`,
      [id],
    );
    return (r.rowCount ?? 0) === 1;
  }

  async setMerged(id: string, mergeId: string, mergedBy: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE merge_requests
       SET status = 'merged', merge_id = $2, merged_by = $3, merged_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'open'`,
      [id, mergeId, mergedBy],
    );
    return (r.rowCount ?? 0) === 1;
  }

  async updateResolution(id: string, hasConflicts: boolean, resolutionRev: number): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE merge_requests
       SET has_conflicts = $2, resolution_rev = $3, updated_at = now()
       WHERE id = $1`,
      [id, hasConflicts, resolutionRev],
    );
    return (r.rowCount ?? 0) === 1;
  }
}

export class PgConflictRepo implements ConflictRepo {
  constructor(private db: Queryable) {}

  async insertBatch(conflicts: NewConflict[]): Promise<void> {
    if (conflicts.length === 0) return;
    for (const c of conflicts) {
      await this.db.query(
        `INSERT INTO conflicts (
           merge_request_id, path, base_exists, base_value,
           ours_exists, ours_value, theirs_exists, theirs_value
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8::jsonb)
         ON CONFLICT (merge_request_id, path)
         DO UPDATE SET
           base_exists = EXCLUDED.base_exists, base_value = EXCLUDED.base_value,
           ours_exists = EXCLUDED.ours_exists, ours_value = EXCLUDED.ours_value,
           theirs_exists = EXCLUDED.theirs_exists, theirs_value = EXCLUDED.theirs_value`,
        [
          c.mergeRequestId,
          c.path,
          c.baseExists,
          c.baseValue !== null ? toJsonb(c.baseValue) : null,
          c.oursExists,
          c.oursValue !== null ? toJsonb(c.oursValue) : null,
          c.theirsExists,
          c.theirsValue !== null ? toJsonb(c.theirsValue) : null,
        ],
      );
    }
  }

  async listByMr(mergeRequestId: string): Promise<MergeConflict[]> {
    const r = await this.db.query(
      'SELECT * FROM conflicts WHERE merge_request_id = $1 ORDER BY path',
      [mergeRequestId],
    );
    return r.rows.map(mapConflict);
  }

  async findById(id: string): Promise<MergeConflict | null> {
    const r = await this.db.query('SELECT * FROM conflicts WHERE id = $1', [id]);
    return r.rows[0] ? mapConflict(r.rows[0]) : null;
  }

  async resolve(
    id: string,
    resolution: ConflictResolutionMode,
    resolvedExists: boolean,
    resolvedValue: JsonValue | null,
    resolvedBy: string,
  ): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE conflicts
       SET resolution = $2, resolved_exists = $3, resolved_value = $4::jsonb,
           resolved_by = $5, resolved_at = now()
       WHERE id = $1`,
      [
        id,
        resolution,
        resolvedExists,
        resolvedValue !== null ? toJsonb(resolvedValue) : null,
        resolvedBy,
      ],
    );
    return (r.rowCount ?? 0) === 1;
  }

  async countUnresolved(mergeRequestId: string): Promise<number> {
    const r = await this.db.query(
      'SELECT count(*)::int AS n FROM conflicts WHERE merge_request_id = $1 AND resolution IS NULL',
      [mergeRequestId],
    );
    return r.rows[0].n;
  }

  async deleteByMr(mergeRequestId: string): Promise<number> {
    const r = await this.db.query('DELETE FROM conflicts WHERE merge_request_id = $1', [mergeRequestId]);
    return r.rowCount ?? 0;
  }
}

export class PgMergeApprovalRepo implements MergeApprovalRepo {
  constructor(private db: Queryable) {}

  async upsert(approval: {
    mergeRequestId: string;
    reviewerId: string;
    decision: ApprovalDecision;
    comment: string;
    sourceHeadCommitId: string;
    resolutionRev: number;
  }): Promise<MergeApproval> {
    const r = await this.db.query(
      `INSERT INTO merge_approvals (
         merge_request_id, reviewer_id, decision, comment,
         source_head_commit_id, resolution_rev
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (merge_request_id, reviewer_id)
       DO UPDATE SET
         decision = EXCLUDED.decision,
         comment = EXCLUDED.comment,
         source_head_commit_id = EXCLUDED.source_head_commit_id,
         resolution_rev = EXCLUDED.resolution_rev,
         created_at = now()
       RETURNING *`,
      [
        approval.mergeRequestId,
        approval.reviewerId,
        approval.decision,
        approval.comment,
        approval.sourceHeadCommitId,
        approval.resolutionRev,
      ],
    );
    const row = r.rows[0];
    const u = await this.db.query('SELECT username FROM users WHERE id = $1', [row.reviewer_id]);
    return mapMergeApproval({ ...row, reviewer_name: u.rows[0]?.username ?? null });
  }

  async listByMr(mergeRequestId: string): Promise<MergeApproval[]> {
    const r = await this.db.query(
      `SELECT ma.*, u.username AS reviewer_name
       FROM merge_approvals ma
       JOIN users u ON u.id = ma.reviewer_id
       WHERE ma.merge_request_id = $1
       ORDER BY ma.created_at ASC`,
      [mergeRequestId],
    );
    return r.rows.map(mapMergeApproval);
  }

  async countValid(mergeRequestId: string, sourceHeadCommitId: string, resolutionRev: number): Promise<number> {
    const r = await this.db.query(
      `SELECT count(*)::int AS n
       FROM merge_approvals
       WHERE merge_request_id = $1
         AND decision = 'approved'
         AND source_head_commit_id = $2
         AND resolution_rev = $3`,
      [mergeRequestId, sourceHeadCommitId, resolutionRev],
    );
    return r.rows[0].n;
  }
}

export class PgMergeRepo implements MergeRepo {
  constructor(private db: Queryable) {}

  async insert(m: NewMerge): Promise<MergeRecord> {
    const r = await this.db.query(
      `INSERT INTO merges (
         repo_id, source_branch, target_branch,
         base_commit_id, source_commit_id, target_commit_id, result_commit_id,
         strategy, conflict_count, merged_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        m.repoId,
        m.sourceBranch,
        m.targetBranch,
        m.baseCommitId,
        m.sourceCommitId,
        m.targetCommitId,
        m.resultCommitId,
        m.strategy,
        m.conflictCount,
        m.mergedBy,
      ],
    );
    return mapMerge(r.rows[0]);
  }

  async findById(id: string): Promise<MergeRecord | null> {
    const r = await this.db.query('SELECT * FROM merges WHERE id = $1', [id]);
    return r.rows[0] ? mapMerge(r.rows[0]) : null;
  }

  async listByRepo(repoId: string, limit = 50): Promise<MergeRecord[]> {
    const r = await this.db.query(
      'SELECT * FROM merges WHERE repo_id = $1 ORDER BY created_at DESC LIMIT $2',
      [repoId, limit],
    );
    return r.rows.map(mapMerge);
  }
}
