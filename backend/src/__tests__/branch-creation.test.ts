import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app';
import type { Container } from '../container';
import type { Env } from '../config/env';
import type { Logger } from '../observability/logger';
import { conflict, forbidden, notFound, unauthorized } from '../shared/errors';
import type { Actor, Branch } from '../domain/types';
import { RepositoryService } from '../application/repository/repository.service';

describe('VersionDB Branch Creation API & Service Tests', () => {
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;
  let baseUrl: string;

  // In-memory branch state for tests
  const repoBranches: Map<string, Branch[]> = new Map();
  const repoMembers: Map<string, Map<string, 'owner' | 'maintainer' | 'reviewer' | 'viewer'>> = new Map();

  const testRepoId = '123e4567-e89b-42d3-a456-426614174000';

  const resetState = () => {
    repoBranches.clear();
    repoBranches.set(testRepoId, [
      {
        id: 'b-1',
        repoId: testRepoId,
        name: 'main',
        headCommitId: 'commit-main-1',
        createdBy: 'u-owner',
        createdAt: new Date(),
        protection: { requiredApprovals: 1 },
      },
      {
        id: 'b-2',
        repoId: testRepoId,
        name: 'staging',
        headCommitId: 'commit-staging-1',
        createdBy: 'u-owner',
        createdAt: new Date(),
        protection: null,
      },
      {
        id: 'b-3',
        repoId: testRepoId,
        name: 'release',
        headCommitId: 'commit-release-1',
        createdBy: 'u-owner',
        createdAt: new Date(),
        protection: { requiredApprovals: 2 },
      },
    ]);

    repoMembers.clear();
    const members = new Map<string, 'owner' | 'maintainer' | 'reviewer' | 'viewer'>();
    members.set('u-owner', 'owner');
    members.set('u-maintainer', 'maintainer');
    members.set('u-reviewer', 'reviewer');
    members.set('u-viewer', 'viewer');
    repoMembers.set(testRepoId, members);
  };

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
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      child: () => mockLogger,
    };

    const mockAuthService: any = {
      verifyAccessToken: (token: string) => {
        if (token === 'owner-token') return { userId: 'u-owner', globalRole: 'user' };
        if (token === 'maintainer-token') return { userId: 'u-maintainer', globalRole: 'user' };
        if (token === 'viewer-token') return { userId: 'u-viewer', globalRole: 'user' };
        if (token === 'admin-token') return { userId: 'u-admin', globalRole: 'admin' };
        throw unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
      },
      loadActiveUser: async (userId: string) => ({
        id: userId,
        email: `${userId}@example.com`,
        username: userId,
        globalRole: userId === 'u-admin' ? 'admin' : 'user',
        disabled: false,
      }),
      login: async () => ({ token: 'mock' }),
      register: async () => ({ id: 'mock' }),
      me: async (userId: string) => ({ id: userId }),
      refresh: async () => ({ token: 'mock' }),
      logout: async () => {},
    };

    const mockRepositoriesService: any = {
      listBranches: async (actor: Actor, repoId: string) => {
        if (repoId !== testRepoId) throw notFound('Repository');
        return repoBranches.get(repoId) || [];
      },
      createBranch: async (
        actor: Actor,
        repoId: string,
        input: { name: string; sourceBranch: string }
      ) => {
        if (repoId !== testRepoId) throw notFound('Repository');

        // Check user permission
        const members = repoMembers.get(repoId);
        const role = actor.globalRole === 'admin' ? 'owner' : members?.get(actor.userId);
        if (!role) throw notFound('Repository');
        if (role !== 'owner' && role !== 'maintainer') {
          throw forbidden('FORBIDDEN', 'This action requires the maintainer role or higher');
        }

        const branches = repoBranches.get(repoId) || [];
        const source = branches.find((b) => b.name === input.sourceBranch);
        if (!source) {
          throw notFound(`Source branch '${input.sourceBranch}'`);
        }

        const existing = branches.find((b) => b.name === input.name);
        if (existing) {
          throw conflict('BRANCH_EXISTS', `A branch with name '${input.name}' already exists in this repository`);
        }

        const newBranch: Branch = {
          id: `b-${Date.now()}`,
          repoId,
          name: input.name,
          headCommitId: source.headCommitId,
          createdBy: actor.userId,
          createdAt: new Date(),
          protection: null,
        };
        branches.push(newBranch);
        return { ...newBranch, sourceBranch: source.name };
      },
      deleteBranch: async (
        actor: Actor,
        repoId: string,
        branchName: string,
        options?: { activeBranch?: string }
      ) => {
        if (repoId !== testRepoId) throw notFound('Repository');

        // Check user permission
        const members = repoMembers.get(repoId);
        const role = actor.globalRole === 'admin' ? 'owner' : members?.get(actor.userId);
        if (!role) throw notFound('Repository');
        if (role !== 'owner' && role !== 'maintainer') {
          throw forbidden('FORBIDDEN', 'This action requires the maintainer role or higher');
        }

        // Default branch protection
        if (branchName === 'main') {
          throw conflict('DEFAULT_BRANCH_PROTECTED', `Cannot delete default branch '${branchName}' of the repository`);
        }

        // Active branch check
        if (options?.activeBranch && branchName === options.activeBranch) {
          throw conflict('ACTIVE_BRANCH_CONFLICT', `Cannot delete currently active branch '${branchName}'. Switch to another branch first.`);
        }

        const branches = repoBranches.get(repoId) || [];
        const branch = branches.find((b) => b.name === branchName);
        if (!branch) {
          throw notFound(`Branch '${branchName}'`);
        }

        // Protected branch check
        if (branch.protection) {
          throw conflict('PROTECTED_BRANCH', `Branch '${branchName}' is protected and cannot be deleted`);
        }

        // Remove from in-memory state
        const idx = branches.indexOf(branch);
        if (idx >= 0) branches.splice(idx, 1);
        return { deleted: true, branchName };
      },
    };

    const mockContainer: Container = {
      env: mockEnv,
      logger: mockLogger,
      uow: {} as any,
      storage: {} as any,
      cache: {} as any,
      services: {
        audit: {} as any,
        auth: mockAuthService,
        members: {} as any,
        repositories: mockRepositoriesService,
        history: {} as any,
        records: {} as any,
        commits: {} as any,
        idempotency: {
          begin: async () => ({ kind: 'new' }),
          complete: async () => {},
          release: async () => {},
        } as any,
      },
    };

    const app = createApp(mockContainer);
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
  });

  // --- HTTP Endpoint Tests (Branch Creation) ---

  it('rejects unauthenticated branch creation with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'feature-1', sourceBranch: 'main' }),
    });
    assert.equal(res.status, 401);
  });

  it('rejects empty or invalid branch name with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ name: '   ', sourceBranch: 'main' }),
    });
    assert.equal(res.status, 400);

    const dotRes = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ name: 'feature..invalid', sourceBranch: 'main' }),
    });
    assert.equal(dotRes.status, 400);
  });

  it('rejects creation when user has insufficient permissions (viewer) with HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer viewer-token',
      },
      body: JSON.stringify({ name: 'feature-by-viewer', sourceBranch: 'main' }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'FORBIDDEN');
  });

  it('rejects creation for nonexistent repository with HTTP 404', async () => {
    // Valid v4 UUID format for route param
    const nonExistentId = '999e4567-e89b-42d3-a456-426614174999';
    const res = await fetch(`${baseUrl}/api/repos/${nonExistentId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ name: 'feature-new', sourceBranch: 'main' }),
    });
    assert.equal(res.status, 404);
  });

  it('rejects creation for nonexistent source branch with HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer maintainer-token',
      },
      body: JSON.stringify({ name: 'feature-xyz', sourceBranch: 'nonexistent-branch' }),
    });
    assert.equal(res.status, 404);
  });

  it('rejects duplicate branch name in same repository with HTTP 409', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ name: 'main', sourceBranch: 'staging' }),
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'BRANCH_EXISTS');
  });

  it('successfully creates branch inheriting source head commit and returns HTTP 201', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer maintainer-token',
      },
      body: JSON.stringify({ name: 'feature-analytics', sourceBranch: 'main' }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.ok(body.branch);
    assert.equal(body.branch.name, 'feature-analytics');
    assert.equal(body.branch.headCommitId, 'commit-main-1');
    assert.equal(body.branch.sourceBranch, 'main');
    assert.equal(body.branch.createdBy, 'u-maintainer');

    // Verify GET /api/repos/:repoId/branches now includes the newly created branch
    const listRes = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'GET',
      headers: { Authorization: 'Bearer maintainer-token' },
    });
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as any;
    const found = listBody.branches.find((b: any) => b.name === 'feature-analytics');
    assert.ok(found, 'Created branch should appear in branch listing');
    assert.equal(found.headCommitId, 'commit-main-1');
  });

  // --- Direct RepositoryService Unit Tests (Branch Creation) ---

  it('RepositoryService.createBranch verifies member capability and logs audit entry', async () => {
    let auditLogged = false;
    let branchCreated = false;

    const mockUow: any = {
      repos: {
        branches: {
          find: async (_repoId: string, name: string) => {
            if (name === 'main') {
              return {
                id: 'b-main',
                repoId: testRepoId,
                name: 'main',
                headCommitId: 'head-c123',
                createdBy: 'u-1',
                createdAt: new Date(),
                protection: null,
              };
            }
            return null; // does not exist yet
          },
        },
      },
      transaction: async (fn: any) => {
        return fn({
          branches: {
            create: async (b: any) => {
              branchCreated = true;
              return {
                id: 'b-new',
                repoId: b.repoId,
                name: b.name,
                headCommitId: b.headCommitId,
                createdBy: b.createdBy,
                createdAt: new Date(),
                protection: null,
              };
            },
          },
        });
      },
    };

    const mockAudit: any = {
      log: async (_repos: any, entry: any) => {
        auditLogged = true;
        assert.equal(entry.action, 'branch.create');
        assert.equal(entry.entityType, 'branch');
        assert.equal(entry.metadata.sourceBranch, 'main');
        assert.equal(entry.metadata.headCommitId, 'head-c123');
      },
    };

    const mockMembers: any = {
      authorize: async (actor: Actor, repoId: string, capability: string) => {
        assert.equal(actor.userId, 'u-maintainer');
        assert.equal(repoId, testRepoId);
        assert.equal(capability, 'branch:create');
        return { repo: { id: testRepoId } as any, role: 'maintainer' as const };
      },
    };

    const service = new RepositoryService(
      mockUow,
      {} as any,
      { DEFAULT_REQUIRED_APPROVALS: 1 } as any,
      mockAudit,
      mockMembers
    );

    const actor: Actor = { userId: 'u-maintainer', globalRole: 'user', ip: '127.0.0.1' };
    const result = await service.createBranch(actor, testRepoId, {
      name: 'feature-direct',
      sourceBranch: 'main',
    });

    assert.equal(result.name, 'feature-direct');
    assert.equal(result.headCommitId, 'head-c123');
    assert.equal(result.sourceBranch, 'main');
    assert.equal(branchCreated, true);
    assert.equal(auditLogged, true);
  });

  // --- HTTP Endpoint Tests (Branch Deletion) ---

  it('rejects unauthenticated branch deletion with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 401);
  });

  it('rejects deletion when user has insufficient permissions (viewer) with HTTP 403', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer viewer-token' },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'FORBIDDEN');
  });

  it('rejects deletion of default branch (main) with HTTP 409', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/main`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'DEFAULT_BRANCH_PROTECTED');
  });

  it('rejects deletion of protected branch (release) with HTTP 409', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/release`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'PROTECTED_BRANCH');
  });

  it('rejects deletion of active branch via query param with HTTP 409', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging?activeBranch=staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'ACTIVE_BRANCH_CONFLICT');
  });

  it('rejects deletion of active branch via x-active-branch header with HTTP 409', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer owner-token',
        'x-active-branch': 'staging',
      },
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error?.code, 'ACTIVE_BRANCH_CONFLICT');
  });

  it('rejects deletion of nonexistent branch with HTTP 404', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/nonexistent-branch`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 404);
  });

  it('rejects deletion of nonexistent repository with HTTP 404', async () => {
    const nonExistentId = '999e4567-e89b-42d3-a456-426614174999';
    const res = await fetch(`${baseUrl}/api/repos/${nonExistentId}/branches/staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 404);
  });

  it('successfully deletes an unprotected non-default branch and returns HTTP 200', async () => {
    resetState();
    // Verify branch exists before deletion
    const listBefore = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'GET',
      headers: { Authorization: 'Bearer owner-token' },
    });
    const listBodyBefore = (await listBefore.json()) as any;
    assert.ok(
      listBodyBefore.branches.some((b: any) => b.name === 'staging'),
      'staging branch should exist before deletion'
    );

    // Delete the branch
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.deleted, true);
    assert.equal(body.branchName, 'staging');

    // Verify branch listing no longer includes the deleted branch
    const listAfter = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches`, {
      method: 'GET',
      headers: { Authorization: 'Bearer owner-token' },
    });
    const listBodyAfter = (await listAfter.json()) as any;
    assert.ok(
      !listBodyAfter.branches.some((b: any) => b.name === 'staging'),
      'staging branch should no longer appear after deletion'
    );
  });

  it('rejects repeated deletion of the same branch with HTTP 404', async () => {
    // Branch was deleted in the previous test; try again
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner-token' },
    });
    assert.equal(res.status, 404);
  });

  it('admin can delete branches regardless of repository membership', async () => {
    resetState();
    const res = await fetch(`${baseUrl}/api/repos/${testRepoId}/branches/staging`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.deleted, true);
    assert.equal(body.branchName, 'staging');
  });

  // --- Direct RepositoryService Unit Tests (Branch Deletion) ---

  it('RepositoryService.deleteBranch validates rules and logs audit entry', async () => {
    let auditLogged = false;
    let branchDeleted = false;

    const mockUow: any = {
      repos: {
        branches: {
          lock: async (_repoId: string, name: string) => {
            if (name === 'feature-del') {
              return {
                id: 'b-del',
                repoId: testRepoId,
                name: 'feature-del',
                headCommitId: 'head-del',
                createdBy: 'u-1',
                createdAt: new Date(),
                protection: null,
              };
            }
            return null;
          },
          delete: async () => { branchDeleted = true; return true; },
          hasOpenMergeRequests: async () => false,
        },
      },
      transaction: async (fn: any) => fn(mockUow.repos),
    };

    const mockAudit: any = {
      log: async (_repos: any, entry: any) => {
        auditLogged = true;
        assert.equal(entry.action, 'branch.delete');
        assert.equal(entry.entityType, 'branch');
        assert.equal(entry.entityId, 'b-del');
        assert.equal(entry.metadata.name, 'feature-del');
      },
    };

    const mockMembers: any = {
      authorize: async (actor: Actor, repoId: string, capability: string) => {
        assert.equal(capability, 'branch:delete');
        return {
          repo: { id: testRepoId, defaultBranch: 'main' } as any,
          role: 'maintainer' as const,
        };
      },
    };

    const service = new RepositoryService(
      mockUow,
      {} as any,
      { DEFAULT_REQUIRED_APPROVALS: 1 } as any,
      mockAudit,
      mockMembers
    );

    const actor: Actor = { userId: 'u-maintainer', globalRole: 'user', ip: '127.0.0.1' };
    const result = await service.deleteBranch(actor, testRepoId, 'feature-del');

    assert.equal(result.deleted, true);
    assert.equal(result.branchName, 'feature-del');
    assert.equal(branchDeleted, true, 'Branch should have been deleted via repo');
    assert.equal(auditLogged, true, 'Audit entry should have been logged');
  });

  it('RepositoryService.deleteBranch rejects default branch', async () => {
    const mockUow: any = { repos: {}, transaction: async () => {} };
    const mockMembers: any = {
      authorize: async () => ({
        repo: { id: testRepoId, defaultBranch: 'main' } as any,
        role: 'owner' as const,
      }),
    };

    const service = new RepositoryService(
      mockUow, {} as any, { DEFAULT_REQUIRED_APPROVALS: 1 } as any, {} as any, mockMembers
    );

    const actor: Actor = { userId: 'u-owner', globalRole: 'user', ip: '127.0.0.1' };
    await assert.rejects(
      () => service.deleteBranch(actor, testRepoId, 'main'),
      (err: any) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'DEFAULT_BRANCH_PROTECTED');
        return true;
      }
    );
  });

  it('RepositoryService.deleteBranch rejects protected branches', async () => {
    const mockUow: any = {
      repos: {
        branches: {
          lock: async () => ({
            id: 'b-prot',
            repoId: testRepoId,
            name: 'release',
            headCommitId: 'h1',
            createdBy: 'u-1',
            createdAt: new Date(),
            protection: { requiredApprovals: 2 },
          }),
        },
      },
      transaction: async (fn: any) => fn(mockUow.repos),
    };
    const mockMembers: any = {
      authorize: async () => ({
        repo: { id: testRepoId, defaultBranch: 'main' } as any,
        role: 'owner' as const,
      }),
    };

    const service = new RepositoryService(
      mockUow, {} as any, { DEFAULT_REQUIRED_APPROVALS: 1 } as any, {} as any, mockMembers
    );

    const actor: Actor = { userId: 'u-owner', globalRole: 'user', ip: '127.0.0.1' };
    await assert.rejects(
      () => service.deleteBranch(actor, testRepoId, 'release'),
      (err: any) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'PROTECTED_BRANCH');
        return true;
      }
    );
  });

  it('RepositoryService.deleteBranch rejects branch with open merge requests', async () => {
    const mockUow: any = {
      repos: {
        branches: {
          lock: async () => ({
            id: 'b-mr',
            repoId: testRepoId,
            name: 'has-mr',
            headCommitId: 'h1',
            createdBy: 'u-1',
            createdAt: new Date(),
            protection: null,
          }),
          hasOpenMergeRequests: async () => true,
        },
      },
      transaction: async (fn: any) => fn(mockUow.repos),
    };
    const mockMembers: any = {
      authorize: async () => ({
        repo: { id: testRepoId, defaultBranch: 'main' } as any,
        role: 'owner' as const,
      }),
    };

    const service = new RepositoryService(
      mockUow, {} as any, { DEFAULT_REQUIRED_APPROVALS: 1 } as any, {} as any, mockMembers
    );

    const actor: Actor = { userId: 'u-owner', globalRole: 'user', ip: '127.0.0.1' };
    await assert.rejects(
      () => service.deleteBranch(actor, testRepoId, 'has-mr'),
      (err: any) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'BRANCH_IN_USE');
        return true;
      }
    );
  });

  it('RepositoryService.deleteBranch rejects active branch when options.activeBranch matches', async () => {
    const mockUow: any = { repos: {}, transaction: async () => {} };
    const mockMembers: any = {
      authorize: async () => ({
        repo: { id: testRepoId, defaultBranch: 'main' } as any,
        role: 'owner' as const,
      }),
    };

    const service = new RepositoryService(
      mockUow, {} as any, { DEFAULT_REQUIRED_APPROVALS: 1 } as any, {} as any, mockMembers
    );

    const actor: Actor = { userId: 'u-owner', globalRole: 'user', ip: '127.0.0.1' };
    await assert.rejects(
      () => service.deleteBranch(actor, testRepoId, 'feature-active', { activeBranch: 'feature-active' }),
      (err: any) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'ACTIVE_BRANCH_CONFLICT');
        return true;
      }
    );
  });
});
