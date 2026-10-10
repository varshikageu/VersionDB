import type { Env } from './config/env';
import { AuditService } from './application/audit/audit.service';
import { AuthService } from './application/auth/auth.service';
import { CommitService } from './application/commit/commit.service';
import { SnapshotLoader } from './application/commit/snapshot-loader';
import { HistoryService } from './application/history/history.service';
import { IdempotencyService } from './application/idempotency/idempotency.service';
import { MemberService } from './application/member/member.service';
import { RecordService } from './application/record/record.service';
import { RepositoryService } from './application/repository/repository.service';
import { MemoryCache } from './adapters/cache/memory-cache.adapter';
import { createPool } from './adapters/postgres/pool';
import { PgUnitOfWork } from './adapters/postgres/unit-of-work';
import { LocalStorageAdapter } from './adapters/storage/local-storage.adapter';
import type { Logger } from './observability/logger';
import type { CachePort } from './ports/cache.port';
import type { UnitOfWork } from './ports/repositories.port';
import type { StoragePort } from './ports/storage.port';

export interface Container {
  env: Env;
  logger: Logger;
  uow: UnitOfWork;
  storage: StoragePort;
  cache: CachePort;
  services: {
    audit: AuditService; auth: AuthService; members: MemberService; repositories: RepositoryService;
    history: HistoryService; records: RecordService; commits: CommitService; idempotency: IdempotencyService;
  };
}

/** Composition root: the only place that knows which adapters implement which ports. */
export function buildContainer(env: Env, logger: Logger, overrides: { storage?: StoragePort } = {}): Container {
  const uow = new PgUnitOfWork(createPool(env));
  const storage = overrides.storage ?? new LocalStorageAdapter(env.DATA_DIR); // Role 2's engine replaces this stub
  const cache = new MemoryCache();

  const audit = new AuditService();
  const members = new MemberService(uow, audit);
  const snapshots = new SnapshotLoader(uow, storage, cache);
  const history = new HistoryService(uow, members);
  return {
    env, logger, uow, storage, cache,
    services: {
      audit,
      auth: new AuthService(uow, env, cache, audit),
      members,
      repositories: new RepositoryService(uow, storage, env, audit, members),
      history,
      records: new RecordService(uow, members, history, snapshots),
      commits: new CommitService(uow, storage, members, snapshots, audit),
      idempotency: new IdempotencyService(uow, env.IDEMPOTENCY_TTL_SECONDS),
    },
  };
}
