import { toJsonb, type Queryable } from './pool';
import type { BranchRepo, CommitRepo, NewCommit, WorkingChangeRepo } from '../../ports/repositories.port';
import { mapBranch, mapCommit, mapWorkingChange } from './mappers';
import type { Commit, JsonValue } from '../../domain/types';

const BRANCH_SELECT = `SELECT b.*, pb.required_approvals FROM branches b
  LEFT JOIN protected_branches pb ON pb.repo_id = b.repo_id AND pb.branch_name = b.name`;

export class PgBranchRepo implements BranchRepo {
  constructor(private db: Queryable) {}
  async create(b: { repoId: string; name: string; headCommitId: string | null; createdBy: string }) {
    const r = await this.db.query('INSERT INTO branches (repo_id, name, head_commit_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [b.repoId, b.name, b.headCommitId, b.createdBy]);
    return (await this.findById(r.rows[0].id))!;
  }
  async find(repoId: string, name: string) {
    const r = await this.db.query(`${BRANCH_SELECT} WHERE b.repo_id = $1 AND b.name = $2`, [repoId, name]);
    return r.rows[0] ? mapBranch(r.rows[0]) : null;
  }
  async findById(id: string) {
    const r = await this.db.query(`${BRANCH_SELECT} WHERE b.id = $1`, [id]);
    return r.rows[0] ? mapBranch(r.rows[0]) : null;
  }
  async lock(repoId: string, name: string) {
    // Lock only the branches row (FOR UPDATE OF), then read the joined view.
    const l = await this.db.query('SELECT id FROM branches WHERE repo_id = $1 AND name = $2 FOR UPDATE', [repoId, name]);
    return l.rows[0] ? this.findById(l.rows[0].id) : null;
  }
  async list(repoId: string) {
    const r = await this.db.query(`${BRANCH_SELECT} WHERE b.repo_id = $1 ORDER BY b.name`, [repoId]);
    return r.rows.map(mapBranch);
  }
  async compareAndSetHead(id: string, expected: string | null, next: string) {
    const r = await this.db.query('UPDATE branches SET head_commit_id = $3 WHERE id = $1 AND head_commit_id IS NOT DISTINCT FROM $2', [id, expected, next]);
    return (r.rowCount ?? 0) === 1;
  }
  async allowProtectedWrite() {
    await this.db.query("SELECT set_config('versiondb.protected_write', 'on', true)");
  }
  async protect(repoId: string, name: string, requiredApprovals: number) {
    await this.db.query(
      `INSERT INTO protected_branches (repo_id, branch_name, required_approvals) VALUES ($1, $2, $3)
       ON CONFLICT (repo_id, branch_name) DO UPDATE SET required_approvals = EXCLUDED.required_approvals`,
      [repoId, name, requiredApprovals],
    );
  }
}

const COMMIT_SELECT = `SELECT c.*, u.username AS author_name FROM commits c JOIN users u ON u.id = c.author_id`;

export class PgCommitRepo implements CommitRepo {
  constructor(private db: Queryable) {}

  private async parentsOf(ids: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>(ids.map((id) => [id, []]));
    if (ids.length === 0) return map;
    const r = await this.db.query('SELECT commit_id, parent_id FROM commit_parents WHERE commit_id = ANY($1::uuid[]) ORDER BY commit_id, ord', [ids]);
    for (const row of r.rows) map.get(row.commit_id)!.push(row.parent_id);
    return map;
  }

  async insert(c: NewCommit): Promise<Commit> {
    const r = await this.db.query(
      `INSERT INTO commits (repo_id, snapshot_hash, author_id, message, kind, created_at)
       VALUES ($1, $2, $3, $4, $5, date_trunc('milliseconds', clock_timestamp())) RETURNING id`,
      [c.repoId, c.snapshotHash, c.authorId, c.message, c.kind],
    );
    const id: string = r.rows[0].id;
    for (const [ord, parent] of c.parents.entries()) {
      await this.db.query('INSERT INTO commit_parents (commit_id, parent_id, ord) VALUES ($1, $2, $3)', [id, parent, ord]);
    }
    return (await this.find(c.repoId, id))!;
  }
  async registerSnapshot(repoId: string, hash: string, recordCount: number, sizeBytes: number) {
    await this.db.query('INSERT INTO snapshots (repo_id, hash, record_count, size_bytes) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [repoId, hash, recordCount, sizeBytes]);
  }
  async find(repoId: string, id: string) {
    const r = await this.db.query(`${COMMIT_SELECT} WHERE c.repo_id = $1 AND c.id = $2`, [repoId, id]);
    if (!r.rows[0]) return null;
    const parents = (await this.parentsOf([id])).get(id)!;
    return mapCommit(r.rows[0], parents);
  }
  async history(repoId: string, headId: string, limit: number, before?: { createdAt: string; id: string }) {
    const r = await this.db.query(
      `WITH RECURSIVE anc(id) AS (
         SELECT $2::uuid
         UNION
         SELECT cp.parent_id FROM commit_parents cp JOIN anc ON cp.commit_id = anc.id
       )
       SELECT c.*, u.username AS author_name FROM commits c
       JOIN anc ON anc.id = c.id JOIN users u ON u.id = c.author_id
       WHERE c.repo_id = $1 AND ($3::timestamptz IS NULL OR (c.created_at, c.id) < ($3::timestamptz, $4::uuid))
       ORDER BY c.created_at DESC, c.id DESC LIMIT $5`,
      [repoId, headId, before?.createdAt ?? null, before?.id ?? null, limit],
    );
    const parents = await this.parentsOf(r.rows.map((x: { id: string }) => x.id));
    return r.rows.map((row: { id: string }) => mapCommit(row, parents.get(row.id) ?? []));
  }
}

export class PgWorkingChangeRepo implements WorkingChangeRepo {
  constructor(private db: Queryable) {}
  async upsert(c: { repoId: string; branchId: string; userId: string; collection: string; recordId: string; op: 'put' | 'delete'; data: JsonValue | null }) {
    await this.db.query(
      `INSERT INTO working_changes (repo_id, branch_id, user_id, collection, record_id, op, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (branch_id, user_id, collection, record_id)
       DO UPDATE SET op = EXCLUDED.op, data = EXCLUDED.data, updated_at = now()`,
      [c.repoId, c.branchId, c.userId, c.collection, c.recordId, c.op, c.op === 'put' ? toJsonb(c.data) : null],
    );
  }
  async list(branchId: string, userId: string) {
    const r = await this.db.query('SELECT * FROM working_changes WHERE branch_id = $1 AND user_id = $2 ORDER BY collection, record_id', [branchId, userId]);
    return r.rows.map(mapWorkingChange);
  }
  async count(branchId: string, userId: string) {
    const r = await this.db.query('SELECT count(*)::int AS n FROM working_changes WHERE branch_id = $1 AND user_id = $2', [branchId, userId]);
    return r.rows[0].n;
  }
  async removeOne(branchId: string, userId: string, collection: string, recordId: string) {
    const r = await this.db.query('DELETE FROM working_changes WHERE branch_id = $1 AND user_id = $2 AND collection = $3 AND record_id = $4', [branchId, userId, collection, recordId]);
    return (r.rowCount ?? 0) > 0;
  }
  async clear(branchId: string, userId: string) {
    const r = await this.db.query('DELETE FROM working_changes WHERE branch_id = $1 AND user_id = $2', [branchId, userId]);
    return r.rowCount ?? 0;
  }
}
