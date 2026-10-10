import { LIMITS } from '../../config/constants';
import type { Actor, JsonValue, WorkingChange } from '../../domain/types';
import { assertDirectWriteAllowed } from '../../domain/protected-branch';
import { assertValidNames, hasRecord } from '../../domain/snapshot';
import type { UnitOfWork } from '../../ports/repositories.port';
import { badRequest, conflict, notFound, unprocessable } from '../../shared/errors';
import { isPlainObject, jsonBytes, withinDepth } from '../../shared/json';
import type { SnapshotLoader } from '../commit/snapshot-loader';
import type { HistoryService } from '../history/history.service';
import type { MemberService } from '../member/member.service';

export class RecordService {
  constructor(
    private uow: UnitOfWork, private members: MemberService, private history: HistoryService, private snapshots: SnapshotLoader,
  ) {}

  private async branchFor(repoId: string, name: string) {
    const branch = await this.uow.repos.branches.find(repoId, name);
    if (!branch) throw notFound('Branch');
    return branch;
  }

  /** Without `collection`: the collections and their sizes. With it: one page of records, ordered by id. `ref` = branch or commit id. */
  async read(actor: Actor, repoId: string, ref: string, opts: { collection?: string; limit: number; after?: string }) {
    await this.members.authorize(actor, repoId, 'repo:read');
    const commitId = await this.history.resolveCommitId(repoId, ref);
    const snapshot = await this.snapshots.forCommit(repoId, commitId);
    if (!opts.collection) {
      const collections = Object.entries(snapshot).map(([name, recs]) => ({ name, count: Object.keys(recs).length }));
      return { commitId, collections: collections.sort((a, b) => a.name.localeCompare(b.name)) };
    }
    assertValidNames(opts.collection);
    const records = snapshot[opts.collection] ?? {};
    const limit = Math.min(opts.limit, LIMITS.maxRecordPage);
    const ids = Object.keys(records).sort().filter((id) => (opts.after ? id > opts.after : true));
    const page = ids.slice(0, limit);
    return {
      commitId, collection: opts.collection,
      records: page.map((id) => ({ id, data: records[id] as JsonValue })),
      nextAfter: ids.length > limit ? page[page.length - 1] ?? null : null,
    };
  }

  async getOne(actor: Actor, repoId: string, branchName: string, collection: string, recordId: string) {
    await this.members.authorize(actor, repoId, 'repo:read');
    assertValidNames(collection, recordId);
    const branch = await this.branchFor(repoId, branchName);
    const snapshot = await this.snapshots.forCommit(repoId, branch.headCommitId);
    const committed = hasRecord(snapshot, collection, recordId) ? (snapshot[collection]![recordId] as JsonValue) : null;
    const pendingRows = (await this.uow.repos.workingChanges.list(branch.id, actor.userId))
      .filter((c) => c.collection === collection && c.recordId === recordId);
    const pending = pendingRows[0] ? { op: pendingRows[0].op, data: pendingRows[0].data } : null;
    if (committed === null && !pending) throw notFound('Record');
    return { collection, id: recordId, committed, pending };
  }

  /** Stage an insert/update in the caller's working state on this branch. Nothing is committed yet. */
  async stagePut(actor: Actor, repoId: string, branchName: string, collection: string, recordId: string, data: unknown): Promise<WorkingChange> {
    await this.members.authorize(actor, repoId, 'record:write');
    assertValidNames(collection, recordId);
    if (!isPlainObject(data)) throw badRequest('INVALID_RECORD', 'A record must be a JSON object');
    if (!withinDepth(data, LIMITS.maxJsonDepth)) throw unprocessable('RECORD_TOO_DEEP', `Records may nest at most ${LIMITS.maxJsonDepth} levels`);
    if (jsonBytes(data) > LIMITS.maxRecordBytes) throw unprocessable('RECORD_TOO_LARGE', `Records may be at most ${LIMITS.maxRecordBytes} bytes`);
    const branch = await this.branchFor(repoId, branchName);
    assertDirectWriteAllowed(branch);
    await this.assertRoomForChange(branch.id, actor.userId, collection, recordId);
    await this.uow.repos.workingChanges.upsert({ repoId, branchId: branch.id, userId: actor.userId, collection, recordId, op: 'put', data: data as JsonValue });
    return { collection, recordId, op: 'put', data: data as JsonValue, updatedAt: new Date() };
  }

  /** Stage a deletion. Deleting a record that exists only as a pending insert simply drops the pending insert. */
  async stageDelete(actor: Actor, repoId: string, branchName: string, collection: string, recordId: string): Promise<void> {
    await this.members.authorize(actor, repoId, 'record:write');
    assertValidNames(collection, recordId);
    const branch = await this.branchFor(repoId, branchName);
    assertDirectWriteAllowed(branch);
    const snapshot = await this.snapshots.forCommit(repoId, branch.headCommitId);
    if (!hasRecord(snapshot, collection, recordId)) {
      if (await this.uow.repos.workingChanges.removeOne(branch.id, actor.userId, collection, recordId)) return;
      throw notFound('Record');
    }
    await this.assertRoomForChange(branch.id, actor.userId, collection, recordId);
    await this.uow.repos.workingChanges.upsert({ repoId, branchId: branch.id, userId: actor.userId, collection, recordId, op: 'delete', data: null });
  }

  async listPending(actor: Actor, repoId: string, branchName: string): Promise<WorkingChange[]> {
    await this.members.authorize(actor, repoId, 'repo:read');
    const branch = await this.branchFor(repoId, branchName);
    return this.uow.repos.workingChanges.list(branch.id, actor.userId);
  }

  async discard(actor: Actor, repoId: string, branchName: string): Promise<number> {
    await this.members.authorize(actor, repoId, 'record:write');
    const branch = await this.branchFor(repoId, branchName);
    return this.uow.repos.workingChanges.clear(branch.id, actor.userId);
  }

  private async assertRoomForChange(branchId: string, userId: string, collection: string, recordId: string): Promise<void> {
    const existing = (await this.uow.repos.workingChanges.list(branchId, userId)).some((c) => c.collection === collection && c.recordId === recordId);
    if (!existing && (await this.uow.repos.workingChanges.count(branchId, userId)) >= LIMITS.maxPendingChanges) {
      throw conflict('TOO_MANY_PENDING_CHANGES', `At most ${LIMITS.maxPendingChanges} uncommitted changes per branch; commit or discard first`);
    }
  }
}
