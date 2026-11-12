import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GarbageCollectionService } from '../application/storage/gc.service';

describe('Task C: Snapshot Garbage Collection & Reachability Analysis', () => {
  it('correctly marks reachable objects and sweeps orphaned snapshots in dry-run mode', async () => {
    const repoId = 'repo-gc-1';

    // Mock branches: main (head-1) and feature (head-2)
    const branches = [
      { id: 'b-main', repoId, name: 'main', headCommitId: 'commit-1' },
      { id: 'b-feat', repoId, name: 'feat', headCommitId: 'commit-2' },
    ];

    // Commits: commit-1 -> snap-hash-1, commit-2 -> snap-hash-2
    const commitsByHead: Record<string, any[]> = {
      'commit-1': [{ id: 'commit-1', snapshotHash: 'hash-reachable-1' }],
      'commit-2': [{ id: 'commit-2', snapshotHash: 'hash-reachable-2' }],
    };

    const storedHashes = [
      'hash-reachable-1',
      'hash-reachable-2',
      'hash-orphan-unreferenced-3',
      'hash-orphan-aborted-4',
    ];

    const deleted: string[] = [];

    const mockUow: any = {
      repos: {
        branches: {
          list: async (rId: string) => {
            assert.equal(rId, repoId);
            return branches;
          },
        },
        commits: {
          history: async (rId: string, headId: string) => {
            return commitsByHead[headId] || [];
          },
        },
      },
    };

    const mockStorage: any = {
      listSnapshotHashes: async (rId: string) => storedHashes,
      deleteSnapshot: async (rId: string, hash: string) => {
        deleted.push(hash);
        return true;
      },
    };

    const gc = new GarbageCollectionService(mockUow, mockStorage);

    // 1. Dry run
    const dryRunResult = await gc.run(repoId, { dryRun: true });
    assert.equal(dryRunResult.dryRun, true);
    assert.equal(dryRunResult.scannedCount, 4);
    assert.equal(dryRunResult.reachableCount, 2);
    assert.equal(dryRunResult.candidateCount, 2);
    assert.equal(dryRunResult.deletedCount, 0); // No deletes in dry run
    assert.deepEqual(dryRunResult.candidates.sort(), ['hash-orphan-aborted-4', 'hash-orphan-unreferenced-3']);
    assert.equal(deleted.length, 0);

    // 2. Active run
    const activeResult = await gc.run(repoId, { dryRun: false });
    assert.equal(activeResult.dryRun, false);
    assert.equal(activeResult.deletedCount, 2);
    assert.deepEqual(deleted.sort(), ['hash-orphan-aborted-4', 'hash-orphan-unreferenced-3']);
  });

  it('never deletes historical ancestor snapshots retained by commit history', async () => {
    const repoId = 'repo-gc-ancestor';

    const branches = [
      { id: 'b-main', repoId, name: 'main', headCommitId: 'head-commit' },
    ];

    // History includes head-commit AND its parent ancestor-commit
    const commitHistory = [
      { id: 'head-commit', snapshotHash: 'hash-head' },
      { id: 'ancestor-commit', snapshotHash: 'hash-ancestor' },
    ];

    const storedHashes = ['hash-head', 'hash-ancestor'];
    const deleted: string[] = [];

    const mockUow: any = {
      repos: {
        branches: {
          list: async () => branches,
        },
        commits: {
          history: async () => commitHistory,
        },
      },
    };

    const mockStorage: any = {
      listSnapshotHashes: async () => storedHashes,
      deleteSnapshot: async (_r: string, hash: string) => {
        deleted.push(hash);
        return true;
      },
    };

    const gc = new GarbageCollectionService(mockUow, mockStorage);
    const result = await gc.run(repoId, { dryRun: false });

    assert.equal(result.candidateCount, 0);
    assert.equal(result.deletedCount, 0);
    assert.equal(deleted.length, 0);
  });

  it('is idempotent when run repeatedly', async () => {
    const repoId = 'repo-gc-idempotent';
    const branches = [{ id: 'b-1', repoId, name: 'main', headCommitId: 'c-1' }];
    const commits = [{ id: 'c-1', snapshotHash: 'hash-active' }];
    let stored = ['hash-active', 'hash-orphan'];

    const mockUow: any = {
      repos: {
        branches: { list: async () => branches },
        commits: { history: async () => commits },
      },
    };

    const mockStorage: any = {
      listSnapshotHashes: async () => [...stored],
      deleteSnapshot: async (_r: string, hash: string) => {
        stored = stored.filter((h) => h !== hash);
        return true;
      },
    };

    const gc = new GarbageCollectionService(mockUow, mockStorage);

    // First run deletes the orphan
    const res1 = await gc.run(repoId, { dryRun: false });
    assert.equal(res1.deletedCount, 1);

    // Second run has 0 candidates and does nothing
    const res2 = await gc.run(repoId, { dryRun: false });
    assert.equal(res2.candidateCount, 0);
    assert.equal(res2.deletedCount, 0);
  });
});
