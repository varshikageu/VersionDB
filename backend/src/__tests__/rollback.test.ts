
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CommitService } from '../application/commit/commit.service';
import type { Actor, Branch, Commit } from '../domain/types';
import { conflict } from '../shared/errors';

const repoId = 'repo-1';
const branchName = 'main';
const userId = 'user-1';
const headId = 'head-current';
const targetId = 'commit-target';
const newCommitId = 'commit-revert';

const actor: Actor = {
  userId,
  globalRole: 'user',
  ip: '127.0.0.1',
};

const branch: Branch = {
  id: 'branch-1',
  repoId,
  name: branchName,
  headCommitId: headId,
  createdBy: userId,
  createdAt: new Date(),
  protection: { requiredApprovals: 1 },
};

const targetCommit: Commit = {
  id: targetId,
  repoId,
  snapshotHash: 'target-hash',
  authorId: userId,
  authorName: 'tester',
  message: 'Original data',
  kind: 'normal',
  createdAt: new Date(),
  parents: [],
};

const restoredSnapshot = {
  users: {
    user1: { name: 'Restored user' },
  },
};

function setup(pendingCount = 0) {
  let protectedWriteAllowed = false;
  let createdInput: any;
  let headUpdated = false;
  let refUpdated = false;
  let auditLogged = false;
  let transactionCalled = false;

  const createdCommit: Commit = {
    id: newCommitId,
    repoId,
    snapshotHash: 'restored-hash',
    authorId: userId,
    authorName: 'tester',
    message: `Rollback to commit ${targetId}`,
    kind: 'revert',
    createdAt: new Date(),
    parents: [headId],
  };

  const repos: any = {
    branches: {
      lock: async () => branch,
      allowProtectedWrite: async () => {
        protectedWriteAllowed = true;
      },
      compareAndSetHead: async (
        _id: string,
        expected: string | null,
        next: string,
      ) => {
        assert.equal(expected, headId);
        assert.equal(next, newCommitId);
        headUpdated = true;
        return true;
      },
    },
    commits: {
      find: async (_repoId: string, id: string) =>
        id === targetId ? targetCommit : null,
      registerSnapshot: async () => {},
      insert: async (input: any) => {
        createdInput = input;
        return createdCommit;
      },
    },
    workingChanges: {
      count: async () => pendingCount,
      clear: async () => 0,
    },
  };

  const uow: any = {
  repos: {
    branches: {
      find: async (_repoId: string, _branchName: string) => branch,
    },
    commits: repos.commits,
    workingChanges: repos.workingChanges,
  },
  transaction: async (callback: (r: any) => Promise<unknown>) => {
    transactionCalled = true;
    return callback(repos);
  },
};

  const storage: any = {
    putSnapshot: async () => ({
      hash: 'restored-hash',
      recordCount: 1,
      sizeBytes: 25,
    }),
    updateRef: async (
      _repo: string,
      _branch: string,
      expected: string | null,
      next: string | null,
    ) => {
      assert.equal(expected, headId);
      assert.equal(next, newCommitId);
      refUpdated = true;
    },
  };

  const members: any = {
    authorize: async (
      _actor: Actor,
      _repo: string,
      capability: string,
    ) => {
      assert.equal(capability, 'commit:create');
      return { repo: { id: repoId }, role: 'maintainer' };
    },
  };

  const snapshots: any = {
    byHash: async (_repo: string, hash: string) => {
      assert.equal(hash, targetCommit.snapshotHash);
      return restoredSnapshot;
    },
  };

  const audit: any = {
    log: async (_repos: any, entry: any) => {
      assert.equal(entry.action, 'commit.rollback');
      assert.equal(entry.entityId, newCommitId);
      auditLogged = true;
    },
  };

  const service = new CommitService(
    uow,
    storage,
    members,
    snapshots,
    audit,
  );

  return {
    service,
    createdCommit,
    getState: () => ({
      protectedWriteAllowed,
      createdInput,
      headUpdated,
      refUpdated,
      auditLogged,
      transactionCalled,
    }),
  };
}

describe('CommitService.rollback', () => {
  it('creates a revert commit and updates a protected branch', async () => {
    const test = setup();

    const result = await test.service.rollback(
      actor,
      repoId,
      branchName,
      targetId,
    );

    assert.equal(result.kind, 'revert');
    assert.equal(result.id, newCommitId);

    const state = test.getState();
    assert.equal(state.createdInput.kind, 'revert');
    assert.deepEqual(state.createdInput.parents, [headId]);
    assert.equal(state.createdInput.snapshotHash, 'restored-hash');
    assert.equal(state.protectedWriteAllowed, true);
    assert.equal(state.headUpdated, true);
    assert.equal(state.refUpdated, true);
    assert.equal(state.auditLogged, true);
  });

  it('rejects rollback when the user has pending changes', async () => {
    const test = setup(1);

    await assert.rejects(
      () => test.service.rollback(actor, repoId, branchName, targetId),
      (error: any) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, 'PENDING_CHANGES');
        return true;
      },
    );

    const state = test.getState();
    assert.equal(state.transactionCalled, false);
    assert.equal(state.headUpdated, false);
    assert.equal(state.refUpdated, false);
  });

  it('rejects a target commit that does not exist', async () => {
    const test = setup();

    await assert.rejects(
      () => test.service.rollback(actor, repoId, branchName, 'missing-target'),
      (error: any) => {
        assert.equal(error.status, 404);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );

    const state = test.getState();
    assert.equal(state.transactionCalled, false);
    assert.equal(state.headUpdated, false);
  });
});
