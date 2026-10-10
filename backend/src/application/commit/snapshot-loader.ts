import type { SnapshotData } from '../../domain/types';
import type { CachePort } from '../../ports/cache.port';
import type { UnitOfWork } from '../../ports/repositories.port';
import type { StoragePort } from '../../ports/storage.port';
import { notFound } from '../../shared/errors';

/** Reads the record data a commit points at. Snapshots are immutable, so they are cached by (repo, hash). Treat results as read-only. */
export class SnapshotLoader {
  constructor(private uow: UnitOfWork, private storage: StoragePort, private cache: CachePort) {}

  async byHash(repoId: string, hash: string): Promise<SnapshotData> {
    const key = `snap:${repoId}:${hash}`;
    const hit = this.cache.get<SnapshotData>(key);
    if (hit) return hit;
    const data = await this.storage.getSnapshot(repoId, hash);
    this.cache.set(key, data, 5 * 60_000);
    return data;
  }

  /** A null commit (empty branch) is the empty snapshot. */
  async forCommit(repoId: string, commitId: string | null): Promise<SnapshotData> {
    if (commitId === null) return {};
    const commit = await this.uow.repos.commits.find(repoId, commitId);
    if (!commit) throw notFound('Commit');
    return this.byHash(repoId, commit.snapshotHash);
  }
}
