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
  globalRole: 'user' | 'admin';
  disabled: boolean;
}

interface RepoRecord {
  id: string;
  name: string;
  description: string;
  ownerId: string;
}

const users = new Map<string, UserRecord>();
const repos = new Map<string, RepoRecord>();
// repoId -> (userId -> role)
const memberships = new Map<string, Map<string, RepoRole>>();

function resetState() {
  users.clear();
  repos.clear();
  memberships.clear();

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
  if (actor.globalRole === 'admin') return [...repos.values()];
  return [...repos.values()].filter((r) => memberships.get(r.id)?.has(actor.userId));
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
      if (!u || u.disabled) throw unauthorized('USER_DISABLED', 'Account disabled');
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
      const repo: RepoRecord = {
        id,
        name: input.name,
        description: input.description ?? '',
        ownerId: actor.userId,
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

    authorize: async (actor: Actor, repoId: string, _capability: string) => {
      return authorizeRepo(actor, repoId, 'viewer');
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
      sql: {} as any,
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
});
