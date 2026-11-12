import type { JsonValue } from '../shared/json';
export type { JsonValue };

/** collection -> recordId -> record. Empty collections never exist. */
export type SnapshotData = Record<string, Record<string, JsonValue>>;

export type GlobalRole = 'user' | 'admin';
export type RepoRole = 'viewer' | 'reviewer' | 'maintainer' | 'owner';
export type CommitKind = 'initial' | 'normal' | 'merge' | 'revert';

export interface Actor { userId: string; globalRole: GlobalRole; ip?: string }

export interface User {
  id: string; email: string; username: string; passwordHash: string;
  globalRole: GlobalRole; disabled: boolean; createdAt: Date;
}
export interface PublicUser {
  id: string; email: string; username: string; globalRole: GlobalRole;
  disabled?: boolean; createdAt?: Date | string;
}

export interface Repository { id: string; name: string; description: string; ownerId: string; defaultBranch: string; createdAt: Date }
export interface RepositoryWithRole extends Repository { role: RepoRole }
export interface Member { repoId: string; userId: string; username: string; email: string; role: RepoRole; createdAt: Date }

export interface Protection { requiredApprovals: number }
export interface Branch {
  id: string; repoId: string; name: string; headCommitId: string | null;
  createdBy: string | null; createdAt: Date; protection: Protection | null;
}

export interface Commit {
  id: string; repoId: string; snapshotHash: string; authorId: string; authorName: string | null;
  message: string; kind: CommitKind; createdAt: Date; parents: string[];
}

export interface WorkingChange {
  collection: string; recordId: string; op: 'put' | 'delete'; data: JsonValue | null; updatedAt: Date;
}

export interface AuditEntry {
  id: number; repoId: string | null; actorId: string | null; actorName: string | null;
  action: string; entityType: string; entityId: string | null;
  metadata: Record<string, unknown>; ip: string | null; hash: string; createdAt: Date;
}

export type MergeRequestStatus = 'open' | 'merged' | 'closed';

export interface MergeRequest {
  id: string;
  repoId: string;
  number: number;
  title: string;
  description: string;
  sourceBranchId: string | null;
  targetBranchId: string | null;
  sourceBranchName: string;
  targetBranchName: string;
  authorId: string;
  authorName?: string | null;
  status: MergeRequestStatus;
  baseCommitId: string | null;
  sourceHeadCommitId: string;
  targetHeadCommitId: string;
  hasConflicts: boolean;
  resolutionRev: number;
  mergeId: string | null;
  mergedBy: string | null;
  mergedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConflictResolutionMode = 'ours' | 'theirs' | 'manual';

export interface MergeConflict {
  id: string;
  mergeRequestId: string;
  path: string;
  baseExists: boolean;
  baseValue: JsonValue | null;
  oursExists: boolean;
  oursValue: JsonValue | null;
  theirsExists: boolean;
  theirsValue: JsonValue | null;
  resolution: ConflictResolutionMode | null;
  resolvedExists: boolean | null;
  resolvedValue: JsonValue | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  detectedAt: Date;
}

export type ApprovalDecision = 'approved' | 'changes_requested';

export interface MergeApproval {
  id: string;
  mergeRequestId: string;
  reviewerId: string;
  reviewerName?: string | null;
  decision: ApprovalDecision;
  comment: string;
  sourceHeadCommitId: string;
  resolutionRev: number;
  createdAt: Date;
}

export interface MergeRecord {
  id: string;
  repoId: string;
  sourceBranch: string;
  targetBranch: string;
  baseCommitId: string | null;
  sourceCommitId: string;
  targetCommitId: string;
  resultCommitId: string;
  strategy: 'three_way';
  conflictCount: number;
  mergedBy: string;
  createdAt: Date;
}
