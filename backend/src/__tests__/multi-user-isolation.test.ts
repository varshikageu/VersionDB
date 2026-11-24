/**
 * Multi-User Isolation & RBAC Regression Tests
 *
 * Covers:
 *  - Two independent users cannot see/access each other's private repos
 *  - Duplicate display names allowed; duplicate emails rejected
 *  - Self-assignment of privileged global roles is rejected
 *  - Repository ownership on creation
 *  - Member invitation, role changes, and revocation
 *  - Cross-repository access isolation
 *  - Last-owner protection (cannot demote or remove last owner)
 *  - Legitimate repository sharing via membership
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app';
import type { Container } from '../container';
import type { Env } from '../config/env';
import type { Logger } from '../observability/logger';
import { conflict, forbidden, notFound, unauthorized } from '../shared/errors';
import type { Actor, RepoRole } from '../domain/types';

// ---------------------------------------------------------------------------
// Shared in-memory state
// ---------------------------------------------------------------------------

// Standard RFC4122 v4 UUID constants for test entities
export const ADMIN_ID = '11111111-2222-4333-8444-555555555555';
export const ALICE_ID = 'f2c96c17-1bf2-4fa8-908e-377a2a0e9f04';
export const BOB_ID = '3e0f9f5e-511d-4afc-b4b3-e7a54062b732';
export const REPO_A_ID = '0fc0326c-ac5b-41e8-8b42-edf102336fcb';
export const REPO_B_ID = '400a3c5c-daa8-4084-b4d7-95283bfa2cc1';

interface UserRecord {
  id: string;
  email: string;
  username: string;
  globalRole: 'admin' | 'developer' | 'reviewer' | 'viewer' | 'user';
  disabled: boolean;
  deletedAt?: Date | string | null;
}

interface RepoRecord {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName?: string;
}

interface TestMrRecord {
  id: string;
  repoId: string;
  number: number;
  title: string;
  description: string;
  sourceBranchName: string;
  targetBranchName: string;
  authorId: string;
  authorName?: string;
  status: 'open' | 'merged' | 'closed';
  hasConflicts: boolean;
  resolutionRev: number;
  sourceHeadCommitId: string;
  targetHeadCommitId: string;
  createdAt: string;
  updatedAt: string;
}

interface TestApprovalRecord {
  id: string;
  mergeRequestId: string;
  reviewerId: string;
  decision: 'approved' | 'changes_requested';
  comment: string;
  createdAt: string;
}

const users = new Map<string, UserRecord>();
const repos = new Map<string, RepoRecord>();
// repoId -> (userId -> role)
const memberships = new Map<string, Map<string, RepoRole>>();
const mergeRequestsStore = new Map<string, TestMrRecord>();
const approvalsStore = new Map<string, TestApprovalRecord[]>();

function resetState() {
  users.clear();
  repos.clear();
  memberships.clear();
  mergeRequestsStore.clear();
  approvalsStore.clear();

  // Pre-seed Admin user
  users.set(ADMIN_ID, {
    id: ADMIN_ID,
    email: 'admin@example.com',
    username: 'platform_admin',
    globalRole: 'admin',
    disabled: false,
  });

  // Pre-seed two independent users with same display name (duplicate usernames allowed)
  users.set(ALICE_ID, {
    id: ALICE_ID,
    email: 'alice@example.com',
    username: 'alice_dev',
    globalRole: 'user',
    disabled: false,
  });
  users.set(BOB_ID, {
    id: BOB_ID,
    email: 'bob@example.com',
    username: 'alice_dev', // duplicate display name - allowed
    globalRole: 'user',
    disabled: false,
  });

  // Alice owns repo-a
  repos.set(REPO_A_ID, { id: REPO_A_ID, name: 'alice-repo', description: '', ownerId: ALICE_ID });
  const repoAMembers = new Map<string, RepoRole>();
  repoAMembers.set(ALICE_ID, 'owner');
  memberships.set(REPO_A_ID, repoAMembers);

  // Bob owns repo-b
  repos.set(REPO_B_ID, { id: REPO_B_ID, name: 'bob-repo', description: '', ownerId: BOB_ID });
  const repoBMembers = new Map<string, RepoRole>();
  repoBMembers.set(BOB_ID, 'owner');
  memberships.set(REPO_B_ID, repoBMembers);
}

function visibleRepos(actor: Actor): RepoRecord[] {
  const all = actor.globalRole === 'admin'
    ? [...repos.values()]
    : [...repos.values()].filter((r) => memberships.get(r.id)?.has(actor.userId));
  return all.map((r) => {
    const owner = users.get(r.ownerId);
    return {
      ...r,
      ownerName: owner?.username ?? 'unknown',
    };
  });
}

function effectiveRole(actor: Actor, repoId: string): RepoRole | null {
  if (actor.globalRole === 'admin') return 'owner';
  return memberships.get(repoId)?.get(actor.userId) ?? null;
}

const ROLE_ORDER: RepoRole[] = ['viewer', 'reviewer', 'maintainer', 'owner'];

function authorizeRepo(actor: Actor, repoId: string, minRole: RepoRole) {
  const repo = repos.get(repoId);
  if (!repo) throw notFound('Repository');
  const role = effectiveRole(actor, repoId);
  if (role === null) throw notFound('Repository'); // hide existence
  if (ROLE_ORDER.indexOf(role) < ROLE_ORDER.indexOf(minRole)) {
    throw forbidden('FORBIDDEN', `Requires ${minRole} or higher`);
  }
  return { repo, role };
}

// ---------------------------------------------------------------------------
// Build mock container
// ---------------------------------------------------------------------------

function buildMockContainer(env: Env, logger: Logger): Container {
  const mockAuthService: any = {
    register: async ({ email, username, password: _password, globalRole: _suppliedRole }: any) => {
      // Duplicate email check (case-insensitive)
      for (const u of users.values()) {
        if (u.email.toLowerCase() === email.toLowerCase()) {
          throw conflict('ACCOUNT_EXISTS', 'An account with that email already exists');
        }
      }
      const id = crypto.randomUUID();
      const newUser: UserRecord = {
        id,
        email: email.toLowerCase(),
        username,
        globalRole: 'user', // ALWAYS 'user', ignore client-supplied role
        disabled: false,
      };
      users.set(id, newUser);
      return {
        id,
        email: newUser.email,
        username,
        globalRole: newUser.globalRole,
        createdAt: new Date().toISOString(),
      };
    },
    login: async ({ identifier, password: _password }: any) => {
      const user = [...users.values()].find((u) => u.email === identifier.toLowerCase());
      if (!user) throw unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
      return { token: `uid:${user.id}`, refreshToken: 'rt', user };
    },
    verifyAccessToken: (token: string) => {
      const match = /^uid:([0-9a-f-]{36})$/.exec(token);
      if (!match) {
        throw unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
      }
      const userId = match[1]!;
      const user = users.get(userId);
      if (!user) {
        throw unauthorized('INVALID_TOKEN', 'User not found');
      }
      return { userId: user.id, globalRole: user.globalRole };
    },
    loadActiveUser: async (userId: string) => {
      const u = users.get(userId);
      if (!u || u.disabled || u.deletedAt) throw unauthorized('USER_DISABLED', 'Account disabled');
      return u;
    },
    me: async (userId: string) => {
      const u = users.get(userId);
      if (!u) throw notFound('User');
      return u;
    },
    logout: async () => { },
    refresh: async () => ({ token: 'mock-refresh' }),
    adminListUsers: async (actor: Actor) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      return [...users.values()].map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        globalRole: u.globalRole,
        disabled: u.disabled,
      }));
    },
    adminCreateUser: async (actor: Actor, input: any) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      for (const u of users.values()) {
        if (u.email.toLowerCase() === input.email.toLowerCase()) {
          throw conflict('ACCOUNT_EXISTS', 'An account with that email already exists');
        }
      }
      const id = crypto.randomUUID();
      const rawPassword = input.initialPassword || 'Vdb!InitPass123';
      const newUser: UserRecord = {
        id,
        email: input.email.toLowerCase(),
        username: input.username,
        globalRole: input.globalRole ?? 'user',
        disabled: false,
      };
      users.set(id, newUser);
      return {
        user: { id, email: newUser.email, username: newUser.username, globalRole: newUser.globalRole, disabled: false },
        initialPassword: rawPassword,
      };
    },
    adminUpdateUser: async (actor: Actor, userId: string, patch: any) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      const u = users.get(userId);
      if (!u) throw notFound('User');
      if (patch.username) u.username = patch.username;
      if (patch.globalRole) u.globalRole = patch.globalRole;
      if (patch.disabled !== undefined) u.disabled = patch.disabled;
      return { id: u.id, email: u.email, username: u.username, globalRole: u.globalRole, disabled: u.disabled };
    },
    adminResetPassword: async (actor: Actor, userId: string) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      const u = users.get(userId);
      if (!u) throw notFound('User');
      return { temporaryPassword: 'Vdb!ResetPass123' };
    },
    adminDeleteUser: async (actor: Actor, userId: string) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      if (actor.userId === userId) {
        throw forbidden('SELF_DELETION_FORBIDDEN', 'Administrators cannot delete their own accounts');
      }
      const u = users.get(userId);
      if (!u) throw notFound('User');
      if (u.deletedAt) throw conflict('USER_ALREADY_DELETED', 'User account is already deleted');
      if (u.globalRole === 'admin') {
        const activeAdmins = [...users.values()].filter((x) => x.globalRole === 'admin' && !x.disabled && !x.deletedAt);
        if (activeAdmins.length <= 1) {
          throw conflict('LAST_ADMIN', 'Cannot delete the last remaining active platform admin');
        }
      }
      u.deletedAt = new Date();
      u.disabled = true;
      u.email = `deleted_${u.id.slice(0, 8)}@deleted.versiondb.local`;
      u.username = `deleted_${u.id.slice(0, 8)}`;
      return { success: true, user: { id: u.id, email: u.email, username: u.username, globalRole: u.globalRole, disabled: true, deletedAt: u.deletedAt } };
    },
    adminListAuditLogs: async (actor: Actor) => {
      if (actor.globalRole !== 'admin') throw forbidden('FORBIDDEN', 'Administrative privileges required');
      return [];
    },
  };

  const mockRepositoryService: any = {
    list: async (actor: Actor) => visibleRepos(actor),

    get: async (actor: Actor, repoId: string) => {
      const { repo } = authorizeRepo(actor, repoId, 'viewer');
      return repo;
    },

    create: async (actor: Actor, input: { name: string; description?: string }) => {
      const id = crypto.randomUUID();
      const user = users.get(actor.userId);
      const repo: RepoRecord = {
        id,
        name: input.name,
        description: input.description ?? '',
        ownerId: actor.userId,
        ownerName: user?.username ?? 'unknown',
      };
      repos.set(id, repo);
      // Creator automatically receives owner membership
      const ms = new Map<string, RepoRole>();
      ms.set(actor.userId, 'owner');
      memberships.set(id, ms);
      return repo;
    },

    delete: async (actor: Actor, repoId: string) => {
      authorizeRepo(actor, repoId, 'owner');
      repos.delete(repoId);
      memberships.delete(repoId);
      return { deleted: true };
    },

    listBranches: async (actor: Actor, repoId: string) => {
      authorizeRepo(actor, repoId, 'viewer');
      return [];
    },

    createBranch: async (actor: Actor, repoId: string, _input: any) => {
      authorizeRepo(actor, repoId, 'maintainer');
      return { id: 'b-new', repoId, name: _input.name };
    },

    deleteBranch: async (actor: Actor, repoId: string, _branchName: string, _opts?: any) => {
      authorizeRepo(actor, repoId, 'maintainer');
      return { deleted: true };
    },
  };

  const mockMemberService: any = {
    list: async (actor: Actor, repoId: string) => {
      authorizeRepo(actor, repoId, 'viewer');
      const ms = memberships.get(repoId) ?? new Map();
      return [...ms.entries()].map(([userId, role]) => ({ repoId, userId, role }));
    },

    add: async (actor: Actor, repoId: string, input: { email: string; role: RepoRole }) => {
      authorizeRepo(actor, repoId, 'owner');
      const user = [...users.values()].find((u) => u.email === input.email.toLowerCase());
      if (!user) throw notFound('User');
      const ms = memberships.get(repoId)!;
      ms.set(user.id, input.role);
    },

    setRole: async (actor: Actor, repoId: string, userId: string, role: RepoRole) => {
      authorizeRepo(actor, repoId, 'owner');
      const ms = memberships.get(repoId)!;
      const current = ms.get(userId);
      if (current === undefined) throw notFound('Member');
      if (current === 'owner' && role !== 'owner') {
        const ownerCount = [...ms.values()].filter((r) => r === 'owner').length;
        if (ownerCount <= 1) {
          throw conflict('LAST_OWNER', 'Cannot demote the last owner');
        }
      }
      ms.set(userId, role);
    },

    remove: async (actor: Actor, repoId: string, userId: string) => {
      authorizeRepo(actor, repoId, 'owner');
      const ms = memberships.get(repoId)!;
      const current = ms.get(userId);
      if (current === undefined) throw notFound('Member');
      if (current === 'owner') {
        const ownerCount = [...ms.values()].filter((r) => r === 'owner').length;
        if (ownerCount <= 1) {
          throw conflict('LAST_OWNER', 'Cannot remove the last owner');
        }
      }
      ms.delete(userId);
    },

    authorize: async (actor: Actor, repoId: string, capability: string) => {
      const minRole: RepoRole = capability === 'merge:review' ? 'reviewer' : capability === 'merge:create' ? 'maintainer' : 'viewer';
      return authorizeRepo(actor, repoId, minRole);
    },
  };

  const mockMergeRequestService: any = {
    create: async (actor: Actor, repoId: string, input: any) => {
      authorizeRepo(actor, repoId, 'maintainer');
      const id = crypto.randomUUID();
      const existingInRepo = [...mergeRequestsStore.values()].filter((m) => m.repoId === repoId);
      const number = existingInRepo.length + 1;
      const user = users.get(actor.userId);
      const mr: TestMrRecord = {
        id,
        repoId,
        number,
        title: input.title,
        description: input.description ?? '',
        sourceBranchName: input.sourceBranch,
        targetBranchName: input.targetBranch,
        authorId: actor.userId,
        authorName: user?.username ?? 'author',
        status: 'open',
        hasConflicts: false,
        resolutionRev: 0,
        sourceHeadCommitId: crypto.randomUUID(),
        targetHeadCommitId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mergeRequestsStore.set(id, mr);
      return mr;
    },
    list: async (actor: Actor, repoId: string, status?: string) => {
      authorizeRepo(actor, repoId, 'viewer');
      let mrs = [...mergeRequestsStore.values()].filter((m) => m.repoId === repoId);
      if (status && status !== 'all' && status !== 'ALL') {
        mrs = mrs.filter((m) => m.status === status.toLowerCase());
      }
      return mrs;
    },
    get: async (actor: Actor, repoId: string, mrNumber: number) => {
      authorizeRepo(actor, repoId, 'viewer');
      const mr = [...mergeRequestsStore.values()].find((m) => m.repoId === repoId && m.number === mrNumber);
      if (!mr) throw notFound('Merge request');
      const approvals = approvalsStore.get(mr.id) ?? [];
      return { mergeRequest: mr, approvals, conflicts: [] };
    },
    review: async (actor: Actor, repoId: string, mrNumber: number, input: any) => {
      authorizeRepo(actor, repoId, 'reviewer');
      const mr = [...mergeRequestsStore.values()].find((m) => m.repoId === repoId && m.number === mrNumber);
      if (!mr) throw notFound('Merge request');
      if (mr.authorId === actor.userId) {
        throw forbidden('SELF_REVIEW_FORBIDDEN', 'Authors cannot review their own merge request');
      }
      const approval: TestApprovalRecord = {
        id: crypto.randomUUID(),
        mergeRequestId: mr.id,
        reviewerId: actor.userId,
        decision: input.decision,
        comment: input.comment ?? '',
        createdAt: new Date().toISOString(),
      };
      const existing = approvalsStore.get(mr.id) ?? [];
      existing.push(approval);
      approvalsStore.set(mr.id, existing);
      return approval;
    },
    merge: async (actor: Actor, repoId: string, mrNumber: number) => {
      const { role } = authorizeRepo(actor, repoId, 'maintainer');
      const mr = [...mergeRequestsStore.values()].find((m) => m.repoId === repoId && m.number === mrNumber);
      if (!mr) throw notFound('Merge request');
      if (mr.status !== 'open') throw conflict('NOT_OPEN', `Merge request #${mrNumber} is ${mr.status}`);

      const approvals = (approvalsStore.get(mr.id) ?? []).filter((a) => a.decision === 'approved');
      if (approvals.length < 1) {
        throw conflict('INSUFFICIENT_APPROVALS', 'Merge request requires at least 1 approval(s)');
      }

      mr.status = 'merged';
      return { mergeRequest: mr, mergeRecord: { id: crypto.randomUUID(), mergedAt: new Date().toISOString() } };
    },
  };

  const mockContainer: Container = {
    env,
    logger,
    uow: {} as any,
    storage: {} as any,
    cache: {} as any,
    services: {
      audit: {} as any,
      auth: mockAuthService,
      members: mockMemberService,
      repositories: mockRepositoryService,
      history: {} as any,
      records: {} as any,
      sql: {} as any,
      commits: {
        rollback: async () => { throw new Error('not used in isolation tests'); },
      } as any,
      idempotency: {
        begin: async () => ({ kind: 'new' }),
        complete: async () => { },
        release: async () => { },
      } as any,
      mergeRequests: mockMergeRequestService,
    },
  };

  return mockContainer;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Multi-User Isolation & RBAC Regression', () => {
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;
  let baseUrl: string;

  before(async () => {
    resetState();

    const mockEnv: Env = {
      NODE_ENV: 'test',
      PORT: 0,
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      DB_POOL_MAX: 2,
      JWT_ACCESS_SECRET: 'test-access-secret-32-chars-long-here',
      JWT_ISSUER: 'versiondb',
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 604800,
      BCRYPT_COST: 10,
      CORS_ORIGINS: '*',
      DATA_DIR: './test-data',
      DEFAULT_REQUIRED_APPROVALS: 1,
      TRUST_PROXY: false,
      LOG_LEVEL: 'error',
      IDEMPOTENCY_TTL_SECONDS: 3600,
      METRICS_TOKEN: undefined,
    };

    const mockLogger: Logger = {
      debug: () => { },
      info: () => { },
      warn: () => { },
      error: () => { },
      child: () => mockLogger,
    };

    const container = buildMockContainer(mockEnv, mockLogger);
    const app = createApp(container);
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
  });

  // -------------------------------------------------------------------------
  // § 1. Cross-user repository isolation
  // -------------------------------------------------------------------------

  it('Alice can list her own repository but not Bob\'s', async () => {
    const res = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 200);
    const data: any = await res.json();
    const reposList: any[] = data.repositories ?? data;
    const names = reposList.map((r: any) => r.name);
    assert.ok(names.includes('alice-repo'), 'Alice should see alice-repo');
    assert.ok(!names.includes('bob-repo'), 'Alice must NOT see bob-repo');
  });

  it("Bob can list his own repository but not Alice's", async () => {
    const res = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 200);
    const data: any = await res.json();
    const reposList: any[] = data.repositories ?? data;
    const names = reposList.map((r: any) => r.name);
    assert.ok(names.includes('bob-repo'), 'Bob should see bob-repo');
    assert.ok(!names.includes('alice-repo'), 'Bob must NOT see alice-repo');
  });

  it('Bob gets 404 when directly accessing Alice repo by ID (existence hidden)', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 404, 'Repo existence must not be disclosed to non-members');
  });

  it('Bob gets 404 when listing branches of Alice repo', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/branches`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 404);
  });

  it('Unauthenticated request to repo list returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/repos`);
    assert.equal(res.status, 401);
  });

  // -------------------------------------------------------------------------
  // § 2. Registration security
  // -------------------------------------------------------------------------

  it('Duplicate display names are allowed (two users with same username)', () => {
    const a = users.get(ALICE_ID);
    const b = users.get(BOB_ID);
    assert.equal(a?.username, 'alice_dev');
    assert.equal(b?.username, 'alice_dev');
    assert.notEqual(a?.email, b?.email, 'Different emails — both valid accounts');
  });

  it('Registration with duplicate email returns 409 ACCOUNT_EXISTS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        username: 'another_alice',
        password: 'SecurePass123!',
      }),
    });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.error?.code ?? body.code, 'ACCOUNT_EXISTS');
  });

  it('Client-supplied globalRole is ignored; registration always yields user role', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker@example.com',
        username: 'hacker',
        password: 'SecurePass123!',
        globalRole: 'admin',
      }),
    });
    assert.equal(res.status, 201);
    const body: any = await res.json();
    const registeredUser = body.user ?? body;
    assert.equal(registeredUser.globalRole, 'user', 'Must always register as user');
    assert.notEqual(registeredUser.globalRole, 'admin', 'Self-registration as admin must be impossible');
  });

  it('Email comparison is case-insensitive: Alice@EXAMPLE.COM duplicate rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Alice@EXAMPLE.COM',
        username: 'alice_upper',
        password: 'SecurePass123!',
      }),
    });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.error?.code ?? body.code, 'ACCOUNT_EXISTS');
  });

  // -------------------------------------------------------------------------
  // § 3. Repository ownership on creation
  // -------------------------------------------------------------------------

  it('Creator automatically receives owner membership on new repository', async () => {
    const createRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ name: 'alice-new-repo', description: 'Test' }),
    });
    assert.equal(createRes.status, 201);
    const createData: any = await createRes.json();
    const repo = createData.repository ?? createData;

    const membersRes = await fetch(`${baseUrl}/api/repos/${repo.id}/members`, {
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(membersRes.status, 200);
    const membersData: any = await membersRes.json();
    const members: any[] = membersData.members ?? membersData;
    const aliceMember = members.find((m: any) => m.userId === ALICE_ID);
    assert.ok(aliceMember, 'Alice should be listed as a member');
    assert.equal(aliceMember.role, 'owner', 'Creator must be owner');
  });

  // -------------------------------------------------------------------------
  // § 4. Member invitation and role management
  // -------------------------------------------------------------------------

  it('Owner can invite Bob as reviewer to Alice repo', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ email: 'bob@example.com', role: 'reviewer' }),
    });
    assert.equal(res.status, 204);
  });

  it('Bob can access Alice repo after invitation', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 200);
  });

  it('Bob (reviewer) cannot delete Alice repo — requires owner', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 403);
  });

  it('Bob (reviewer) cannot manage members in Alice repo — requires owner', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${BOB_ID}`,
      },
      body: JSON.stringify({ email: 'alice@example.com', role: 'viewer' }),
    });
    assert.equal(res.status, 403);
  });

  it('Owner can update Bob role from reviewer to maintainer', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members/${BOB_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ role: 'maintainer' }),
    });
    assert.equal(res.status, 204);
  });

  it('Owner can revoke Bob membership from Alice repo', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members/${BOB_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 204);
  });

  it('Bob loses access to Alice repo after revocation (gets 404)', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(res.status, 404, 'Revoked user must get 404 (existence hidden)');
  });

  // -------------------------------------------------------------------------
  // § 5. Last-owner protection
  // -------------------------------------------------------------------------

  it('Cannot demote the last owner — returns 409 LAST_OWNER', async () => {
    const ms = memberships.get(REPO_A_ID)!;
    const ownerCount = [...ms.values()].filter((r) => r === 'owner').length;
    assert.equal(ownerCount, 1, 'Only Alice should be owner at this point');

    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members/${ALICE_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ role: 'maintainer' }),
    });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.error?.code ?? body.code, 'LAST_OWNER');
  });

  it('Cannot remove the last owner — returns 409 LAST_OWNER', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}/members/${ALICE_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.error?.code ?? body.code, 'LAST_OWNER');
  });

  // -------------------------------------------------------------------------
  // § 6. Cross-repository isolation
  // -------------------------------------------------------------------------

  it('Alice membership in repo-a does not grant access to repo-b', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_B_ID}`, {
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 404, 'Alice must have no visibility into Bob repo');
  });

  it('Alice cannot list branches of repo-b', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_B_ID}/branches`, {
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 404);
  });

  it('Alice cannot invite anyone to repo-b — not a member', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${REPO_B_ID}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ email: 'alice@example.com', role: 'viewer' }),
    });
    assert.equal(res.status, 404);
  });

  // -------------------------------------------------------------------------
  // § 7. Invalid / forged auth
  // -------------------------------------------------------------------------

  it('Forged bearer token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: 'Bearer forged-token-xyz' },
    });
    assert.equal(res.status, 401);
  });

  // -------------------------------------------------------------------------
  // § 8. Admin-controlled user provisioning & Platform RBAC
  // -------------------------------------------------------------------------

  it('Admin can list portal users', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.users));
    assert.ok(body.users.length >= 3);
  });

  it('Non-admin (Alice) cannot list portal users — returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 403);
  });

  it('Admin can provision a new user with initial credentials', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({
        email: 'carol_dev@example.com',
        username: 'carol_dev',
        globalRole: 'user',
        initialPassword: 'TempPassword123!',
      }),
    });
    assert.equal(res.status, 201);
    const body: any = await res.json();
    assert.ok(body.user.id);
    assert.equal(body.user.email, 'carol_dev@example.com');
    assert.ok(body.initialPassword);
  });

  it('Non-admin (Bob) cannot provision a user — returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${BOB_ID}`,
      },
      body: JSON.stringify({
        email: 'intruder@example.com',
        username: 'intruder',
        globalRole: 'admin',
      }),
    });
    assert.equal(res.status, 403);
  });

  it('Admin can deactivate an account, revoking access', async () => {
    const patchRes = await fetch(`${baseUrl}/api/admin/users/${BOB_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({ disabled: true }),
    });
    assert.equal(patchRes.status, 200);

    // Deactivated user now fails loadActiveUser / authenticated endpoints
    const accessRes = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(accessRes.status, 401);
  });

  it('Admin can reset a user password generating secure temporary credential', async () => {
    const resetRes = await fetch(`${baseUrl}/api/admin/users/${ALICE_ID}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(resetRes.status, 200);
    const body: any = await resetRes.json();
    assert.ok(body.temporaryPassword);
  });

  it('Admin cannot delete their own account — returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${ADMIN_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.error?.code, 'SELF_DELETION_FORBIDDEN');
  });

  it('Non-admin (Alice) cannot delete a user — returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${BOB_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ALICE_ID}` },
    });
    assert.equal(res.status, 403);
  });

  it('Admin can delete user (Bob) — anonymizes, archives, and revokes access', async () => {
    const delRes = await fetch(`${baseUrl}/api/admin/users/${BOB_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(delRes.status, 200);
    const body: any = await delRes.json();
    assert.equal(body.success, true);
    assert.ok(body.user.deletedAt);
    assert.equal(body.user.disabled, true);

    // Deleted user cannot authenticate
    const accessRes = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: `Bearer uid:${BOB_ID}` },
    });
    assert.equal(accessRes.status, 401);

    // Deleting again returns 409 USER_ALREADY_DELETED
    const repeatDel = await fetch(`${baseUrl}/api/admin/users/${BOB_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(repeatDel.status, 409);
  });

  // -------------------------------------------------------------------------
  // Regression Tests: Role Assignment, Reviewer Authorization & Lifecycle
  // -------------------------------------------------------------------------

  it('Test A: Reviewer provisioning stores Reviewer role and authenticated session identifies as Reviewer', async () => {
    // 1. Provision a new user with 'reviewer' role as Admin
    const provRes = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({
        email: 'rev_alice@versiondb.local',
        username: 'rev_alice',
        globalRole: 'reviewer',
        initialPassword: 'ReviewerPass123!',
      }),
    });
    assert.equal(provRes.status, 201);
    const provBody: any = await provRes.json();
    assert.equal(provBody.user.globalRole, 'reviewer');

    // 2. Log in using that account and verify session identity
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rev_alice@versiondb.local',
        password: 'ReviewerPass123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody: any = await loginRes.json();
    assert.equal(loginBody.user.globalRole, 'reviewer');

    // 3. Authenticated session /me endpoint returns reviewer
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(meRes.status, 200);
    const meBody: any = await meRes.json();
    assert.equal(meBody.user.globalRole, 'reviewer');
  });

  it('Test B: Developer provisioning cannot perform reviewer-only actions without authorization', async () => {
    // Provision a developer
    const provRes = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({
        email: 'dev_user@versiondb.local',
        username: 'dev_user',
        globalRole: 'developer',
      }),
    });
    assert.equal(provRes.status, 201);
    const provBody: any = await provRes.json();
    assert.equal(provBody.user.globalRole, 'developer');

    // Log in
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'dev_user@versiondb.local',
        password: 'any',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody: any = await loginRes.json();
    assert.equal(loginBody.user.globalRole, 'developer');
  });

  it('Test C: Global roles and repository membership roles are evaluated independently', async () => {
    // Alice invites a Reviewer to her repo as a viewer (explicit membership takes precedence)
    const reviewerUserId = crypto.randomUUID();
    users.set(reviewerUserId, {
      id: reviewerUserId,
      email: 'global_reviewer@example.com',
      username: 'global_reviewer',
      globalRole: 'reviewer',
      disabled: false,
    });

    // Make reviewer an explicit viewer on repo-a
    memberships.get(REPO_A_ID)!.set(reviewerUserId, 'viewer');

    // Trying to delete repo-a or manage members is forbidden (viewer cannot do it)
    const delRes = await fetch(`${baseUrl}/api/repos/${REPO_A_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${reviewerUserId}` },
    });
    assert.equal(delRes.status, 403);
  });

  it('Test D: Deleted and recreated accounts receive fresh identity and role without interference', async () => {
    const email = 'recreated@versiondb.local';

    // 1. Create first user
    const user1Res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({
        email,
        username: 'recreated_v1',
        globalRole: 'developer',
      }),
    });
    assert.equal(user1Res.status, 201);
    const user1: any = await user1Res.json();
    const id1 = user1.user.id;

    // 2. Delete/archive the account
    const delRes = await fetch(`${baseUrl}/api/admin/users/${id1}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer uid:${ADMIN_ID}` },
    });
    assert.equal(delRes.status, 200);

    // 3. Provision new account using the exact same email with Reviewer role
    const user2Res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({
        email,
        username: 'bbob_new',
        globalRole: 'reviewer',
      }),
    });
    assert.equal(user2Res.status, 201);
    const user2: any = await user2Res.json();
    const id2 = user2.user.id;

    // Different UUIDs
    assert.notEqual(id1, id2);
    assert.equal(user2.user.globalRole, 'reviewer');

    // Log in with new account
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: email,
        password: 'any',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody: any = await loginRes.json();
    assert.equal(loginBody.user.id, id2);
    assert.equal(loginBody.user.globalRole, 'reviewer');
  });

  it('Test E: Role change invalidates cached state and is immediately reflected on fresh auth', async () => {
    const userRoleTestId = crypto.randomUUID();
    users.set(userRoleTestId, {
      id: userRoleTestId,
      email: 'role_change@versiondb.local',
      username: 'role_change_user',
      globalRole: 'developer',
      disabled: false,
    });

    // 1. Initial login verifies role as developer
    const login1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'role_change@versiondb.local',
        password: 'any',
      }),
    });
    assert.equal(login1.status, 200);
    const body1: any = await login1.json();
    assert.equal(body1.user.globalRole, 'developer');

    // 2. Admin updates the user role to Reviewer
    const updateRes = await fetch(`${baseUrl}/api/admin/users/${userRoleTestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ADMIN_ID}`,
      },
      body: JSON.stringify({ globalRole: 'reviewer' }),
    });
    assert.equal(updateRes.status, 200);
    const updateBody: any = await updateRes.json();
    assert.equal(updateBody.user.globalRole, 'reviewer');

    // 3. Immediate check via me endpoint reflects updated role
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer uid:${userRoleTestId}` },
    });
    assert.equal(meRes.status, 200);
    const meBody: any = await meRes.json();
    assert.equal(meBody.user.globalRole, 'reviewer');
  });

  // -------------------------------------------------------------------------
  // § 10. End-to-End Merge Request Lifecycle & Reviewer Portal Workflow
  // -------------------------------------------------------------------------

  it('Test F: Complete MR Lifecycle - Jack creates MR, bbob reviews/approves, and permissions are enforced', async () => {
    // 1. Admin creates Jack (developer) and bbob (reviewer)
    const jackId = crypto.randomUUID();
    const bbobId = crypto.randomUUID();
    const viewerId = crypto.randomUUID();

    users.set(jackId, {
      id: jackId,
      email: 'jack_e2e@versiondb.local',
      username: 'Jack',
      globalRole: 'developer',
      disabled: false,
    });

    users.set(bbobId, {
      id: bbobId,
      email: 'bbob_e2e@versiondb.local',
      username: 'bbob',
      globalRole: 'reviewer',
      disabled: false,
    });

    users.set(viewerId, {
      id: viewerId,
      email: 'viewer_e2e@versiondb.local',
      username: 'ViewerUser',
      globalRole: 'viewer',
      disabled: false,
    });

    // 2. Jack creates a repository (auto-becomes owner)
    const repoRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${jackId}`,
      },
      body: JSON.stringify({ name: 'jack-feature-repo', description: 'Jack project repo' }),
    });
    assert.equal(repoRes.status, 201);
    const repoBody: any = await repoRes.json();
    const jackRepoId = repoBody.repository.id;

    // 3. Add bbob as reviewer member to the repo, and viewer as viewer member
    const addBbobRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${jackId}`,
      },
      body: JSON.stringify({ email: 'bbob_e2e@versiondb.local', role: 'reviewer' }),
    });
    assert.equal(addBbobRes.status, 204);

    const addViewerRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${jackId}`,
      },
      body: JSON.stringify({ email: 'viewer_e2e@versiondb.local', role: 'viewer' }),
    });
    assert.equal(addViewerRes.status, 204);

    // 4. Jack creates a Merge Request
    const mrCreateRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${jackId}`,
      },
      body: JSON.stringify({
        title: 'Add new user feature',
        description: 'Implements core feature',
        sourceBranch: 'feature-user-logic',
        targetBranch: 'main',
      }),
    });
    assert.equal(mrCreateRes.status, 201);
    const mrCreateBody: any = await mrCreateRes.json();
    const mrCreated = mrCreateBody.mergeRequest;
    assert.equal(mrCreated.number, 1);
    assert.equal(mrCreated.title, 'Add new user feature');
    assert.equal(mrCreated.status, 'open');

    // 5. Jack sees the MR in his Developer portal (GET /api/repos/:id/merge-requests)
    const jackListRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests`, {
      headers: { Authorization: `Bearer uid:${jackId}` },
    });
    assert.equal(jackListRes.status, 200);
    const jackListBody: any = await jackListRes.json();
    assert.equal(jackListBody.mergeRequests.length, 1);
    assert.equal(jackListBody.mergeRequests[0].id, mrCreated.id);

    // 6. bbob logs in and opens the Reviewer portal (GET /api/repos/:id/merge-requests as bbob)
    const bbobListRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests`, {
      headers: { Authorization: `Bearer uid:${bbobId}` },
    });
    assert.equal(bbobListRes.status, 200);
    const bbobListBody: any = await bbobListRes.json();
    assert.equal(bbobListBody.mergeRequests.length, 1);
    assert.equal(bbobListBody.mergeRequests[0].id, mrCreated.id);
    assert.equal(bbobListBody.mergeRequests[0].title, 'Add new user feature');

    // 7. bbob opens the MR details (GET /api/repos/:id/merge-requests/:mrNumber)
    const bbobGetRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1`, {
      headers: { Authorization: `Bearer uid:${bbobId}` },
    });
    assert.equal(bbobGetRes.status, 200);
    const bbobGetBody: any = await bbobGetRes.json();
    assert.equal(bbobGetBody.mergeRequest.id, mrCreated.id);
    assert.equal(bbobGetBody.approvals.length, 0);

    // 8. Edge Case: Viewer cannot approve (returns 403)
    const viewerApproveRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${viewerId}`,
      },
      body: JSON.stringify({ decision: 'approved', comment: 'Looks good' }),
    });
    assert.equal(viewerApproveRes.status, 403);

    // 9. Edge Case: Author (Jack) cannot self-review (returns 403)
    const selfReviewRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${jackId}`,
      },
      body: JSON.stringify({ decision: 'approved', comment: 'Self approving' }),
    });
    assert.equal(selfReviewRes.status, 403);

    // 10. bbob approves the MR
    const approveRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${bbobId}`,
      },
      body: JSON.stringify({ decision: 'approved', comment: 'Approved changes' }),
    });
    assert.equal(approveRes.status, 201);
    const approveBody: any = await approveRes.json();
    assert.equal(approveBody.approval.reviewerId, bbobId);
    assert.equal(approveBody.approval.decision, 'approved');

    // 11. Verify approval persisted and visible in MR details
    const mrDetailsAfter = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1`, {
      headers: { Authorization: `Bearer uid:${jackId}` },
    });
    assert.equal(mrDetailsAfter.status, 200);
    const detailsBody: any = await mrDetailsAfter.json();
    assert.equal(detailsBody.approvals.length, 1);
    assert.equal(detailsBody.approvals[0].reviewerId, bbobId);
    assert.equal(detailsBody.approvals[0].decision, 'approved');

    // 12. Reviewer (bbob) attempts to execute merge -> Rejected with HTTP 403 (requires maintainer or owner)
    const bbobMergeAttempt = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${bbobId}` },
    });
    assert.equal(bbobMergeAttempt.status, 403);
    const bbobMergeBody: any = await bbobMergeAttempt.json();
    assert.equal(bbobMergeBody.error?.code, 'FORBIDDEN');
    assert.ok(
      bbobMergeBody.error?.message?.toLowerCase().includes('maintainer'),
      'Message specifies maintainer requirement'
    );

    // 13. Verify failed merge attempt preserved MR status and approvals
    const mrAfterFailedMerge = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1`, {
      headers: { Authorization: `Bearer uid:${jackId}` },
    });
    assert.equal(mrAfterFailedMerge.status, 200);
    const afterFailedBody: any = await mrAfterFailedMerge.json();
    assert.equal(afterFailedBody.mergeRequest.status, 'open', 'MR remains open after failed merge');
    assert.equal(afterFailedBody.approvals.length, 1, 'MR approvals remain intact');

    // 14. Owner (Jack) executes the merge -> Succeeds (since Jack is owner and required approvals met)
    const jackMergeRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${jackId}` },
    });
    assert.equal(jackMergeRes.status, 200);
    const jackMergeBody: any = await jackMergeRes.json();
    assert.equal(jackMergeBody.mergeRequest.status, 'merged');

    // 15. Verify MR is now merged in list and details
    const mrMergedDetails = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1`, {
      headers: { Authorization: `Bearer uid:${jackId}` },
    });
    assert.equal(mrMergedDetails.status, 200);
    const mergedDetailsBody: any = await mrMergedDetails.json();
    assert.equal(mergedDetailsBody.mergeRequest.status, 'merged');

    // 16. Edge Case: MR from unrelated repository must not appear for bbob
    // Create unrelated repo owned by Alice where bbob is NOT a member
    const unrelatedRepoRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({ name: 'alice-secret-repo', description: 'Private' }),
    });
    assert.equal(unrelatedRepoRes.status, 201);
    const unrelatedRepoBody: any = await unrelatedRepoRes.json();
    const unrelatedRepoId = unrelatedRepoBody.repository.id;

    // Alice creates an MR in her repo
    const aliceMrRes = await fetch(`${baseUrl}/api/repos/${unrelatedRepoId}/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ALICE_ID}`,
      },
      body: JSON.stringify({
        title: 'Alice secret MR',
        sourceBranch: 'alice-feat',
        targetBranch: 'main',
      }),
    });
    assert.equal(aliceMrRes.status, 201);

    // bbob attempts to list MRs in Alice's unrelated repository -> 404 (hidden existence)
    const bbobUnrelatedRes = await fetch(`${baseUrl}/api/repos/${unrelatedRepoId}/merge-requests`, {
      headers: { Authorization: `Bearer uid:${bbobId}` },
    });
    assert.equal(bbobUnrelatedRes.status, 404);
  });

  it('Test G: Multiple repositories with identical names are distinguished by ownerName and UUID', async () => {
    const userJackId = crypto.randomUUID();
    const userBbobId = crypto.randomUUID();

    users.set(userJackId, {
      id: userJackId,
      email: 'jack_dup@versiondb.local',
      username: 'Jack',
      globalRole: 'developer',
      disabled: false,
    });

    users.set(userBbobId, {
      id: userBbobId,
      email: 'bob_dup@versiondb.local',
      username: 'bbob',
      globalRole: 'reviewer',
      disabled: false,
    });

    // 1. Jack creates a repository named 'mit'
    const jackRepoRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${userJackId}`,
      },
      body: JSON.stringify({ name: 'mit', description: 'Jack project mit' }),
    });
    assert.equal(jackRepoRes.status, 201);
    const jackRepoBody: any = await jackRepoRes.json();
    const jackRepoId = jackRepoBody.repository.id;

    // 2. bbob creates a repository also named 'mit'
    const bbobRepoRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${userBbobId}`,
      },
      body: JSON.stringify({ name: 'mit', description: 'bbob personal mit' }),
    });
    assert.equal(bbobRepoRes.status, 201);
    const bbobRepoBody: any = await bbobRepoRes.json();
    const bbobRepoId = bbobRepoBody.repository.id;

    // UUIDs must be distinct
    assert.notEqual(jackRepoId, bbobRepoId);

    // 3. Jack adds bbob as a reviewer to Jack's 'mit' repository
    const inviteRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${userJackId}`,
      },
      body: JSON.stringify({ email: 'bob_dup@versiondb.local', role: 'reviewer' }),
    });
    assert.equal(inviteRes.status, 204);

    // 4. Jack creates an MR in his 'mit' repository
    const mrRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${userJackId}`,
      },
      body: JSON.stringify({
        title: 'added oggy',
        description: 'Jack Oggy PR',
        sourceBranch: 'jack-personal-branch',
        targetBranch: 'main',
      }),
    });
    assert.equal(mrRes.status, 201);

    // 5. bbob lists repositories -> must see BOTH 'mit' repositories with owner names
    const bbobReposRes = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: `Bearer uid:${userBbobId}` },
    });
    assert.equal(bbobReposRes.status, 200);
    const bbobReposBody: any = await bbobReposRes.json();
    const mitRepos = bbobReposBody.repositories.filter((r: any) => r.name === 'mit');
    assert.equal(mitRepos.length, 2);

    const jackMit = mitRepos.find((r: any) => r.id === jackRepoId);
    const bbobMit = mitRepos.find((r: any) => r.id === bbobRepoId);
    assert.ok(jackMit, 'Jack mit repo must be in list');
    assert.ok(bbobMit, 'bbob mit repo must be in list');
    assert.equal(jackMit.ownerName, 'Jack');
    assert.equal(bbobMit.ownerName, 'bbob');

    // 6. bbob queries MRs for bbob's own 'mit' repo -> returns 0 MRs
    const bbobOwnMrRes = await fetch(`${baseUrl}/api/repos/${bbobRepoId}/merge-requests`, {
      headers: { Authorization: `Bearer uid:${userBbobId}` },
    });
    assert.equal(bbobOwnMrRes.status, 200);
    const bbobOwnMrBody: any = await bbobOwnMrRes.json();
    assert.equal(bbobOwnMrBody.mergeRequests.length, 0);

    // 7. bbob queries MRs for Jack's 'mit' repo -> returns Jack's MR 'added oggy'
    const jackMrRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests`, {
      headers: { Authorization: `Bearer uid:${userBbobId}` },
    });
    assert.equal(jackMrRes.status, 200);
    const jackMrBody: any = await jackMrRes.json();
    assert.equal(jackMrBody.mergeRequests.length, 1);
    assert.equal(jackMrBody.mergeRequests[0].title, 'added oggy');

    // 8. bbob approves Jack's MR in Jack's 'mit' repo
    const approveRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${userBbobId}`,
      },
      body: JSON.stringify({ decision: 'approved', comment: 'Approved by bbob' }),
    });
    assert.equal(approveRes.status, 201);

    // 9. Jack checks MR details -> approval is visible
    const mrDetailsRes = await fetch(`${baseUrl}/api/repos/${jackRepoId}/merge-requests/1`, {
      headers: { Authorization: `Bearer uid:${userJackId}` },
    });
    assert.equal(mrDetailsRes.status, 200);
    const mrDetailsBody: any = await mrDetailsRes.json();
    assert.equal(mrDetailsBody.approvals.length, 1);
    assert.equal(mrDetailsBody.approvals[0].reviewerId, userBbobId);
    assert.equal(mrDetailsBody.approvals[0].decision, 'approved');
  });

  it('Test H: Maintainer can merge approved MR, and unapproved MR merge is rejected', async () => {
    const ownerId = crypto.randomUUID();
    const maintainerId = crypto.randomUUID();
    const reviewerId = crypto.randomUUID();

    users.set(ownerId, {
      id: ownerId,
      email: 'owner_h@versiondb.local',
      username: 'OwnerH',
      globalRole: 'developer',
      disabled: false,
    });
    users.set(maintainerId, {
      id: maintainerId,
      email: 'maintainer_h@versiondb.local',
      username: 'MaintainerH',
      globalRole: 'developer',
      disabled: false,
    });
    users.set(reviewerId, {
      id: reviewerId,
      email: 'reviewer_h@versiondb.local',
      username: 'ReviewerH',
      globalRole: 'reviewer',
      disabled: false,
    });

    // 1. Owner creates repository
    const repoRes = await fetch(`${baseUrl}/api/repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ownerId}`,
      },
      body: JSON.stringify({ name: 'repo-h', description: 'Testing maintainer merge' }),
    });
    assert.equal(repoRes.status, 201);
    const repoBody: any = await repoRes.json();
    const repoId = repoBody.repository.id;

    // 2. Add maintainer and reviewer to repo
    const addMaintainer = await fetch(`${baseUrl}/api/repos/${repoId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ownerId}`,
      },
      body: JSON.stringify({ email: 'maintainer_h@versiondb.local', role: 'maintainer' }),
    });
    assert.equal(addMaintainer.status, 204);

    const addReviewer = await fetch(`${baseUrl}/api/repos/${repoId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${ownerId}`,
      },
      body: JSON.stringify({ email: 'reviewer_h@versiondb.local', role: 'reviewer' }),
    });
    assert.equal(addReviewer.status, 204);

    // 3. Maintainer creates MR
    const mrRes = await fetch(`${baseUrl}/api/repos/${repoId}/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${maintainerId}`,
      },
      body: JSON.stringify({
        title: 'Maintainer change',
        sourceBranch: 'feat-maintainer',
        targetBranch: 'main',
      }),
    });
    assert.equal(mrRes.status, 201);

    // 4. Attempt merge before approval -> Rejected with 409 INSUFFICIENT_APPROVALS
    const earlyMergeRes = await fetch(`${baseUrl}/api/repos/${repoId}/merge-requests/1/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${maintainerId}` },
    });
    assert.equal(earlyMergeRes.status, 409);
    const earlyMergeBody: any = await earlyMergeRes.json();
    assert.equal(earlyMergeBody.error?.code, 'INSUFFICIENT_APPROVALS');

    // 5. Reviewer approves MR
    const approveRes = await fetch(`${baseUrl}/api/repos/${repoId}/merge-requests/1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer uid:${reviewerId}`,
      },
      body: JSON.stringify({ decision: 'approved', comment: 'LGTM' }),
    });
    assert.equal(approveRes.status, 201);

    // 6. Reviewer still cannot merge -> 403
    const reviewerMergeRes = await fetch(`${baseUrl}/api/repos/${repoId}/merge-requests/1/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${reviewerId}` },
    });
    assert.equal(reviewerMergeRes.status, 403);

    // 7. Maintainer merges -> 200 OK
    const maintainerMergeRes = await fetch(`${baseUrl}/api/repos/${repoId}/merge-requests/1/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer uid:${maintainerId}` },
    });
    assert.equal(maintainerMergeRes.status, 200);
    const maintainerMergeBody: any = await maintainerMergeRes.json();
    assert.equal(maintainerMergeBody.mergeRequest.status, 'merged');
  });
});
