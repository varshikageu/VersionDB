import type {
  ApprovalDecision, AuditEntry, Branch, Commit, CommitKind, ConflictResolutionMode, GlobalRole, JsonValue, Member,
  MergeApproval, MergeConflict, MergeRecord, MergeRequest, PublicUser, RepoRole, Repository, RepositoryWithRole, User, WorkingChange,
} from '../domain/types';

export interface UserRepo {
  create(u: { email: string; username: string; passwordHash: string; globalRole?: GlobalRole }): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIdentifier(identifier: string): Promise<User | null>; // email or username
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  update(id: string, patch: { username?: string; globalRole?: GlobalRole; disabled?: boolean; deletedAt?: Date | null; email?: string; passwordHash?: string }): Promise<User | null>;
  setPassword(id: string, passwordHash: string): Promise<boolean>;
}
export const toPublicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, username: u.username, globalRole: u.globalRole, disabled: u.disabled, deletedAt: u.deletedAt ?? null, createdAt: u.createdAt });

export interface TokenRecord { id: string; userId: string; expiresAt: Date; revokedAt: Date | null }
export interface TokenRepo {
  create(t: { userId: string; tokenHash: string; kind: 'refresh' | 'api'; expiresAt: Date }): Promise<void>;
  findByHash(hash: string, kind: 'refresh' | 'api'): Promise<TokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string, kind: 'refresh' | 'api'): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface RepositoryRepo {
  create(r: { name: string; description: string; ownerId: string }): Promise<Repository>;
  findById(id: string): Promise<Repository | null>;
  listForUser(userId: string, all: boolean): Promise<RepositoryWithRole[]>;
  lockForUpdate(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface MemberRepo {
  upsert(m: { repoId: string; userId: string; role: RepoRole; addedBy: string }): Promise<void>;
  find(repoId: string, userId: string): Promise<RepoRole | null>;
  list(repoId: string): Promise<Member[]>;
  remove(repoId: string, userId: string): Promise<boolean>;
  countOwners(repoId: string): Promise<number>;
}

export interface BranchRepo {
  create(b: { repoId: string; name: string; headCommitId: string | null; createdBy: string }): Promise<Branch>;
  find(repoId: string, name: string): Promise<Branch | null>;
  findById(id: string): Promise<Branch | null>;
  lock(repoId: string, name: string): Promise<Branch | null>; // SELECT ... FOR UPDATE
  list(repoId: string): Promise<Branch[]>;
  /** Moves the head only if it still equals `expected`. Returns false when another writer won. */
  compareAndSetHead(id: string, expected: string | null, next: string): Promise<boolean>;
  /** Transaction-scoped permission to move a protected head (merge / rollback only). */
  allowProtectedWrite(): Promise<void>;
  protect(repoId: string, name: string, requiredApprovals: number): Promise<void>;
  delete(repoId: string, name: string): Promise<boolean>;
  hasOpenMergeRequests(repoId: string, name: string): Promise<boolean>;
}

export interface NewCommit {
  repoId: string; snapshotHash: string; authorId: string; message: string; kind: CommitKind; parents: string[];
}
export interface CommitRepo {
  insert(c: NewCommit): Promise<Commit>;
  registerSnapshot(repoId: string, hash: string, recordCount: number, sizeBytes: number): Promise<void>;
  find(repoId: string, id: string): Promise<Commit | null>;
  history(repoId: string, headId: string, limit: number, before?: { createdAt: string; id: string }): Promise<Commit[]>;
}

export interface WorkingChangeRepo {
  upsert(c: { repoId: string; branchId: string; userId: string; collection: string; recordId: string; op: 'put' | 'delete'; data: JsonValue | null }): Promise<void>;
  list(branchId: string, userId: string): Promise<WorkingChange[]>;
  count(branchId: string, userId: string): Promise<number>;
  removeOne(branchId: string, userId: string, collection: string, recordId: string): Promise<boolean>;
  clear(branchId: string, userId: string): Promise<number>;
}

export interface NewAuditEntry {
  repoId: string | null; actorId: string | null; action: string; entityType: string; entityId?: string | null;
  metadata?: Record<string, unknown>; ip?: string | null;
}
export interface AuditRepo {
  append(e: NewAuditEntry): Promise<AuditEntry>;
  list(repoId: string, limit: number, beforeId?: number): Promise<AuditEntry[]>;
  listAll(limit: number, beforeId?: number): Promise<AuditEntry[]>;
  verify(repoId: string | null): Promise<{ ok: boolean; checked: number; brokenAtId?: number }>;
}

export type IdempotencyBegin =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'in_progress' }
  | { kind: 'mismatch' };
export interface IdempotencyRepo {
  begin(r: { userId: string; key: string; method: string; path: string; requestHash: string; ttlSeconds: number }): Promise<IdempotencyBegin>;
  complete(userId: string, key: string, status: number, body: unknown): Promise<void>;
  release(userId: string, key: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface NewMergeRequest {
  repoId: string;
  number: number;
  title: string;
  description: string;
  sourceBranchId: string | null;
  targetBranchId: string | null;
  sourceBranchName: string;
  targetBranchName: string;
  authorId: string;
  baseCommitId: string | null;
  sourceHeadCommitId: string;
  targetHeadCommitId: string;
  hasConflicts: boolean;
}

export interface MergeRequestRepo {
  create(mr: NewMergeRequest): Promise<MergeRequest>;
  findById(id: string): Promise<MergeRequest | null>;
  findByNumber(repoId: string, number: number): Promise<MergeRequest | null>;
  findOpenByBranchPair(repoId: string, sourceBranch: string, targetBranch: string): Promise<MergeRequest | null>;
  list(repoId: string, status?: string): Promise<MergeRequest[]>;
  nextNumber(repoId: string): Promise<number>;
  close(id: string): Promise<boolean>;
  setMerged(id: string, mergeId: string, mergedBy: string): Promise<boolean>;
  updateResolution(id: string, hasConflicts: boolean, resolutionRev: number): Promise<boolean>;
}

export interface NewConflict {
  mergeRequestId: string;
  path: string;
  baseExists: boolean;
  baseValue: JsonValue | null;
  oursExists: boolean;
  oursValue: JsonValue | null;
  theirsExists: boolean;
  theirsValue: JsonValue | null;
}

export interface ConflictRepo {
  insertBatch(conflicts: NewConflict[]): Promise<void>;
  listByMr(mergeRequestId: string): Promise<MergeConflict[]>;
  findById(id: string): Promise<MergeConflict | null>;
  resolve(id: string, resolution: ConflictResolutionMode, resolvedExists: boolean, resolvedValue: JsonValue | null, resolvedBy: string): Promise<boolean>;
  countUnresolved(mergeRequestId: string): Promise<number>;
  deleteByMr(mergeRequestId: string): Promise<number>;
}

export interface MergeApprovalRepo {
  upsert(approval: {
    mergeRequestId: string;
    reviewerId: string;
    decision: ApprovalDecision;
    comment: string;
    sourceHeadCommitId: string;
    resolutionRev: number;
  }): Promise<MergeApproval>;
  listByMr(mergeRequestId: string): Promise<MergeApproval[]>;
  countValid(mergeRequestId: string, sourceHeadCommitId: string, resolutionRev: number): Promise<number>;
}

export interface NewMerge {
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
}

export interface MergeRepo {
  insert(m: NewMerge): Promise<MergeRecord>;
  findById(id: string): Promise<MergeRecord | null>;
  listByRepo(repoId: string, limit?: number): Promise<MergeRecord[]>;
}

export interface Repositories {
  users: UserRepo; tokens: TokenRepo; repositories: RepositoryRepo; members: MemberRepo; branches: BranchRepo;
  commits: CommitRepo; workingChanges: WorkingChangeRepo; audit: AuditRepo; idempotency: IdempotencyRepo;
  mergeRequests: MergeRequestRepo; conflicts: ConflictRepo; mergeApprovals: MergeApprovalRepo; merges: MergeRepo;
}

export interface UnitOfWork {
  /** Repositories bound to the pool: each call is its own statement (audit.append opens its own transaction). */
  readonly repos: Repositories;
  transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
