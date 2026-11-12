import type { Actor, ApprovalDecision, ConflictResolutionMode, JsonValue, MergeApproval, MergeConflict, MergeRecord, MergeRequest } from '../../domain/types';
import type { UnitOfWork } from '../../ports/repositories.port';
import type { StoragePort } from '../../ports/storage.port';
import type { MemberService } from '../member/member.service';
import type { SnapshotLoader } from '../commit/snapshot-loader';
import type { AuditService } from '../audit/audit.service';
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors';
import { buildMergedSnapshot, findCommonAncestor, threeWayDiff } from '../../domain/merge';
import { countRecords } from '../../domain/snapshot';
import { assertDirectWriteAllowed } from '../../domain/protected-branch';

export interface CreateMergeRequestInput {
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface ReviewMergeRequestInput {
  decision: ApprovalDecision;
  comment?: string;
}

export interface ResolveConflictInput {
  conflictId: string;
  resolution: ConflictResolutionMode;
  manualValue?: JsonValue;
  auditNote?: string;
}

export class MergeRequestService {
  constructor(
    private uow: UnitOfWork,
    private storage: StoragePort,
    private members: MemberService,
    private snapshots: SnapshotLoader,
    private audit: AuditService,
  ) {}

  /**
   * Creates a new merge request after validating branches, computing LCA, and scanning for 3-way conflicts.
   */
  async create(actor: Actor, repoId: string, input: CreateMergeRequestInput): Promise<MergeRequest> {
    await this.members.authorize(actor, repoId, 'merge:create');

    const title = input.title?.trim();
    if (!title || title.length > 200) {
      throw badRequest('INVALID_TITLE', 'Title must be between 1 and 200 characters');
    }
    const description = (input.description ?? '').trim();
    if (description.length > 5000) {
      throw badRequest('INVALID_DESCRIPTION', 'Description must not exceed 5000 characters');
    }

    const sourceBranchName = input.sourceBranch?.trim();
    const targetBranchName = input.targetBranch?.trim();
    if (!sourceBranchName || !targetBranchName) {
      throw badRequest('INVALID_BRANCHES', 'Source and target branches are required');
    }
    if (sourceBranchName === targetBranchName) {
      throw badRequest('SAME_BRANCH', 'Cannot create a merge request into the same branch');
    }

    const sourceBranch = await this.uow.repos.branches.find(repoId, sourceBranchName);
    if (!sourceBranch) throw notFound('Source branch');
    const targetBranch = await this.uow.repos.branches.find(repoId, targetBranchName);
    if (!targetBranch) throw notFound('Target branch');

    if (!sourceBranch.headCommitId) {
      throw conflict('EMPTY_SOURCE_BRANCH', 'Source branch has no commits');
    }
    if (!targetBranch.headCommitId) {
      throw conflict('EMPTY_TARGET_BRANCH', 'Target branch has no commits');
    }

    // Check if an open MR already exists for this pair
    const existing = await this.uow.repos.mergeRequests.findOpenByBranchPair(repoId, sourceBranchName, targetBranchName);
    if (existing) {
      throw conflict('MR_ALREADY_EXISTS', `An open merge request already exists for ${sourceBranchName} -> ${targetBranchName} (#${existing.number})`);
    }

    // Three-way merge calculation
    const baseCommitId = await findCommonAncestor(
      this.uow.repos.commits,
      repoId,
      sourceBranch.headCommitId,
      targetBranch.headCommitId,
    );

    // If branches have no common ancestor, treat as an unrelated-histories merge with virtual empty base snapshot
    const baseSnapshot = baseCommitId ? await this.snapshots.forCommit(repoId, baseCommitId) : {};
    const sourceSnapshot = await this.snapshots.forCommit(repoId, sourceBranch.headCommitId);
    const targetSnapshot = await this.snapshots.forCommit(repoId, targetBranch.headCommitId);

    const diffResult = threeWayDiff(baseSnapshot, targetSnapshot, sourceSnapshot);

    return this.uow.transaction(async (repos) => {
      const nextNum = await repos.mergeRequests.nextNumber(repoId);
      const mr = await repos.mergeRequests.create({
        repoId,
        number: nextNum,
        title,
        description,
        sourceBranchId: sourceBranch.id,
        targetBranchId: targetBranch.id,
        sourceBranchName,
        targetBranchName,
        authorId: actor.userId,
        baseCommitId,
        sourceHeadCommitId: sourceBranch.headCommitId!,
        targetHeadCommitId: targetBranch.headCommitId!,
        hasConflicts: diffResult.hasConflicts,
      });

      if (diffResult.hasConflicts) {
        await repos.conflicts.insertBatch(
          diffResult.conflicts.map((c) => ({
            mergeRequestId: mr.id,
            path: c.path,
            baseExists: c.baseExists,
            baseValue: c.baseValue,
            oursExists: c.oursExists,
            oursValue: c.oursValue,
            theirsExists: c.theirsExists,
            theirsValue: c.theirsValue,
          })),
        );
      }

      await this.audit.log(repos, {
        repoId,
        actorId: actor.userId,
        action: 'merge_request.create',
        entityType: 'merge_request',
        entityId: mr.id,
        metadata: {
          number: mr.number,
          source: sourceBranchName,
          target: targetBranchName,
          conflicts: diffResult.conflicts.length,
        },
        ip: actor.ip,
      });

      return mr;
    });
  }

  async list(actor: Actor, repoId: string, status?: string): Promise<MergeRequest[]> {
    await this.members.authorize(actor, repoId, 'repo:read');
    return this.uow.repos.mergeRequests.list(repoId, status);
  }

  async get(actor: Actor, repoId: string, mrNumber: number): Promise<{
    mergeRequest: MergeRequest;
    approvals: MergeApproval[];
    conflicts: MergeConflict[];
  }> {
    await this.members.authorize(actor, repoId, 'repo:read');
    const mr = await this.uow.repos.mergeRequests.findByNumber(repoId, mrNumber);
    if (!mr) throw notFound('Merge request');

    const [approvals, conflicts] = await Promise.all([
      this.uow.repos.mergeApprovals.listByMr(mr.id),
      this.uow.repos.conflicts.listByMr(mr.id),
    ]);

    return { mergeRequest: mr, approvals, conflicts };
  }

  async review(actor: Actor, repoId: string, mrNumber: number, input: ReviewMergeRequestInput): Promise<MergeApproval> {
    await this.members.authorize(actor, repoId, 'merge:review');

    const mr = await this.uow.repos.mergeRequests.findByNumber(repoId, mrNumber);
    if (!mr) throw notFound('Merge request');
    if (mr.status !== 'open') throw conflict('NOT_OPEN', `Merge request #${mrNumber} is already ${mr.status}`);

    if (mr.authorId === actor.userId) {
      throw forbidden('SELF_REVIEW_FORBIDDEN', 'Authors cannot review their own merge request');
    }

    const comment = (input.comment ?? '').trim();
    if (comment.length > 2000) {
      throw badRequest('INVALID_COMMENT', 'Review comment must not exceed 2000 characters');
    }

    return this.uow.transaction(async (repos) => {
      const approval = await repos.mergeApprovals.upsert({
        mergeRequestId: mr.id,
        reviewerId: actor.userId,
        decision: input.decision,
        comment,
        sourceHeadCommitId: mr.sourceHeadCommitId,
        resolutionRev: mr.resolutionRev,
      });

      await this.audit.log(repos, {
        repoId,
        actorId: actor.userId,
        action: `merge_request.review.${input.decision}`,
        entityType: 'merge_request',
        entityId: mr.id,
        metadata: {
          number: mrNumber,
          decision: input.decision,
        },
        ip: actor.ip,
      });

      return approval;
    });
  }

  async resolveConflict(actor: Actor, repoId: string, mrNumber: number, input: ResolveConflictInput): Promise<MergeConflict> {
    await this.members.authorize(actor, repoId, 'merge:review');

    const mr = await this.uow.repos.mergeRequests.findByNumber(repoId, mrNumber);
    if (!mr) throw notFound('Merge request');
    if (mr.status !== 'open') throw conflict('NOT_OPEN', `Merge request #${mrNumber} is ${mr.status}`);

    const item = await this.uow.repos.conflicts.findById(input.conflictId);
    if (!item || item.mergeRequestId !== mr.id) throw notFound('Conflict');

    let resolvedExists = true;
    let resolvedValue: JsonValue | null = null;

    if (input.resolution === 'ours') {
      resolvedExists = item.oursExists;
      resolvedValue = item.oursValue;
    } else if (input.resolution === 'theirs') {
      resolvedExists = item.theirsExists;
      resolvedValue = item.theirsValue;
    } else if (input.resolution === 'manual') {
      resolvedExists = input.manualValue !== undefined;
      resolvedValue = input.manualValue ?? null;
    } else {
      throw badRequest('INVALID_RESOLUTION', 'Invalid resolution mode');
    }

    return this.uow.transaction(async (repos) => {
      await repos.conflicts.resolve(item.id, input.resolution, resolvedExists, resolvedValue, actor.userId);

      const unresolvedCount = await repos.conflicts.countUnresolved(mr.id);
      const hasConflicts = unresolvedCount > 0;
      const nextRev = mr.resolutionRev + 1;
      await repos.mergeRequests.updateResolution(mr.id, hasConflicts, nextRev);

      await this.audit.log(repos, {
        repoId,
        actorId: actor.userId,
        action: 'merge_request.resolve_conflict',
        entityType: 'conflict',
        entityId: item.id,
        metadata: {
          mrNumber,
          path: item.path,
          resolution: input.resolution,
          remainingUnresolved: unresolvedCount,
          auditNote: input.auditNote,
        },
        ip: actor.ip,
      });

      const updated = await repos.conflicts.findById(item.id);
      return updated!;
    });
  }

  async close(actor: Actor, repoId: string, mrNumber: number): Promise<MergeRequest> {
    await this.members.authorize(actor, repoId, 'merge:create');

    const mr = await this.uow.repos.mergeRequests.findByNumber(repoId, mrNumber);
    if (!mr) throw notFound('Merge request');
    if (mr.status !== 'open') throw conflict('NOT_OPEN', `Merge request #${mrNumber} is already ${mr.status}`);

    return this.uow.transaction(async (repos) => {
      await repos.mergeRequests.close(mr.id);
      await this.audit.log(repos, {
        repoId,
        actorId: actor.userId,
        action: 'merge_request.close',
        entityType: 'merge_request',
        entityId: mr.id,
        metadata: { number: mrNumber },
        ip: actor.ip,
      });
      return (await repos.mergeRequests.findById(mr.id))!;
    });
  }

  /**
   * Executes merge of an approved merge request into the target branch.
   * Atomic, row-locked, validates branch head has not moved, satisfies protection rules, applies 3-way merge snapshot.
   */
  async merge(actor: Actor, repoId: string, mrNumber: number): Promise<{ mergeRequest: MergeRequest; mergeRecord: MergeRecord }> {
    const { role } = await this.members.authorize(actor, repoId, 'merge:execute');

    const mr = await this.uow.repos.mergeRequests.findByNumber(repoId, mrNumber);
    if (!mr) throw notFound('Merge request');
    if (mr.status !== 'open') throw conflict('NOT_OPEN', `Merge request #${mrNumber} is ${mr.status}`);

    const targetBranch = await this.uow.repos.branches.find(repoId, mr.targetBranchName);
    if (!targetBranch) throw notFound('Target branch');

    // Protected branch check: if protected, verify required approvals count and caller role
    if (targetBranch.protection && targetBranch.protection.requiredApprovals > 0) {
      if (role !== 'maintainer' && role !== 'owner') {
        throw forbidden('PROTECTED_BRANCH', 'Only maintainers and owners can merge into protected branches');
      }
      const validApprovals = await this.uow.repos.mergeApprovals.countValid(
        mr.id,
        mr.sourceHeadCommitId,
        mr.resolutionRev,
      );
      if (validApprovals < targetBranch.protection.requiredApprovals) {
        throw conflict(
          'INSUFFICIENT_APPROVALS',
          `Merge request requires at least ${targetBranch.protection.requiredApprovals} approval(s), but only has ${validApprovals}`,
        );
      }
    }

    // Verify unresolved conflicts
    const unresolved = await this.uow.repos.conflicts.countUnresolved(mr.id);
    if (unresolved > 0) {
      throw conflict('UNRESOLVED_CONFLICTS', `Merge request has ${unresolved} unresolved conflict(s)`);
    }

    // Load snapshots and compute merge (empty snapshot {} if unrelated histories)
    const baseSnapshot = mr.baseCommitId ? await this.snapshots.forCommit(repoId, mr.baseCommitId) : {};
    const sourceSnapshot = await this.snapshots.forCommit(repoId, mr.sourceHeadCommitId);
    const targetSnapshot = await this.snapshots.forCommit(repoId, mr.targetHeadCommitId);

    const allConflicts = await this.uow.repos.conflicts.listByMr(mr.id);
    const appliedResolutions = allConflicts
      .filter((c) => c.resolution !== null && c.resolvedExists !== null)
      .map((c) => ({
        path: c.path,
        resolution: c.resolution!,
        resolvedExists: c.resolvedExists!,
        resolvedValue: c.resolvedValue,
      }));

    const finalSnapshot = buildMergedSnapshot(baseSnapshot, targetSnapshot, sourceSnapshot, appliedResolutions);
    const snapshotInfo = await this.storage.putSnapshot(repoId, finalSnapshot);

    const message = `Merge branch '${mr.sourceBranchName}' into '${mr.targetBranchName}' (MR #${mr.number}: ${mr.title})`;

    return this.uow.transaction(async (repos) => {
      // Lock target branch row
      const lockedTarget = await repos.branches.lock(repoId, mr.targetBranchName);
      if (!lockedTarget) throw notFound('Target branch');

      // Verify target head has not changed
      if (lockedTarget.headCommitId !== mr.targetHeadCommitId) {
        throw conflict(
          'HEAD_MOVED',
          'Target branch head has moved since this merge request was prepared. Please rebase or recreate.',
        );
      }

      // If branch is protected, set session flag for trigger
      if (lockedTarget.protection) {
        await repos.branches.allowProtectedWrite();
      }

      await repos.commits.registerSnapshot(repoId, snapshotInfo.hash, snapshotInfo.recordCount, snapshotInfo.sizeBytes);

      const mergeCommit = await repos.commits.insert({
        repoId,
        snapshotHash: snapshotInfo.hash,
        authorId: actor.userId,
        message,
        kind: 'merge',
        parents: [mr.targetHeadCommitId, mr.sourceHeadCommitId],
      });

      const casOk = await repos.branches.compareAndSetHead(lockedTarget.id, mr.targetHeadCommitId, mergeCommit.id);
      if (!casOk) {
        throw conflict('HEAD_MOVED', 'Failed to advance target branch head. Concurrent update occurred.');
      }

      const mergeRecord = await repos.merges.insert({
        repoId,
        sourceBranch: mr.sourceBranchName,
        targetBranch: mr.targetBranchName,
        baseCommitId: mr.baseCommitId,
        sourceCommitId: mr.sourceHeadCommitId,
        targetCommitId: mr.targetHeadCommitId,
        resultCommitId: mergeCommit.id,
        strategy: 'three_way',
        conflictCount: allConflicts.length,
        mergedBy: actor.userId,
      });

      await repos.mergeRequests.setMerged(mr.id, mergeRecord.id, actor.userId);
      await this.storage.updateRef(repoId, mr.targetBranchName, mr.targetHeadCommitId, mergeCommit.id);

      await this.audit.log(repos, {
        repoId,
        actorId: actor.userId,
        action: 'merge_request.merge',
        entityType: 'merge_request',
        entityId: mr.id,
        metadata: {
          number: mr.number,
          mergeId: mergeRecord.id,
          resultCommitId: mergeCommit.id,
          records: countRecords(finalSnapshot),
        },
        ip: actor.ip,
      });

      this.snapshots.invalidateBranch(repoId, mr.targetBranchName);

      const finalMr = (await repos.mergeRequests.findById(mr.id))!;
      return { mergeRequest: finalMr, mergeRecord };
    });
  }
}
