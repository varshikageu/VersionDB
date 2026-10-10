import type { Pool, PoolClient } from 'pg';
import type { AuditRepo, IdempotencyBegin, IdempotencyRepo, NewAuditEntry } from '../../ports/repositories.port';
import { computeAuditHash, GENESIS_HASH } from '../../shared/crypto';
import { mapAudit } from './mappers';
import { toJsonb, type Queryable } from './pool';

export class PgAuditRepo implements AuditRepo {
  /** `pool` is set only when not inside a transaction: append() then opens its own, so the chain lock is held correctly. */
  constructor(private db: Queryable, private pool?: Pool) {}

  async append(e: NewAuditEntry) {
    if (!this.pool) return this.appendWith(this.db, e);
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const entry = await this.appendWith(client, e);
      await client.query('COMMIT');
      return entry;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private async appendWith(db: Queryable, e: NewAuditEntry) {
    // One chain per repository (and one global chain for account events); the xact lock serialises appenders.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`audit:${e.repoId ?? 'global'}`]);
    const prev = await db.query('SELECT hash FROM audit_logs WHERE repo_id IS NOT DISTINCT FROM $1::uuid ORDER BY id DESC LIMIT 1', [e.repoId]);
    const prevHash: string = prev.rows[0]?.hash ?? GENESIS_HASH;
    const createdAt = new Date();
    const metadata = e.metadata ?? {};
    const hash = computeAuditHash({
      prevHash, repoId: e.repoId, actorId: e.actorId, action: e.action, entityType: e.entityType,
      entityId: e.entityId ?? null, metadata, createdAt,
    });
    const r = await db.query(
      `INSERT INTO audit_logs (repo_id, actor_id, action, entity_type, entity_id, metadata, ip, prev_hash, hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10) RETURNING *`,
      [e.repoId, e.actorId, e.action, e.entityType, e.entityId ?? null, toJsonb(metadata), e.ip ?? null, prevHash, hash, createdAt],
    );
    return mapAudit(r.rows[0]);
  }

  async list(repoId: string, limit: number, beforeId?: number) {
    const r = await this.db.query(
      `SELECT a.*, u.username AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.repo_id = $1 AND ($2::bigint IS NULL OR a.id < $2) ORDER BY a.id DESC LIMIT $3`,
      [repoId, beforeId ?? null, limit],
    );
    return r.rows.map(mapAudit);
  }

  async verify(repoId: string | null) {
    let lastId = 0;
    let prevHash = GENESIS_HASH;
    let checked = 0;
    for (;;) {
      const r = await this.db.query(
        'SELECT * FROM audit_logs WHERE repo_id IS NOT DISTINCT FROM $1::uuid AND id > $2 ORDER BY id ASC LIMIT 1000',
        [repoId, lastId],
      );
      if (r.rows.length === 0) return { ok: true, checked };
      for (const row of r.rows) {
        const expected = computeAuditHash({
          prevHash, repoId: row.repo_id, actorId: row.actor_id, action: row.action, entityType: row.entity_type,
          entityId: row.entity_id, metadata: row.metadata, createdAt: row.created_at,
        });
        if (row.prev_hash !== prevHash || row.hash !== expected) return { ok: false, checked, brokenAtId: Number(row.id) };
        prevHash = row.hash;
        lastId = Number(row.id);
        checked += 1;
      }
    }
  }
}

export class PgIdempotencyRepo implements IdempotencyRepo {
  constructor(private db: Queryable) {}

  async begin(r: { userId: string; key: string; method: string; path: string; requestHash: string; ttlSeconds: number }): Promise<IdempotencyBegin> {
    // Claim the key; also take over rows that are expired or whose handler died ("in_progress" for > 60 s).
    const claimed = await this.db.query(
      `INSERT INTO idempotency_keys (user_id, key, method, path, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6::int * interval '1 second'))
       ON CONFLICT (user_id, key) DO UPDATE
         SET method = EXCLUDED.method, path = EXCLUDED.path, request_hash = EXCLUDED.request_hash, state = 'in_progress',
             response_status = NULL, response_body = NULL, created_at = now(), expires_at = EXCLUDED.expires_at
         WHERE idempotency_keys.expires_at < now()
            OR (idempotency_keys.state = 'in_progress' AND idempotency_keys.created_at < now() - interval '60 seconds')
       RETURNING 1`,
      [r.userId, r.key, r.method, r.path, r.requestHash, r.ttlSeconds],
    );
    if ((claimed.rowCount ?? 0) > 0) return { kind: 'new' };
    const existing = await this.db.query('SELECT * FROM idempotency_keys WHERE user_id = $1 AND key = $2', [r.userId, r.key]);
    const row = existing.rows[0];
    if (!row) return { kind: 'new' };
    if (row.request_hash !== r.requestHash) return { kind: 'mismatch' };
    if (row.state === 'completed') return { kind: 'replay', status: row.response_status, body: row.response_body };
    return { kind: 'in_progress' };
  }
  async complete(userId: string, key: string, status: number, body: unknown) {
    await this.db.query(
      "UPDATE idempotency_keys SET state = 'completed', response_status = $3, response_body = $4::jsonb WHERE user_id = $1 AND key = $2",
      [userId, key, status, toJsonb(body ?? null)],
    );
  }
  async release(userId: string, key: string) {
    await this.db.query('DELETE FROM idempotency_keys WHERE user_id = $1 AND key = $2', [userId, key]);
  }
  async deleteExpired() {
    const r = await this.db.query('DELETE FROM idempotency_keys WHERE expires_at < now()');
    return r.rowCount ?? 0;
  }
}
