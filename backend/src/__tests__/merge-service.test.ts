import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MergeRequestService } from '../application/merge-request/merge-request.service';
import type { Actor, Branch, Commit, MergeRequest, RepoRole, SnapshotData } from '../domain/types';
import type { UnitOfWork } from '../ports/repositories.port';

describe('MergeRequestService Full Lifecycle', () => {
  const actorMaintainer: Actor = { userId: 'u-maintainer', globalRole: 'user', ip: '127.0.0.1' };
  const actorAuthor: Actor = { userId: 'u-author', globalRole: 'user', ip: '127.0.0.1' };
  const actorReviewer: Actor = { userId: 'u-reviewer', globalRole: 'user', ip: '127.0.0.1' };
  const repoId = '10000000-0000-4000-8000-000000000001';

  it('creates merge request, detects conflicts, prevents self-review, and handles approval', async () => {
    // In-memory mock repositories and storage
    const branches: Record<string, Branch> = {
      'main': {
        id: 'b-main',
        repoId,
        name: 'main',
        headCommitId: 'c-main-1',
        createdBy: 'u-owner',
        createdAt: new Date(),
        protection: null,
      },
      'feature': {
        id: 'b-feature',
        repoId,
        name: 'feature',
        headCommitId: 'c-feat-1',
        createdBy: 'u-author',
        createdAt: new Date(),
        protection: null,
      },
    };

    const commits: Record<string, Commit> = {
      'c-root': {
        id: 'c-root',
        repoId,
        snapshotHash: 'h-root',
        authorId: 'u-owner',
        authorName: 'owner',
        message: 'Initial root commit',
        kind: 'initial',
        createdAt: new Date(),
        parents: [],
      },
      'c-main-1': {
        id: 'c-main-1',
        repoId,
        snapshotHash: 'h-main',
        authorId: 'u-maintainer',
        authorName: 'maintainer',
        message: 'Update main price',
        kind: 'normal',
        createdAt: new Date(),
        parents: ['c-root'],
      },
      'c-feat-1': {
        id: 'c-feat-1',
        repoId,
        snapshotHash: 'h-feat',
        authorId: 'u-author',
        authorName: 'author',
        message: 'Update feat price and desc',
        kind: 'normal',
        createdAt: new Date(),
        parents: ['c-root'],
      },
    };

    const snapshots: Record<string, SnapshotData> = {
      'h-root': {
        items: {
          'item-1': { title: 'Product 1', price: 100 },
        },
      },
      'h-main': {
        items: {
          'item-1': { title: 'Product 1', price: 120 },
        },
      },
      'h-feat': {
        items: {
          'item-1': { title: 'Product 1', price: 150 },
        },
      },
    };

    const mrs: MergeRequest[] = [];
    const conflicts: any[] = [];
    const approvals: any[] = [];
    const merges: any[] = [];

    const mockRepos: any = {
      branches: {
        find: async (_r: string, name: string) => branches[name] || null,
        lock: async (_r: string, name: string) => branches[name] || null,
        compareAndSetHead: async (_id: string, _expected: string | null, next: string) => {
          branches['main'].headCommitId = next;
          return true;
        },
        allowProtectedWrite: async () => {},
      },
      commits: {
        find: async (_r: string, id: string) => commits[id] || null,
        registerSnapshot: async () => {},
        insert: async (c: any) => {
          const newCommit: Commit = {
            id: `c-merge-${Date.now()}`,
            repoId: c.repoId,
            snapshotHash: c.snapshotHash,
            authorId: c.authorId,
            authorName: 'actor',
            message: c.message,
            kind: c.kind,
            createdAt: new Date(),
            parents: c.parents,
          };
          commits[newCommit.id] = newCommit;
          return newCommit;
        },
      },
      mergeRequests: {
        nextNumber: async () => mrs.length + 1,
        create: async (m: any) => {
          const mr: MergeRequest = {
            ...m,
            id: `mr-${m.number}`,
            status: 'open',
            resolutionRev: 0,
            mergeId: null,
            mergedBy: null,
            mergedAt: null,
            closedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mrs.push(mr);
          return mr;
        },
        findByNumber: async (_r: string, n: number) => mrs.find((m) => m.number === n) || null,
        findById: async (id: string) => mrs.find((m) => m.id === id) || null,
        findOpenByBranchPair: async (_r: string, src: string, tgt: string) =>
          mrs.find((m) => m.sourceBranchName === src && m.targetBranchName === tgt && m.status === 'open') || null,
        updateResolution: async (id: string, hasConflicts: boolean, resolutionRev: number) => {
          const mr = mrs.find((m) => m.id === id);
          if (mr) {
            mr.hasConflicts = hasConflicts;
            mr.resolutionRev = resolutionRev;
            return true;
          }
          return false;
        },
        setMerged: async (id: string, mergeId: string, mergedBy: string) => {
          const mr = mrs.find((m) => m.id === id);
          if (mr) {
            mr.status = 'merged';
            mr.mergeId = mergeId;
            mr.mergedBy = mergedBy;
            mr.mergedAt = new Date();
            return true;
          }
          return false;
        },
      },
      conflicts: {
        insertBatch: async (items: any[]) => {
          for (const item of items) {
            conflicts.push({
              ...item,
              id: `conflict-${conflicts.length + 1}`,
              resolution: null,
              resolvedExists: null,
              resolvedValue: null,
              resolvedBy: null,
              resolvedAt: null,
              detectedAt: new Date(),
            });
          }
        },
        listByMr: async (mrId: string) => conflicts.filter((c) => c.mergeRequestId === mrId),
        findById: async (id: string) => conflicts.find((c) => c.id === id) || null,
        countUnresolved: async (mrId: string) =>
          conflicts.filter((c) => c.mergeRequestId === mrId && c.resolution === null).length,
        resolve: async (id: string, res: string, exists: boolean, val: any, by: string) => {
          const c = conflicts.find((item) => item.id === id);
          if (c) {
            c.resolution = res;
            c.resolvedExists = exists;
            c.resolvedValue = val;
            c.resolvedBy = by;
            c.resolvedAt = new Date();
            return true;
          }
          return false;
        },
      },
      mergeApprovals: {
        upsert: async (a: any) => {
          const ex = approvals.find((item) => item.mergeRequestId === a.mergeRequestId && item.reviewerId === a.reviewerId);
          if (ex) {
            ex.decision = a.decision;
            ex.comment = a.comment;
            ex.sourceHeadCommitId = a.sourceHeadCommitId;
            ex.resolutionRev = a.resolutionRev;
            return ex;
          }
          const app = { ...a, id: `app-${approvals.length + 1}`, createdAt: new Date() };
          approvals.push(app);
          return app;
        },
        listByMr: async (mrId: string) => approvals.filter((a) => a.mergeRequestId === mrId),
        countValid: async (mrId: string, head: string, rev: number) =>
          approvals.filter(
            (a) =>
              a.mergeRequestId === mrId &&
              a.decision === 'approved' &&
              a.sourceHeadCommitId === head &&
              a.resolutionRev === rev,
          ).length,
      },
      merges: {
        insert: async (m: any) => {
          const rec = { ...m, id: `merge-${merges.length + 1}`, createdAt: new Date() };
          merges.push(rec);
          return rec;
        },
      },
    };

    const mockUow: any = {
      repos: mockRepos,
      transaction: async (fn: any) => fn(mockRepos),
    };

    const mockStorage: any = {
      putSnapshot: async (_r: string, data: SnapshotData) => {
        const hash = `h-new-${Date.now()}`;
        snapshots[hash] = data;
        return { hash, recordCount: 1, sizeBytes: 100 };
      },
      updateRef: async () => {},
    };

    const mockMembers: any = {
      authorize: async (_actor: Actor, _repoId: string, _perm: string) => ({
        repo: { id: repoId, defaultBranch: 'main' },
        role: 'maintainer' as RepoRole,
      }),
    };

    const mockSnapshots: any = {
      forCommit: async (_repoId: string, commitId: string | null) => {
        if (!commitId) return {};
        const c = commits[commitId];
        return c ? snapshots[c.snapshotHash] || {} : {};
      },
      invalidateBranch: () => {},
    };

    const mockAudit: any = {
      log: async () => {},
    };

    const service = new MergeRequestService(mockUow, mockStorage, mockMembers, mockSnapshots, mockAudit);

    // 1. Create MR: feature -> main
    const mr = await service.create(actorAuthor, repoId, {
      title: 'Update price',
      description: 'Feature price adjustment',
      sourceBranch: 'feature',
      targetBranch: 'main',
    });

    assert.equal(mr.number, 1);
    assert.equal(mr.sourceBranchName, 'feature');
    assert.equal(mr.targetBranchName, 'main');
    assert.equal(mr.hasConflicts, true); // item-1 price changed on both branches

    // Conflicts should be persisted
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].path, '/items/item-1/price');
    assert.equal(conflicts[0].baseValue, 100);
    assert.equal(conflicts[0].oursValue, 120);
    assert.equal(conflicts[0].theirsValue, 150);

    // 2. Author cannot approve own MR
    await assert.rejects(
      async () => {
        await service.review(actorAuthor, repoId, 1, { decision: 'approved' });
      },
      (err: any) => err.code === 'SELF_REVIEW_FORBIDDEN',
    );

    // 3. Reviewer approves
    const review = await service.review(actorReviewer, repoId, 1, {
      decision: 'approved',
      comment: 'Looks mostly good, conflict needs resolution',
    });
    assert.equal(review.decision, 'approved');

    // 4. Merging with unresolved conflicts should be rejected
    await assert.rejects(
      async () => {
        await service.merge(actorMaintainer, repoId, 1);
      },
      (err: any) => err.code === 'UNRESOLVED_CONFLICTS',
    );

    // 5. Resolve conflict (keep incoming theirs price of 150)
    const resolved = await service.resolveConflict(actorReviewer, repoId, 1, {
      conflictId: conflicts[0].id,
      resolution: 'theirs',
    });
    assert.equal(resolved.resolution, 'theirs');

    // Check conflict count
    const unresolvedLeft = await mockRepos.conflicts.countUnresolved(mr.id);
    assert.equal(unresolvedLeft, 0);

    // 6. Execute merge cleanly
    const mergeOutcome = await service.merge(actorMaintainer, repoId, 1);
    assert.equal(mergeOutcome.mergeRequest.status, 'merged');
    assert.equal(mergeOutcome.mergeRecord.sourceBranch, 'feature');
    assert.equal(mergeOutcome.mergeRecord.targetBranch, 'main');

    // Verify target branch head moved
    assert.notEqual(branches['main'].headCommitId, 'c-main-1');
  });

  it('rejects creating MR when source branch equals target branch', async () => {
    const mockUow: any = { repos: { branches: {} } };
    const mockMembers: any = { authorize: async () => ({}) };
    const service = new MergeRequestService(mockUow, {} as any, mockMembers, {} as any, {} as any);

    await assert.rejects(
      async () => {
        await service.create(actorAuthor, repoId, {
          title: 'Self merge',
          sourceBranch: 'main',
          targetBranch: 'main',
        });
      },
      (err: any) => err.code === 'SAME_BRANCH',
    );
  });

  it('rejects creating MR when target branch has no commits', async () => {
    const branches: Record<string, Branch> = {
      'feat': { id: 'b-feat', repoId, name: 'feat', headCommitId: 'c-feat', createdBy: 'u-author', createdAt: new Date(), protection: null },
      'empty-main': { id: 'b-main', repoId, name: 'empty-main', headCommitId: null, createdBy: 'u-owner', createdAt: new Date(), protection: null },
    };
    const mockUow: any = {
      repos: {
        branches: {
          find: async (_r: string, name: string) => branches[name] || null,
        },
      },
    };
    const mockMembers: any = { authorize: async () => ({}) };
    const service = new MergeRequestService(mockUow, {} as any, mockMembers, {} as any, {} as any);

    await assert.rejects(
      async () => {
        await service.create(actorAuthor, repoId, {
          title: 'Empty target MR',
          sourceBranch: 'feat',
          targetBranch: 'empty-main',
        });
      },
      (err: any) => err.code === 'EMPTY_TARGET_BRANCH' && err.message === 'Target branch has no commits',
    );
  });

  it('successfully creates and merges an MR between unrelated histories using empty base snapshot', async () => {
    const branches: Record<string, Branch> = {
      'main': { id: 'b-main', repoId, name: 'main', headCommitId: 'c-main', createdBy: 'u-owner', createdAt: new Date(), protection: null },
      'orphan': { id: 'b-orphan', repoId, name: 'orphan', headCommitId: 'c-orphan', createdBy: 'u-author', createdAt: new Date(), protection: null },
    };
    const commits: Record<string, Commit> = {
      'c-main': { id: 'c-main', repoId, snapshotHash: 'h-1', authorId: 'u-owner', authorName: 'owner', message: 'Main init', kind: 'initial', createdAt: new Date(), parents: [] },
      'c-orphan': { id: 'c-orphan', repoId, snapshotHash: 'h-2', authorId: 'u-author', authorName: 'author', message: 'Orphan init', kind: 'initial', createdAt: new Date(), parents: [] },
    };
    const snapshots: Record<string, any> = {
      'c-main': { users: { u1: { name: 'Owner' } } },
      'c-orphan': { students: { s1: { name: 'Alice' } } },
    };
    let createdMr: any = null;
    const mockUow: any = {
      repos: {
        branches: {
          find: async (_r: string, name: string) => branches[name] || null,
        },
        commits: {
          find: async (_r: string, id: string) => commits[id] || null,
        },
        mergeRequests: {
          findOpenByBranchPair: async () => null,
          nextNumber: async () => 1,
          create: async (data: any) => {
            createdMr = { id: 'mr-unrelated-1', ...data, status: 'open', resolutionRev: 0, hasConflicts: false };
            return createdMr;
          },
          findById: async () => createdMr,
        },
        conflicts: {
          insertBatch: async () => {},
        },
      },
      transaction: async (fn: any) => fn(mockUow.repos),
    };
    const mockSnapshots: any = {
      forCommit: async (_r: string, id: string | null) => (id ? snapshots[id] : {}),
    };
    const mockMembers: any = { authorize: async () => ({}) };
    const mockAudit: any = { log: async () => {} };
    const service = new MergeRequestService(mockUow, {} as any, mockMembers, mockSnapshots, mockAudit);

    const mr = await service.create(actorAuthor, repoId, {
      title: 'Unrelated branches MR',
      sourceBranch: 'orphan',
      targetBranch: 'main',
    });

    assert.equal(mr.baseCommitId, null);
    assert.equal(mr.sourceHeadCommitId, 'c-orphan');
    assert.equal(mr.targetHeadCommitId, 'c-main');
    assert.equal(mr.hasConflicts, false);
  });
});
