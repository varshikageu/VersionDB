import { LIMITS } from '../../config/constants';
import type { Actor, Commit } from '../../domain/types';
import { assertDirectWriteAllowed } from '../../domain/protected-branch';
import { applyChanges, hasRecord, countRecords, type RecordChange } from '../../domain/snapshot';
import type { UnitOfWork } from '../../ports/repositories.port';
import { StorageConflictError, type StoragePort } from '../../ports/storage.port';
import { badRequest, conflict, notFound } from '../../shared/errors';
import { jsonEqual } from '../../shared/json';
import type { AuditService } from '../audit/audit.service';
import type { MemberService } from '../member/member.service';
import type { SnapshotLoader } from './snapshot-loader';

export class CommitService {
  constructor(
    private uow: UnitOfWork, private storage: StoragePort, private members: MemberService,
    private snapshots: SnapshotLoader, private audit: AuditService,
  ) {}

  /**
   * Turns the caller's pending changes on a branch into one immutable commit.
   * Order: build snapshot -> store it (content-addressed, idempotent) -> DB transaction { lock branch, verify head,
   * insert commit, compare-and-swap head, move storage ref, clear pending, audit }. Any failure rolls the DB back.
   */
  async create(actor: Actor, repoId: string, branchName: string, rawMessage: string): Promise<Commit & { changeCount: number }> {
    await this.members.authorize(actor, repoId, 'commit:create');
    const message = rawMessage.trim();
    if (message.length < 1 || message.length > LIMITS.maxCommitMessage) throw badRequest('INVALID_MESSAGE', `Commit message must be 1-${LIMITS.maxCommitMessage} characters`);

    const branch = await this.uow.repos.branches.find(repoId, branchName);
    if (!branch) throw notFound('Branch');
    assertDirectWriteAllowed(branch);

    const pending = await this.uow.repos.workingChanges.list(branch.id, actor.userId);
    if (pending.length === 0) throw conflict('NOTHING_TO_COMMIT', 'There are no pending changes to commit');

    const base = await this.snapshots.forCommit(repoId, branch.headCommitId);
    const changes: RecordChange[] = pending.map((p) => ({ op: p.op, collection: p.collection, recordId: p.recordId, data: p.data }));
    // Drop no-ops (same value re-saved, delete of something already gone) so the commit only records real changes.
    const effective = changes.filter((c) => {
      const exists = hasRecord(base, c.collection, c.recordId);
      if (c.op === 'delete') return exists;
      return !exists || !jsonEqual(base[c.collection]![c.recordId], c.data);
    });
    if (effective.length === 0) {
      await this.uow.repos.workingChanges.clear(branch.id, actor.userId);
      throw conflict('NOTHING_TO_COMMIT', 'Pending changes match the current branch contents, so they were discarded');
    }

    const next = applyChanges(base, effective);
    const info = await this.storage.putSnapshot(repoId, next);
    const expectedHead = branch.headCommitId;

    try {
      const commit = await this.uow.transaction(async (repos) => {
        const locked = await repos.branches.lock(repoId, branchName);
        if (!locked) throw notFound('Branch');
        if (locked.headCommitId !== expectedHead) {
          throw conflict('HEAD_MOVED', 'The branch changed while you were committing. Review and try again.');
        }
        assertDirectWriteAllowed(locked);
        await repos.commits.registerSnapshot(repoId, info.hash, info.recordCount, info.sizeBytes);
        const created = await repos.commits.insert({
          repoId, snapshotHash: info.hash, authorId: actor.userId, message,
          kind: expectedHead === null ? 'initial' : 'normal', parents: expectedHead === null ? [] : [expectedHead],
        });
        if (!(await repos.branches.compareAndSetHead(locked.id, expectedHead, created.id))) {
          throw conflict('HEAD_MOVED', 'The branch changed while you were committing. Review and try again.');
        }
        await this.storage.updateRef(repoId, branchName, expectedHead, created.id);
        await repos.workingChanges.clear(locked.id, actor.userId);
        await this.audit.log(repos, {
          repoId, actorId: actor.userId, action: 'commit.create', entityType: 'commit', entityId: created.id,
          metadata: { branch: branchName, changes: effective.length, records: countRecords(next) }, ip: actor.ip,
        });
        return created;
      });
      return { ...commit, changeCount: effective.length };
    } catch (e) {
      if (e instanceof StorageConflictError) throw conflict('HEAD_MOVED', 'The branch changed while you were committing. Review and try again.');
      throw e;
    }
  }
  async rollback(
    actor: Actor,
    repoId: string,
    branchName: string,
    targetCommitId: string,
  ): Promise<Commit> {
    await this.members.authorize(actor, repoId, 'commit:create');

    const branch = await this.uow.repos.branches.find(repoId, branchName);
    if (!branch) throw notFound('Branch');

    const expectedHead = branch.headCommitId;
    if (expectedHead === null) {
      throw conflict('EMPTY_BRANCH', 'Cannot roll back a branch with no commits');
    }

    if (targetCommitId === expectedHead) {
      throw conflict('ALREADY_AT_TARGET', 'The branch is already at the target commit');
    }

    // A rollback must never silently discard the caller's pending work.
    const pendingCount = await this.uow.repos.workingChanges.count(
      branch.id,
      actor.userId,
    );
    if (pendingCount > 0) {
      throw conflict(
        'PENDING_CHANGES',
        'You have pending changes on this branch. Commit or discard them before rolling back.',
      );
    }

    const target = await this.uow.repos.commits.find(repoId, targetCommitId);
    if (!target) throw notFound('Target commit');

    // Snapshots are immutable, so storing this snapshot is safe before the transaction.
    const snapshot = await this.snapshots.byHash(repoId, target.snapshotHash);
    const info = await this.storage.putSnapshot(repoId, snapshot);

    try {
      return await this.uow.transaction(async (repos) => {
        const locked = await repos.branches.lock(repoId, branchName);
        if (!locked) throw notFound('Branch');

        if (locked.headCommitId !== expectedHead) {
          throw conflict(
            'HEAD_MOVED',
            'The branch changed while rolling back. Review and try again.',
          );
        }

        // Recheck inside the transaction so newly staged work is not silently lost.
        const latestPendingCount = await repos.workingChanges.count(
          locked.id,
          actor.userId,
        );
        if (latestPendingCount > 0) {
          throw conflict(
            'PENDING_CHANGES',
            'You have pending changes on this branch. Commit or discard them before rolling back.',
          );
        }

        await repos.commits.registerSnapshot(
          repoId,
          info.hash,
          info.recordCount,
          info.sizeBytes,
        );

        const created = await repos.commits.insert({
          repoId,
          snapshotHash: info.hash,
          authorId: actor.userId,
          message: `Rollback to commit ${targetCommitId}`,
          kind: 'revert',
          parents: [expectedHead],
        });

        // Only an explicit rollback may move a protected branch head.
        if (locked.protection) {
          await repos.branches.allowProtectedWrite();
        }

        if (!(await repos.branches.compareAndSetHead(
          locked.id,
          expectedHead,
          created.id,
        ))) {
          throw conflict(
            'HEAD_MOVED',
            'The branch changed while rolling back. Review and try again.',
          );
        }

        await this.storage.updateRef(
          repoId,
          branchName,
          expectedHead,
          created.id,
        );

        await this.audit.log(repos, {
          repoId,
          actorId: actor.userId,
          action: 'commit.rollback',
          entityType: 'commit',
          entityId: created.id,
          metadata: {
            branch: branchName,
            targetCommitId,
            previousHead: expectedHead,
            records: countRecords(snapshot),
          },
          ip: actor.ip,
        });

        return created;
      });
    } catch (e) {
      if (e instanceof StorageConflictError) {
        throw conflict(
          'HEAD_MOVED',
          'The branch changed while rolling back. Review and try again.',
        );
      }
      throw e;
    }
  }

}
