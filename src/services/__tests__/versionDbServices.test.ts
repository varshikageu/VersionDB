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

  it('truthfully reports missing endpoints for unimplemented features', async () => {
    const client = new VersionDbApiClient({ apiBaseUrl: 'http://localhost:3000' });
    const services = createVersionDbServices(client);

    const branchRes = await services.branches.createBranch(
      'repo-1',
      'feature-x',
      'main',
      'token-123'
    );
    assert.equal(branchRes.ok, false);
    assert.ok(branchRes.error?.includes('not implemented'));

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
