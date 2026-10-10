import type {
  AuditEntry, Branch, Commit, CommitKind, JsonValue, Member, PublicUser, RepoRole, Repository, RepositoryWithRole, User, WorkingChange,
} from '../domain/types';

export interface UserRepo {
  create(u: { email: string; username: string; passwordHash: string }): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIdentifier(identifier: string): Promise<User | null>; // email or username
  findByEmail(email: string): Promise<User | null>;
}
export const toPublicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, username: u.username, globalRole: u.globalRole });

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

export interface Repositories {
  users: UserRepo; tokens: TokenRepo; repositories: RepositoryRepo; members: MemberRepo; branches: BranchRepo;
  commits: CommitRepo; workingChanges: WorkingChangeRepo; audit: AuditRepo; idempotency: IdempotencyRepo;
}

export interface UnitOfWork {
  /** Repositories bound to the pool: each call is its own statement (audit.append opens its own transaction). */
  readonly repos: Repositories;
  transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
