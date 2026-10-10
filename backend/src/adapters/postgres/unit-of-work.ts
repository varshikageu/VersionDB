import type { Pool } from 'pg';
import type { Repositories, UnitOfWork } from '../../ports/repositories.port';
import { PgMemberRepo, PgRepositoryRepo, PgTokenRepo, PgUserRepo } from './identity.repositories';
import type { Queryable } from './pool';
import { PgAuditRepo, PgIdempotencyRepo } from './ops.repositories';
import { PgBranchRepo, PgCommitRepo, PgWorkingChangeRepo } from './version.repositories';

function build(db: Queryable, pool?: Pool): Repositories {
  return {
    users: new PgUserRepo(db), tokens: new PgTokenRepo(db), repositories: new PgRepositoryRepo(db), members: new PgMemberRepo(db),
    branches: new PgBranchRepo(db), commits: new PgCommitRepo(db), workingChanges: new PgWorkingChangeRepo(db),
    audit: new PgAuditRepo(db, pool), idempotency: new PgIdempotencyRepo(db),
  };
}

export class PgUnitOfWork implements UnitOfWork {
  readonly repos: Repositories;
  constructor(private pool: Pool) { this.repos = build(pool, pool); }

  async transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(build(client));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
  async ping() { await this.pool.query('SELECT 1'); }
  async close() { await this.pool.end(); }
}
