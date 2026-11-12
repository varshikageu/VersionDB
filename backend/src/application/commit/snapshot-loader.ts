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

  /** Cache key for branch-head snapshot resolution */
  private branchKey(repoId: string, branchName: string): string {
    return `branch-snap:${repoId}:${branchName}`;
  }

  /** Invalidate branch-head cache when branch moves (commit, rollback, merge) */
  invalidateBranch(repoId: string, branchName: string): void {
    this.cache.delete(this.branchKey(repoId, branchName));
  }

  /** Resolves snapshot for a branch, utilizing branch-head caching with fast invalidation */
  async forBranch(repoId: string, branchName: string, headCommitId: string | null): Promise<SnapshotData> {
    const key = this.branchKey(repoId, branchName);
    const cached = this.cache.get<SnapshotData>(key);
    if (cached) return cached;
    const snap = await this.forCommit(repoId, headCommitId);
    this.cache.set(key, snap, 60_000);
    return snap;
  }
}

