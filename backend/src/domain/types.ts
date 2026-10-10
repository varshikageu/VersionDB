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
export interface PublicUser { id: string; email: string; username: string; globalRole: GlobalRole }

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
