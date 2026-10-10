import type { MemberRepo, RepositoryRepo, TokenRepo, UserRepo } from '../../ports/repositories.port';
import { mapMember, mapRepository, mapRepositoryWithRole, mapUser } from './mappers';
import type { Queryable } from './pool';

export class PgUserRepo implements UserRepo {
  constructor(private db: Queryable) {}
  async create(u: { email: string; username: string; passwordHash: string }) {
    const r = await this.db.query('INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *', [u.email, u.username, u.passwordHash]);
    return mapUser(r.rows[0]);
  }
  async findById(id: string) {
    const r = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  }
  async findByEmail(email: string) {
    const r = await this.db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  }
  async findByIdentifier(identifier: string) {
    const r = await this.db.query('SELECT * FROM users WHERE email = lower($1) OR lower(username) = lower($1) LIMIT 1', [identifier]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  }
}

export class PgTokenRepo implements TokenRepo {
  constructor(private db: Queryable) {}
  async create(t: { userId: string; tokenHash: string; kind: 'refresh' | 'api'; expiresAt: Date }) {
    await this.db.query('INSERT INTO api_tokens (user_id, token_hash, kind, expires_at) VALUES ($1, $2, $3, $4)', [t.userId, t.tokenHash, t.kind, t.expiresAt]);
  }
  async findByHash(hash: string, kind: 'refresh' | 'api') {
    const r = await this.db.query('SELECT id, user_id, expires_at, revoked_at FROM api_tokens WHERE token_hash = $1 AND kind = $2', [hash, kind]);
    const row = r.rows[0];
    return row ? { id: row.id, userId: row.user_id, expiresAt: row.expires_at, revokedAt: row.revoked_at } : null;
  }
  async revoke(id: string) {
    await this.db.query('UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
  }
  async revokeAllForUser(userId: string, kind: 'refresh' | 'api') {
    await this.db.query('UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND kind = $2 AND revoked_at IS NULL', [userId, kind]);
  }
  async deleteExpired() {
    const r = await this.db.query("DELETE FROM api_tokens WHERE expires_at < now() - interval '7 days'");
    return r.rowCount ?? 0;
  }
}

export class PgRepositoryRepo implements RepositoryRepo {
  constructor(private db: Queryable) {}
  async create(r: { name: string; description: string; ownerId: string }) {
    const res = await this.db.query('INSERT INTO repositories (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *', [r.name, r.description, r.ownerId]);
    return mapRepository(res.rows[0]);
  }
  async findById(id: string) {
    const r = await this.db.query('SELECT * FROM repositories WHERE id = $1', [id]);
    return r.rows[0] ? mapRepository(r.rows[0]) : null;
  }
  async listForUser(userId: string, all: boolean) {
    const r = all
      ? await this.db.query("SELECT r.*, 'owner'::text AS role FROM repositories r ORDER BY r.created_at DESC")
      : await this.db.query(
          'SELECT r.*, m.role FROM repositories r JOIN repository_members m ON m.repo_id = r.id WHERE m.user_id = $1 ORDER BY r.created_at DESC',
          [userId],
        );
    return r.rows.map(mapRepositoryWithRole);
  }
  async lockForUpdate(id: string) {
    await this.db.query('SELECT id FROM repositories WHERE id = $1 FOR UPDATE', [id]);
  }
}

export class PgMemberRepo implements MemberRepo {
  constructor(private db: Queryable) {}
  async upsert(m: { repoId: string; userId: string; role: string; addedBy: string }) {
    await this.db.query(
      `INSERT INTO repository_members (repo_id, user_id, role, added_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (repo_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [m.repoId, m.userId, m.role, m.addedBy],
    );
  }
  async find(repoId: string, userId: string) {
    const r = await this.db.query('SELECT role FROM repository_members WHERE repo_id = $1 AND user_id = $2', [repoId, userId]);
    return r.rows[0]?.role ?? null;
  }
  async list(repoId: string) {
    const r = await this.db.query(
      `SELECT m.*, u.username, u.email FROM repository_members m JOIN users u ON u.id = m.user_id
       WHERE m.repo_id = $1 ORDER BY m.created_at`,
      [repoId],
    );
    return r.rows.map(mapMember);
  }
  async remove(repoId: string, userId: string) {
    const r = await this.db.query('DELETE FROM repository_members WHERE repo_id = $1 AND user_id = $2', [repoId, userId]);
    return (r.rowCount ?? 0) > 0;
  }
  async countOwners(repoId: string) {
    const r = await this.db.query("SELECT count(*)::int AS n FROM repository_members WHERE repo_id = $1 AND role = 'owner'", [repoId]);
    return r.rows[0].n;
  }
}
