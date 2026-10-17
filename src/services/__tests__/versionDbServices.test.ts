import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BACKEND_INTEGRATION_CONTRACT } from '../../config/appConfig';
import { VersionDbApiClient } from '../apiClient';
import { createVersionDbServices } from '../versionDbServices';

describe('VersionDB Production Service Architecture & Error Handling', () => {
  it('returns UNCONFIGURED_BACKEND when VITE_API_BASE_URL is empty and never fabricates data', async () => {
    const unconfiguredClient = new VersionDbApiClient({ apiBaseUrl: '' });
    const services = createVersionDbServices(unconfiguredClient);

    assert.equal(unconfiguredClient.isConfigured(), false);

    const catalogRes = await services.catalog.fetchWorkspaceState();
    assert.equal(catalogRes.ok, false);
    assert.equal(catalogRes.errorCode, 'UNCONFIGURED_BACKEND');
    assert.equal(catalogRes.data, undefined);

    const queryRes = await services.sql.executeQuery({
      repositoryId: 'repo-1',
      branch: 'main',
      sql: 'SELECT 1;',
    });
    assert.equal(queryRes.ok, false);
    assert.equal(queryRes.errorCode, 'UNCONFIGURED_BACKEND');
    assert.equal(queryRes.data, undefined);
  });

  it('validates empty inputs before attempting network requests', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: '' });
    const services = createVersionDbServices(client);

    const signInRes = await services.auth.signIn('', '');
    assert.equal(signInRes.ok, false);
    assert.equal(signInRes.errorCode, 'VALIDATION_ERROR');

    const commitRes = await services.commits.createCommit({
      repositoryId: 'r1',
      branch: 'main',
      message: '   ',
    });
    assert.equal(commitRes.ok, false);
    assert.equal(commitRes.errorCode, 'VALIDATION_ERROR');
  });

  it('normalizes HTTP 401 Unauthorized responses and invokes onUnauthorized callback', async () => {
    let unauthorizedTriggered = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'https://api.example.invalid',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 }),
    });
    client.setCallbacks({
      onUnauthorized: () => {
        unauthorizedTriggered = true;
      },
    });

    const res = await client.request('/session');
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.errorCode, 'UNAUTHORIZED');
    assert.equal(unauthorizedTriggered, true);
  });

  it('normalizes HTTP 403 Forbidden responses and invokes onForbidden callback', async () => {
    let forbiddenTriggered = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'https://api.example.invalid',
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'Admin role required' }), { status: 403 }),
    });
    client.setCallbacks({
      onForbidden: () => {
        forbiddenTriggered = true;
      },
    });

    const res = await client.request('/admin/approvals');
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.errorCode, 'FORBIDDEN');
    assert.equal(forbiddenTriggered, true);
  });

  it('suppresses onForbidden callback when silent: true on HTTP 403', async () => {
    let forbiddenTriggered = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'https://api.example.invalid',
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 }),
    });
    client.setCallbacks({
      onForbidden: () => {
        forbiddenTriggered = true;
      },
    });

    const res = await client.request('/repos/r1/branches/b1', { silent: true });
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.errorCode, 'FORBIDDEN');
    assert.equal(forbiddenTriggered, false, 'onForbidden should not fire when silent: true');
  });

  it('supports request cancellation via AbortController', async () => {
    const controller = new AbortController();
    controller.abort();

    const client = new VersionDbApiClient({
      apiBaseUrl: 'https://api.example.invalid',
      fetchImpl: async () => new Response('{}', { status: 200 }),
    });

    const res = await client.request('/query', { signal: controller.signal });
    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'NETWORK_ERROR');
  });

  it('documents all required backend capabilities in BACKEND_INTEGRATION_CONTRACT', () => {
    assert.ok(BACKEND_INTEGRATION_CONTRACT.length >= 10);
    const configuredCount = BACKEND_INTEGRATION_CONTRACT.filter(
      (c) => c.contractStatus === 'CONFIGURED'
    ).length;
    const pendingCount = BACKEND_INTEGRATION_CONTRACT.filter(
      (c) => c.contractStatus === 'PENDING_BACKEND_SPEC'
    ).length;

    assert.ok(configuredCount >= 5, 'Should have verified integrated endpoints configured');
    assert.ok(pendingCount >= 5, 'Should truthfully track pending backend endpoints');

    for (const contract of BACKEND_INTEGRATION_CONTRACT) {
      assert.ok(
        contract.contractStatus === 'CONFIGURED' ||
          contract.contractStatus === 'PENDING_BACKEND_SPEC'
      );
    }
  });

  it('correctly resolves endpoint URLs with or without /api suffix', () => {
    const clientWithoutApi = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    assert.equal(
      clientWithoutApi.resolveUrl('/auth/login'),
      'http://localhost:3000/api/auth/login'
    );
    assert.equal(
      clientWithoutApi.resolveUrl('/api/auth/login'),
      'http://localhost:3000/api/auth/login'
    );

    const clientWithApi = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000/api' });
    assert.equal(
      clientWithApi.resolveUrl('/auth/login'),
      'http://localhost:3000/api/auth/login'
    );
    assert.equal(
      clientWithApi.resolveUrl('/api/auth/login'),
      'http://localhost:3000/api/auth/login'
    );
    assert.equal(clientWithApi.resolveUrl('/health'), 'http://localhost:3000/api/health');
  });

  it('successfully executes authentication login and maps backend user to profile', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedBody = String(init?.body || '');
        return new Response(
          JSON.stringify({
            accessToken: 'test-access-token-jwt',
            refreshToken: 'test-refresh-token-xyz',
            expiresIn: 900,
            user: {
              id: '00000000-0000-4000-8000-000000000001',
              email: 'alice@versiondb.local',
              username: 'alice',
              globalRole: 'user',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.auth.signIn('alice@versiondb.local', 'Passw0rd!demo');

    assert.equal(res.ok, true);
    assert.equal(capturedUrl, 'http://localhost:3000/api/auth/login');
    assert.ok(capturedBody.includes('alice@versiondb.local'));
    assert.equal(res.data?.token, 'test-access-token-jwt');
    assert.equal(res.data?.refreshToken, 'test-refresh-token-xyz');
    assert.equal(res.data?.user.name, 'alice');
    assert.equal(res.data?.user.role, 'Developer');
    assert.equal(client.getSessionToken(), 'test-access-token-jwt');
  });

  it('validates user registration parameters before sending request', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    const services = createVersionDbServices(client);

    const resShortPassword = await services.auth.register('test@example.com', 'testuser', 'short');
    assert.equal(resShortPassword.ok, false);
    assert.equal(resShortPassword.errorCode, 'VALIDATION_ERROR');

    const resNoDigits = await services.auth.register('test@example.com', 'testuser', 'lettersonlypass');
    assert.equal(resNoDigits.ok, false);
    assert.equal(resNoDigits.errorCode, 'VALIDATION_ERROR');
  });

  it('normalizes backend structured Zod validation errors into formatted error message', async () => {
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: [
                { path: 'password', message: 'Must contain a letter and a digit' },
                { path: 'email', message: 'Invalid email' },
              ],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const res = await client.request('/repos');
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.error?.includes('password: Must contain a letter and a digit'));
    assert.ok(res.error?.includes('email: Invalid email'));
  });

  it('integrates repository listing and creation endpoints', async () => {
    let methodUsed = '';
    let postedBody = '';

    const mockRepo = {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'inventory',
      description: 'Demo warehouse inventory',
      ownerId: '00000000-0000-4000-8000-000000000002',
      defaultBranch: 'main',
      createdAt: '2026-10-10T12:00:00Z',
      role: 'owner',
    };

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (_url, init) => {
        methodUsed = init?.method || 'GET';
        if (methodUsed === 'POST') {
          postedBody = String(init?.body || '');
          return new Response(JSON.stringify({ repository: mockRepo }), { status: 201 });
        }
        return new Response(JSON.stringify({ repositories: [mockRepo] }), { status: 200 });
      },
    });

    const services = createVersionDbServices(client);

    const listRes = await services.repositories.listRepositories('token-123');
    assert.equal(listRes.ok, true);
    assert.equal(listRes.data?.length, 1);
    assert.equal(listRes.data?.[0].name, 'inventory');
    assert.equal(listRes.data?.[0].engine, 'PostgreSQL');

    const createRes = await services.repositories.createRepository(
      {
        name: 'inventory',
        engine: 'PostgreSQL',
        environment: 'Production',
        region: 'us-east-1',
        defaultBranch: 'main',
      },
      'token-123'
    );
    assert.equal(createRes.ok, true);
    assert.equal(methodUsed, 'POST');
    assert.ok(postedBody.includes('inventory'));
    assert.equal(createRes.data?.name, 'inventory');
  });

  it('integrates record staging (PUT & DELETE) and commit creation', async () => {
    const urlsCalled: string[] = [];
    const methodsCalled: string[] = [];

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        urlsCalled.push(String(url));
        methodsCalled.push(init?.method || 'GET');

        if (init?.method === 'PUT') {
          return new Response(
            JSON.stringify({
              pending: {
                collection: 'products',
                recordId: 'p1',
                op: 'put',
                data: { name: 'Item 1', qty: 10 },
                updatedAt: new Date().toISOString(),
              },
            }),
            { status: 200 }
          );
        }
        if (init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              commit: {
                id: '20000000-0000-4000-8000-000000000001',
                repoId: '10000000-0000-4000-8000-000000000001',
                snapshotHash: 'abcd1234efgh5678',
                authorId: 'user-1',
                authorName: 'alice',
                message: 'Update product quantity',
                kind: 'normal',
                createdAt: new Date().toISOString(),
                parents: [],
                changeCount: 1,
              },
            }),
            { status: 201 }
          );
        }
        return new Response('{}', { status: 200 });
      },
    });

    const services = createVersionDbServices(client);

    const putRes = await services.commits.stageRowMutation(
      {
        repositoryId: '10000000-0000-4000-8000-000000000001',
        branch: 'main',
        table: 'products',
        primaryKeyValue: 'p1',
        operation: 'UPDATE',
        columnName: 'qty',
        newValue: 10,
        rowSnapshot: { id: 'p1', name: 'Item 1', qty: 10 },
      },
      'token-123'
    );
    assert.equal(putRes.ok, true);
    assert.ok(urlsCalled[0].includes('/branches/main/records/products/p1'));
    assert.equal(methodsCalled[0], 'PUT');

    const commitRes = await services.commits.createCommit(
      {
        repositoryId: '10000000-0000-4000-8000-000000000001',
        branch: 'main',
        message: 'Update product quantity',
      },
      'token-123'
    );
    assert.equal(commitRes.ok, true);
    assert.equal(commitRes.data?.message, 'Update product quantity');
    assert.ok(urlsCalled[1].includes('/branches/main/commits'));
    assert.equal(methodsCalled[1], 'POST');
  });

  it('integrates branch creation endpoint with POST /api/repos/:repoId/branches', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';
    let capturedAuth = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method || '';
        capturedBody = String(init?.body || '');
        capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] || '';
        return new Response(
          JSON.stringify({
            branch: {
              id: 'branch-uuid-1',
              repoId: 'repo-uuid-1',
              name: 'feature-payments',
              headCommitId: 'commit-uuid-99',
              createdBy: 'user-1',
              createdAt: '2026-10-12T00:00:00.000Z',
              protection: null,
            },
          }),
          { status: 201 }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.branches.createBranch(
      'repo-uuid-1',
      'feature-payments',
      'main',
      'token-xyz'
    );

    assert.equal(res.ok, true);
    assert.equal(res.statusCode, 201);
    assert.equal(capturedUrl, 'http://localhost:3000/api/repos/repo-uuid-1/branches');
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedAuth, 'Bearer token-xyz');
    assert.deepEqual(JSON.parse(capturedBody), {
      name: 'feature-payments',
      sourceBranch: 'main',
    });
    assert.equal(res.data?.name, 'feature-payments');
    assert.equal(res.data?.headCommitHash, 'commituu');
    assert.equal(res.data?.isProtected, false);
  });

  it('branches.createBranch validates required fields and handles 409 conflict', async () => {
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'BRANCH_EXISTS',
              message: "A branch with name 'main' already exists in this repository",
            },
          }),
          { status: 409 }
        );
      },
    });

    const services = createVersionDbServices(client);

    // Empty branch name validation
    const emptyRes = await services.branches.createBranch('repo-1', '   ', 'main');
    assert.equal(emptyRes.ok, false);
    assert.equal(emptyRes.errorCode, 'VALIDATION_ERROR');

    // Empty repo ID validation
    const noRepoRes = await services.branches.createBranch('', 'feat', 'main');
    assert.equal(noRepoRes.ok, false);
    assert.equal(noRepoRes.errorCode, 'VALIDATION_ERROR');

    // 409 duplicate name conflict
    const conflictRes = await services.branches.createBranch('repo-1', 'main', 'main');
    assert.equal(conflictRes.ok, false);
    assert.equal(conflictRes.statusCode, 409);
    assert.ok(conflictRes.error?.includes('already exists'));
  });

  it('truthfully reports missing endpoints for unimplemented features', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    const services = createVersionDbServices(client);

    const auditExportRes = await services.governance.exportAuditLogs('json', 'token-123');
    assert.equal(auditExportRes.ok, false);
    assert.ok(auditExportRes.error?.includes('not implemented'));

    const mrRes = await services.mergeRequests.createMergeRequest(
      {
        repositoryId: 'repo-1',
        title: 'Feature MR',
        description: 'None',
        sourceBranch: 'feat',
        targetBranch: 'main',
      },
      'token-123'
    );
    assert.equal(mrRes.ok, false);
    assert.ok(mrRes.error?.includes('not implemented'));

    const rollbackRes = await services.governance.executeRollback(
      { snapshotId: 'snap-1', reason: 'Revert' },
      'token-123'
    );
    assert.equal(rollbackRes.ok, false);
    assert.ok(rollbackRes.error?.includes('not implemented'));

    const sqlRes = await services.sql.executeQuery(
      { repositoryId: 'repo-1', branch: 'main', sql: 'SELECT 1;' },
      'token-123'
    );
    assert.equal(sqlRes.ok, false);
    assert.equal(sqlRes.errorCode, 'NOT_IMPLEMENTED');
    assert.ok(sqlRes.error?.includes('not implemented'));
  });
});

// ---------------------------------------------------------------------------
// Registration + Auto-Login Flow Regression Tests
// ---------------------------------------------------------------------------
describe('VersionDB Registration + Auto-Login Flow', () => {
  it('rejects registration with too-short password before making any network request', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    const services = createVersionDbServices(client);
    const res = await services.auth.register('new@example.com', 'newuser', 'short');
    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.error?.includes('10 characters'));
  });

  it('rejects registration with password that has no digit before making any network request', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    const services = createVersionDbServices(client);
    const res = await services.auth.register('new@example.com', 'newuser', 'lettersonly!');
    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.error?.includes('letter and one digit'));
  });

  it('successfully registers and returns user object on HTTP 201', async () => {
    const calls: string[] = [];
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({
            user: {
              id: 'u-new-1',
              email: 'alice@example.com',
              username: 'alice',
              globalRole: 'user',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.auth.register('alice@example.com', 'alice', 'SecurePass1!');

    assert.equal(res.ok, true);
    assert.equal(res.data?.user.name, 'alice');
    assert.equal(res.data?.user.email, 'alice@example.com');
    assert.equal(calls[0], 'http://localhost:3000/api/auth/register');
  });

  it('registration → auto-login: successful register then login sets session token', async () => {
    let callIndex = 0;
    const responses = [
      // POST /api/auth/register
      new Response(
        JSON.stringify({
          user: { id: 'u-reg-1', email: 'bob@example.com', username: 'bob', globalRole: 'user' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      ),
      // POST /api/auth/login
      new Response(
        JSON.stringify({
          accessToken: 'access-tok-bob',
          refreshToken: 'refresh-tok-bob',
          expiresIn: 900,
          user: { id: 'u-reg-1', email: 'bob@example.com', username: 'bob', globalRole: 'user' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ),
    ];

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => responses[callIndex++]!,
    });

    const services = createVersionDbServices(client);

    // Step 1: register
    const regRes = await services.auth.register('bob@example.com', 'bob', 'SecurePass1!');
    assert.equal(regRes.ok, true, 'Registration should succeed');
    // Token should not be set yet (register returns only user, no token)
    assert.equal(client.getSessionToken(), null);

    // Step 2: auto-login (mirrors what VersionDbContext.registerWithBackend does)
    const loginRes = await services.auth.signIn('bob@example.com', 'SecurePass1!');
    assert.equal(loginRes.ok, true, 'Auto-login after registration should succeed');
    assert.equal(loginRes.data?.token, 'access-tok-bob');
    assert.equal(loginRes.data?.user.email, 'bob@example.com');
    // After signIn, the client stores the token
    assert.equal(client.getSessionToken(), 'access-tok-bob');
  });

  it('registration → auto-login failure: login 401 returns errorCode UNAUTHORIZED', async () => {
    let callIndex = 0;
    const responses = [
      // POST /api/auth/register — success
      new Response(
        JSON.stringify({
          user: { id: 'u-reg-2', email: 'carol@example.com', username: 'carol', globalRole: 'user' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      ),
      // POST /api/auth/login — fails (e.g., timing/session issue)
      new Response(
        JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    ];

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => responses[callIndex++]!,
    });

    const services = createVersionDbServices(client);

    // Step 1: register succeeds
    const regRes = await services.auth.register('carol@example.com', 'carol', 'SecurePass1!');
    assert.equal(regRes.ok, true);

    // Step 2: auto-login fails
    const loginRes = await services.auth.signIn('carol@example.com', 'SecurePass1!');
    assert.equal(loginRes.ok, false);
    assert.equal(loginRes.errorCode, 'UNAUTHORIZED');
    assert.equal(client.getSessionToken(), null);
  });

  it('returns 409 CONFLICT when backend rejects duplicate registration', async () => {
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: { code: 'ACCOUNT_EXISTS', message: 'An account with that email already exists' },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const services = createVersionDbServices(client);
    const res = await services.auth.register('duplicate@example.com', 'dupeuser', 'SecurePass1!');

    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 409);
    assert.ok(res.error?.toLowerCase().includes('conflict') || res.error?.toLowerCase().includes('exists'));
  });
});

// ---------------------------------------------------------------------------
// Integration Bug Fix Regressions
// ---------------------------------------------------------------------------
describe('VersionDB Integration Bug Fix Regressions', () => {
  it('extracts backend message on 401 login failure and suppresses onUnauthorized session callback', async () => {
    let unauthorizedCallbackTriggered = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    client.setCallbacks({
      onUnauthorized: () => {
        unauthorizedCallbackTriggered = true;
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.auth.signIn('user@example.com', 'wrongpassword');

    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.errorCode, 'UNAUTHORIZED');
    assert.equal(res.error, 'Invalid credentials');
    assert.equal(
      unauthorizedCallbackTriggered,
      false,
      'Login credential failure should not trigger session expiration callback'
    );
  });

  it('invokes onUnauthorized with server error message on protected routes', async () => {
    let unauthorizedMsg = '';
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: { code: 'INVALID_TOKEN', message: 'Session token has expired' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    client.setCallbacks({
      onUnauthorized: (msg) => {
        unauthorizedMsg = msg;
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.repositories.listRepositories('expired-token');

    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.error, 'Session token has expired');
    assert.equal(unauthorizedMsg, 'Session token has expired');
  });

  it('fetchWorkspaceState targets specified repository when targetRepoId is provided', async () => {
    const urlsRequested: string[] = [];
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url) => {
        const urlStr = String(url);
        urlsRequested.push(urlStr);
        if (urlStr.endsWith('/api/repos')) {
          return new Response(
            JSON.stringify({
              repositories: [
                { id: 'repo-1', name: 'repo-one', defaultBranch: 'main' },
                { id: 'repo-2', name: 'repo-two', defaultBranch: 'main' },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes('/branches')) {
          return new Response(JSON.stringify({ branches: [] }), { status: 200 });
        }
        if (urlStr.includes('/members')) {
          return new Response(JSON.stringify({ members: [] }), { status: 200 });
        }
        if (urlStr.includes('/records')) {
          return new Response(JSON.stringify({ commitId: null, collections: [] }), { status: 200 });
        }
        if (urlStr.includes('/history')) {
          return new Response(JSON.stringify({ commits: [] }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.catalog.fetchWorkspaceState('token-123', 'repo-2');

    assert.equal(res.ok, true);
    assert.equal(res.data?.repositories.length, 2);
    // Verified that repo-2 endpoints were invoked
    assert.ok(urlsRequested.some((u) => u.includes('/api/repos/repo-2/branches')));
    assert.ok(urlsRequested.some((u) => u.includes('/api/repos/repo-2/members')));
  });

  it('members.updateMemberRole sends PATCH /api/repos/:repoId/members/:userId with repo role', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method || '';
        capturedBody = String(init?.body || '');
        return new Response(null, { status: 204 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.members.updateMemberRole('repo-1', 'user-1', 'Reviewer', 'tok-1');

    assert.equal(res.ok, true);
    assert.equal(res.statusCode, 204);
    assert.equal(capturedUrl, 'http://localhost:3000/api/repos/repo-1/members/user-1');
    assert.equal(capturedMethod, 'PATCH');
    assert.deepEqual(JSON.parse(capturedBody), { role: 'reviewer' });
  });

  it('records.discardWorkingChanges sends DELETE /api/repos/:repoId/branches/:branch/working', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method || '';
        return new Response(JSON.stringify({ discarded: 3 }), { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.records.discardWorkingChanges('repo-1', 'main', 'tok-1');

    assert.equal(res.ok, true);
    assert.equal(capturedUrl, 'http://localhost:3000/api/repos/repo-1/branches/main/working');
    assert.equal(capturedMethod, 'DELETE');
    assert.equal(res.data?.discarded, 3);
  });

  it('diagnostics.checkHealth queries /api/health with silent mode and returns latency', async () => {
    let capturedUrl = '';
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.diagnostics.checkHealth();

    assert.equal(res.ok, true);
    assert.equal(capturedUrl, 'http://localhost:3000/api/health');
    assert.equal(res.data?.status, 'ok');
    assert.equal(typeof res.data?.latencyMs, 'number');
    assert.ok((res.data?.latencyMs ?? -1) >= 0);
  });

  it('diagnostics.checkReady queries /api/ready and returns readiness status', async () => {
    let capturedUrl = '';
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify({ status: 'ready', database: 'healthy' }), {
          status: 200,
        });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.diagnostics.checkReady();

    assert.equal(res.ok, true);
    assert.equal(capturedUrl, 'http://localhost:3000/api/ready');
    assert.equal(res.data?.status, 'ready');
    assert.equal(typeof res.data?.latencyMs, 'number');
  });

  it('auth.verifySession with silent: true suppresses onUnauthorized callback', async () => {
    let unauthorizedFired = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        return new Response(JSON.stringify({ error: { message: 'Invalid token' } }), {
          status: 401,
        });
      },
    });

    client.setCallbacks({
      onUnauthorized: () => {
        unauthorizedFired = true;
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.auth.verifySession('bad-tok', { silent: true });

    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 401);
    assert.equal(unauthorizedFired, false, 'onUnauthorized should not fire when silent: true');
  });

  it('repositories.createRepository validates empty name before making network request', async () => {
    let fetchCalled = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.repositories.createRepository({
      name: '   ',
      engine: 'PostgreSQL',
      environment: 'Production',
      region: 'us-east-1',
      defaultBranch: 'main',
    });

    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.equal(fetchCalled, false, 'Fetch should not be called when name is invalid');
  });

  it('branches.deleteBranch validates empty inputs before making network request', async () => {
    let fetchCalled = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    });

    const services = createVersionDbServices(client);

    const emptyNameRes = await services.branches.deleteBranch('repo-1', '   ');
    assert.equal(emptyNameRes.ok, false);
    assert.equal(emptyNameRes.errorCode, 'VALIDATION_ERROR');

    const emptyRepoRes = await services.branches.deleteBranch('', 'staging');
    assert.equal(emptyRepoRes.ok, false);
    assert.equal(emptyRepoRes.errorCode, 'VALIDATION_ERROR');

    assert.equal(fetchCalled, false, 'Fetch should not be called when inputs are invalid');
  });

  it('branches.deleteBranch rejects active branch locally before making network request', async () => {
    let fetchCalled = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.branches.deleteBranch('repo-1', 'staging', 'tok', {
      activeBranch: 'staging',
    });

    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.error?.includes('Cannot delete active branch'));
    assert.equal(fetchCalled, false, 'Fetch should not be called when activeBranch matches');
  });

  it('branches.deleteBranch calls DELETE /api/repos/:repoId/branches/:branchName and parses success', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedAuth = '';
    let capturedActiveHeader = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method || '';
        capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] || '';
        capturedActiveHeader = (init?.headers as Record<string, string>)?.['x-active-branch'] || '';
        return new Response(
          JSON.stringify({ deleted: true, branchName: 'staging' }),
          { status: 200 }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.branches.deleteBranch('repo-uuid-1', 'staging', 'token-abc', {
      activeBranch: 'main',
    });

    assert.equal(res.ok, true);
    assert.equal(res.statusCode, 200);
    assert.equal(capturedUrl, 'http://localhost:3000/api/repos/repo-uuid-1/branches/staging?activeBranch=main');
    assert.equal(capturedMethod, 'DELETE');
    assert.equal(capturedAuth, 'Bearer token-abc');
    assert.equal(res.data?.success, true);
    assert.equal(res.data?.branchName, 'staging');
  });

  it('branches.deleteBranch handles 409 conflict responses properly', async () => {
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'PROTECTED_BRANCH',
              message: "Branch 'release' is protected and cannot be deleted",
            },
          }),
          { status: 409 }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.branches.deleteBranch('repo-uuid-1', 'release', 'tok');

    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 409);
    assert.ok(res.error?.includes('protected and cannot be deleted'));
  });

  it('branches.deleteBranch handles 403 forbidden and 404 not found responses properly', async () => {
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (_url, init) => {
        const auth = (init?.headers as Record<string, string>)?.['Authorization'];
        if (auth === 'Bearer viewer-tok') {
          return new Response(
            JSON.stringify({
              error: {
                code: 'FORBIDDEN',
                message: 'This action requires the maintainer role or higher',
              },
            }),
            { status: 403 }
          );
        }
        return new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: "Branch 'nonexistent' not found",
            },
          }),
          { status: 404 }
        );
      },
    });

    const services = createVersionDbServices(client);

    const forbiddenRes = await services.branches.deleteBranch('repo-uuid-1', 'staging', 'viewer-tok');
    assert.equal(forbiddenRes.ok, false);
    assert.equal(forbiddenRes.statusCode, 403);

    const notFoundRes = await services.branches.deleteBranch('repo-uuid-1', 'nonexistent', 'admin-tok');
    assert.equal(notFoundRes.ok, false);
    assert.equal(notFoundRes.statusCode, 404);
  });

  it('repositories.deleteRepository validates empty repoId before making network request', async () => {
    let fetchCalled = false;
    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.repositories.deleteRepository('   ');

    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'VALIDATION_ERROR');
    assert.equal(fetchCalled, false, 'Fetch should not be called with empty repoId');
  });

  it('repositories.deleteRepository sends DELETE /api/repos/:repoId with sessionToken', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedAuth = '';

    const client = new VersionDbApiClient({
      apiBaseUrl: 'http://localhost:3000',
      fetchImpl: async (url, init) => {
        capturedUrl = url.toString();
        capturedMethod = init?.method || '';
        capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] || '';
        return new Response(
          JSON.stringify({
            deleted: true,
            repoId: 'repo-abc-123',
            name: 'payments-db',
          }),
          { status: 200 }
        );
      },
    });

    const services = createVersionDbServices(client);
    const res = await services.repositories.deleteRepository('repo-abc-123', 'owner-token-xyz');

    assert.equal(res.ok, true);
    assert.equal(capturedUrl, 'http://localhost:3000/api/repos/repo-abc-123');
    assert.equal(capturedMethod, 'DELETE');
    assert.equal(capturedAuth, 'Bearer owner-token-xyz');
    assert.equal(res.data?.deleted, true);
    assert.equal(res.data?.repoId, 'repo-abc-123');
  });
});
