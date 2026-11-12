import type {
  AuditEntry, Branch, Commit, Member, MergeApproval, MergeConflict, MergeRecord, MergeRequest,
  Repository, RepositoryWithRole, User, WorkingChange,
} from '../../domain/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const mapUser = (r: Row): User => ({
  id: r.id, email: r.email, username: r.username, passwordHash: r.password_hash,
  globalRole: r.global_role, disabled: r.disabled, createdAt: r.created_at,
});
export const mapRepository = (r: Row): Repository => ({
  id: r.id, name: r.name, description: r.description, ownerId: r.owner_id, defaultBranch: r.default_branch, createdAt: r.created_at,
});
export const mapRepositoryWithRole = (r: Row): RepositoryWithRole => ({ ...mapRepository(r), role: r.role });
export const mapMember = (r: Row): Member => ({
  repoId: r.repo_id, userId: r.user_id, username: r.username, email: r.email, role: r.role, createdAt: r.created_at,
});
export const mapBranch = (r: Row): Branch => ({
  id: r.id, repoId: r.repo_id, name: r.name, headCommitId: r.head_commit_id, createdBy: r.created_by, createdAt: r.created_at,
  protection: r.required_approvals === null || r.required_approvals === undefined ? null : { requiredApprovals: r.required_approvals },
});
export const mapCommit = (r: Row, parents: string[]): Commit => ({
  id: r.id, repoId: r.repo_id, snapshotHash: r.snapshot_hash, authorId: r.author_id, authorName: r.author_name ?? null,
  message: r.message, kind: r.kind, createdAt: r.created_at, parents,
});
export const mapWorkingChange = (r: Row): WorkingChange => ({
  collection: r.collection, recordId: r.record_id, op: r.op, data: r.op === 'put' ? r.data : null, updatedAt: r.updated_at,
});
export const mapAudit = (r: Row): AuditEntry => ({
  id: Number(r.id), repoId: r.repo_id, actorId: r.actor_id, actorName: r.actor_name ?? null, action: r.action,
  entityType: r.entity_type, entityId: r.entity_id, metadata: r.metadata, ip: r.ip, hash: r.hash, createdAt: r.created_at,
});

export const mapMergeRequest = (r: Row): MergeRequest => ({
  id: r.id,
  repoId: r.repo_id,
  number: Number(r.number),
  title: r.title,
  description: r.description ?? '',
  sourceBranchId: r.source_branch_id ?? null,
  targetBranchId: r.target_branch_id ?? null,
  sourceBranchName: r.source_branch_name,
  targetBranchName: r.target_branch_name,
  authorId: r.author_id,
  authorName: r.author_name ?? null,
  status: r.status,
  baseCommitId: r.base_commit_id ?? null,
  sourceHeadCommitId: r.source_head_commit_id,
  targetHeadCommitId: r.target_head_commit_id,
  hasConflicts: Boolean(r.has_conflicts),
  resolutionRev: Number(r.resolution_rev ?? 0),
  mergeId: r.merge_id ?? null,
  mergedBy: r.merged_by ?? null,
  mergedAt: r.merged_at ? new Date(r.merged_at) : null,
  closedAt: r.closed_at ? new Date(r.closed_at) : null,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

export const mapConflict = (r: Row): MergeConflict => ({
  id: r.id,
  mergeRequestId: r.merge_request_id,
  path: r.path,
  baseExists: Boolean(r.base_exists),
  baseValue: r.base_value ?? null,
  oursExists: Boolean(r.ours_exists),
  oursValue: r.ours_value ?? null,
  theirsExists: Boolean(r.theirs_exists),
  theirsValue: r.theirs_value ?? null,
  resolution: r.resolution ?? null,
  resolvedExists: r.resolved_exists === null || r.resolved_exists === undefined ? null : Boolean(r.resolved_exists),
  resolvedValue: r.resolved_value ?? null,
  resolvedBy: r.resolved_by ?? null,
  resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
  detectedAt: new Date(r.detected_at),
});

export const mapMergeApproval = (r: Row): MergeApproval => ({
  id: r.id,
  mergeRequestId: r.merge_request_id,
  reviewerId: r.reviewer_id,
  reviewerName: r.reviewer_name ?? null,
  decision: r.decision,
  comment: r.comment ?? '',
  sourceHeadCommitId: r.source_head_commit_id,
  resolutionRev: Number(r.resolution_rev),
  createdAt: new Date(r.created_at),
});

export const mapMerge = (r: Row): MergeRecord => ({
  id: r.id,
  repoId: r.repo_id,
  sourceBranch: r.source_branch,
  targetBranch: r.target_branch,
  baseCommitId: r.base_commit_id ?? null,
  sourceCommitId: r.source_commit_id,
  targetCommitId: r.target_commit_id,
  resultCommitId: r.result_commit_id,
  strategy: r.strategy,
  conflictCount: Number(r.conflict_count ?? 0),
  mergedBy: r.merged_by,
  createdAt: new Date(r.created_at),
});

