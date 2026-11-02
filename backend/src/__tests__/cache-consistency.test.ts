import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SnapshotLoader } from '../application/commit/snapshot-loader';
import { MemoryCache } from '../adapters/cache/memory-cache.adapter';
import type { SnapshotData } from '../domain/types';

describe('Task D: Rollback and Branch-Head Cache Invalidation', () => {
  it('invalidates branch-head cache so subsequent read returns the rolled-back snapshot', async () => {
    const repoId = 'repo-cache-test';
    const branchName = 'main';

    const snapBefore: SnapshotData = {
      users: { 'u-1': { name: 'Alice Current' } },
    };
    const snapAfterRollback: SnapshotData = {
      users: { 'u-1': { name: 'Alice Restored' } },
    };

    let currentCommitId = 'commit-head-before';

    const mockUow: any = {
      repos: {
        commits: {
          find: async (_r: string, id: string) => {
            if (id === 'commit-head-before') return { snapshotHash: 'hash-before' };
            if (id === 'commit-head-after') return { snapshotHash: 'hash-after' };
            return null;
          },
        },
      },
    };

    let fetchCount = 0;
    const mockStorage: any = {
      getSnapshot: async (_r: string, hash: string) => {
        fetchCount++;
        if (hash === 'hash-before') return snapBefore;
        if (hash === 'hash-after') return snapAfterRollback;
        throw new Error('not found');
      },
    };

    const cache = new MemoryCache();
    const loader = new SnapshotLoader(mockUow, mockStorage, cache);

    // 1. First read on branch head populates branch cache
    const read1 = await loader.forBranch(repoId, branchName, currentCommitId);
    assert.deepEqual(read1, snapBefore);
    assert.equal(fetchCount, 1);

    // 2. Second read without head moving hits cache
    const readCached = await loader.forBranch(repoId, branchName, currentCommitId);
    assert.deepEqual(readCached, snapBefore);
    assert.equal(fetchCount, 1); // No extra storage fetch

    // 3. Rollback occurs: head moves and branch cache is invalidated
    currentCommitId = 'commit-head-after';
    loader.invalidateBranch(repoId, branchName);

    // 4. Subsequent read on branch returns the restored version, not stale cache
    const readRestored = await loader.forBranch(repoId, branchName, currentCommitId);
    assert.deepEqual(readRestored, snapAfterRollback);
    assert.equal(fetchCount, 2); // Fetched new snapshot
  });

  it('preserves immutable snapshot-by-hash cache while invalidating branch head', async () => {
    const repoId = 'repo-hash-cache';
    const snap: SnapshotData = { items: { 'i-1': { count: 10 } } };

    let storageFetches = 0;
    const mockStorage: any = {
      getSnapshot: async () => {
        storageFetches++;
        return snap;
      },
    };

    const cache = new MemoryCache();
    const loader = new SnapshotLoader({} as any, mockStorage, cache);

    // Load by hash
    const res1 = await loader.byHash(repoId, 'hash-xyz');
    assert.deepEqual(res1, snap);
    assert.equal(storageFetches, 1);

    // Invalidate branch main
    loader.invalidateBranch(repoId, 'main');

    // Hash cache is immutable and must still be intact
    const res2 = await loader.byHash(repoId, 'hash-xyz');
    assert.deepEqual(res2, snap);
    assert.equal(storageFetches, 1); // Hit cache
  });
});
