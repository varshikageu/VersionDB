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
    for (const contract of BACKEND_INTEGRATION_CONTRACT) {
      assert.equal(contract.contractStatus, 'PENDING_BACKEND_SPEC');
    }
  });
});
