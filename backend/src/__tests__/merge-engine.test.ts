import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { threeWayDiff, buildMergedSnapshot, findCommonAncestor } from '../domain/merge';
import type { SnapshotData } from '../domain/types';
import type { CommitRepo } from '../ports/repositories.port';

describe('Three-Way Merge Engine', () => {
  it('detects clean non-conflicting changes from both sides', () => {
    const base: SnapshotData = {
      users: {
        'u1': { name: 'Alice', age: 30 },
        'u2': { name: 'Bob', age: 25 },
      },
    };

    // Target (ours) changed u1's age to 31
    const ours: SnapshotData = {
      users: {
        'u1': { name: 'Alice', age: 31 },
        'u2': { name: 'Bob', age: 25 },
      },
    };

    // Source (theirs) added u3 and updated u2's name
    const theirs: SnapshotData = {
      users: {
        'u1': { name: 'Alice', age: 30 },
        'u2': { name: 'Robert', age: 25 },
        'u3': { name: 'Charlie', age: 20 },
      },
    };

    const diff = threeWayDiff(base, ours, theirs);
    assert.equal(diff.hasConflicts, false);
    assert.equal(diff.conflicts.length, 0);

    const merged = diff.cleanMerged;
    assert.deepEqual(merged.users['u1'], { name: 'Alice', age: 31 });
    assert.deepEqual(merged.users['u2'], { name: 'Robert', age: 25 });
    assert.deepEqual(merged.users['u3'], { name: 'Charlie', age: 20 });
  });

  it('detects field-level conflict when both sides modify the same field differently', () => {
    const base: SnapshotData = {
      products: {
        'p1': { title: 'Laptop', price: 1000, stock: 10 },
      },
    };

    const ours: SnapshotData = {
      products: {
        'p1': { title: 'Laptop Pro', price: 1000, stock: 8 },
      },
    };

    const theirs: SnapshotData = {
      products: {
        'p1': { title: 'Laptop Elite', price: 1000, stock: 8 },
      },
    };

    const diff = threeWayDiff(base, ours, theirs);
    assert.equal(diff.hasConflicts, true);
    assert.equal(diff.conflicts.length, 1);
    assert.equal(diff.conflicts[0].path, '/products/p1/title');
    assert.equal(diff.conflicts[0].oursValue, 'Laptop Pro');
    assert.equal(diff.conflicts[0].theirsValue, 'Laptop Elite');
  });

  it('detects record collision when one side deletes and other updates', () => {
    const base: SnapshotData = {
      orders: {
        'o1': { total: 50, status: 'pending' },
      },
    };

    // Ours deleted o1
    const ours: SnapshotData = {};

    // Theirs updated o1 status to 'shipped'
    const theirs: SnapshotData = {
      orders: {
        'o1': { total: 50, status: 'shipped' },
      },
    };

    const diff = threeWayDiff(base, ours, theirs);
    assert.equal(diff.hasConflicts, true);
    assert.equal(diff.conflicts.length, 1);
    assert.equal(diff.conflicts[0].path, '/orders/o1');
    assert.equal(diff.conflicts[0].oursExists, false);
    assert.equal(diff.conflicts[0].theirsExists, true);
  });

  it('correctly builds final merged snapshot applying conflict resolutions', () => {
    const base: SnapshotData = {
      settings: {
        'app': { theme: 'light', notifications: true },
      },
    };

    const ours: SnapshotData = {
      settings: {
        'app': { theme: 'dark', notifications: true },
      },
    };

    const theirs: SnapshotData = {
      settings: {
        'app': { theme: 'cyberpunk', notifications: true },
      },
    };

    const finalSnap = buildMergedSnapshot(base, ours, theirs, [
      {
        path: '/settings/app/theme',
        resolution: 'manual',
        resolvedExists: true,
        resolvedValue: 'midnight-blue',
      },
    ]);

    assert.deepEqual(finalSnap.settings['app'], {
      theme: 'midnight-blue',
      notifications: true,
    });
  });

  it('finds lowest common ancestor using commit graph traversal', async () => {
    const mockCommits: Record<string, { id: string; parents: string[] }> = {
      'c-root': { id: 'c-root', parents: [] },
      'c-main-1': { id: 'c-main-1', parents: ['c-root'] },
      'c-main-2': { id: 'c-main-2', parents: ['c-main-1'] },
      'c-feat-1': { id: 'c-feat-1', parents: ['c-main-1'] },
      'c-feat-2': { id: 'c-feat-2', parents: ['c-feat-1'] },
    };

    const mockCommitRepo: CommitRepo = {
      find: async (_repoId: string, id: string) => {
        const c = mockCommits[id];
        return c ? ({ id: c.id, parents: c.parents } as any) : null;
      },
    } as any;

    const lca = await findCommonAncestor(mockCommitRepo, 'repo-1', 'c-feat-2', 'c-main-2');
    assert.equal(lca, 'c-main-1');
  });

  it('detects conflict between changes on unrelated histories with empty virtual base', () => {
    const base: SnapshotData = {}; // empty virtual base for unrelated histories

    const ours: SnapshotData = {
      config: {
        'server': { host: 'localhost', port: 3000 },
      },
    };

    const theirs: SnapshotData = {
      config: {
        'server': { host: 'localhost', port: 8080 },
      },
    };

    const diff = threeWayDiff(base, ours, theirs);
    assert.equal(diff.hasConflicts, true);
    assert.equal(diff.conflicts.length, 1);
    assert.equal(diff.conflicts[0].path, '/config/server/port');
    assert.equal(diff.conflicts[0].oursValue, 3000);
    assert.equal(diff.conflicts[0].theirsValue, 8080);
  });
});
