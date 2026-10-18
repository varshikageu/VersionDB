import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app';
import type { Container } from '../container';
import { conflict, unauthorized } from '../shared/errors';
import type { Env } from '../config/env';
import type { Logger } from '../observability/logger';

describe('VersionDB Express Backend Async Error Handling & Rejection Regression', () => {
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;
  let baseUrl: string;
  const unhandledRejections: unknown[] = [];

  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejections.push(reason);
  };

  before(async () => {
    process.on('unhandledRejection', onUnhandledRejection);

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
      login: async ({ identifier, password }: { identifier: string; password: string }) => {
        if (identifier === 'invalid@example.com' || password === 'wrongpass') {
          throw unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
        }
        return {
          token: 'valid-jwt-token',
          refreshToken: 'valid-refresh-token',
          user: { id: 'u-1', email: identifier, username: 'validuser', globalRole: 'user' },
        };
      },
      register: async ({ email, username }: { email: string; username: string }) => {
        if (email === 'existing@example.com') {
          throw conflict('ACCOUNT_EXISTS', 'An account with that email already exists');
        }
        return {
          id: 'u-2',
          email,
          username,
          globalRole: 'user',
          createdAt: new Date().toISOString(),
        };
      },
      verifyAccessToken: (token: string) => {
        if (token === 'valid-jwt-token') {
          return { userId: 'u-1', globalRole: 'user' };
        }
        throw unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
      },
      loadActiveUser: async (userId: string) => {
        if (userId === 'u-1') {
          return { id: 'u-1', email: 'valid@example.com', username: 'validuser', globalRole: 'user', disabled: false };
        }
        throw unauthorized('INVALID_TOKEN', 'Account not available');
      },
      me: async (userId: string) => {
        return { id: userId, email: 'valid@example.com', username: 'validuser', globalRole: 'user', createdAt: new Date() };
      },
      refresh: async () => { throw unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token'); },
      logout: async () => {},
    };

    const mockContainer: Container = {
      env: mockEnv,
      logger: mockLogger,
      uow: { ping: async () => {}, close: async () => {} } as any,
      storage: { ping: async () => {} } as any,
      cache: { get: () => undefined, set: () => {}, delete: () => {}, clear: () => {} } as any,
      services: {
        audit: {} as any,
        auth: mockAuthService,
        members: {} as any,
        repositories: {
          list: async () => [{ id: 'repo-1', name: 'main-db' }],
        } as any,
        history: {} as any,
        records: {} as any,
        commits: {} as any,
        idempotency: {
          begin: async () => ({ kind: 'new' }),
          complete: async () => {},
          release: async () => {},
          purgeExpired: async () => 0,
        } as any,
        sql: {} as any,
      },
    };

    const app = createApp(mockContainer);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    process.removeListener('unhandledRejection', onUnhandledRejection);
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it('handles unauthenticated requests to protected endpoints with HTTP 401 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/repos`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'UNAUTHENTICATED');
    assert.equal(body.error.message, 'Authentication required');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('handles invalid JWT tokens on protected endpoints with HTTP 401 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/repos`, {
      headers: { Authorization: 'Bearer bad-token-xyz' },
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'INVALID_TOKEN');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('handles invalid login credentials with HTTP 401 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'invalid@example.com', password: 'wrongpass' }),
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid credentials');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('handles duplicate registration with HTTP 409 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        username: 'existinguser',
        password: 'ValidPassword123!',
      }),
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'ACCOUNT_EXISTS');
    assert.match(body.error.message, /already exists/i);
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('successfully processes valid login returning HTTP 200 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valid@example.com', password: 'ValidPassword123!' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; user: { email: string } };
    assert.equal(body.token, 'valid-jwt-token');
    assert.equal(body.user.email, 'valid@example.com');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('successfully registers a new account returning HTTP 201 without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'ValidPassword123!',
      }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { user: { email: string; username: string } };
    assert.equal(body.user.email, 'newuser@example.com');
    assert.equal(body.user.username, 'newuser');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('registration + immediate login flow returns 200 without unhandledRejection', async () => {
    // Step 1: register a new account
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'autoflow@example.com',
        username: 'autoflow',
        password: 'AutoFlowPass1!',
      }),
    });
    assert.equal(regRes.status, 201, 'Registration should return 201');

    // Step 2: immediately sign in with the same credentials (mirrors auto-login after register)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'autoflow@example.com', password: 'AutoFlowPass1!' }),
    });
    assert.equal(loginRes.status, 200, 'Login after registration should return 200');
    const loginBody = (await loginRes.json()) as { accessToken: string; user: { email: string } };
    assert.ok(loginBody.accessToken || (loginBody as any).token, 'Response should include access token');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('returns 409 for duplicate email during registration without unhandledRejection', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        username: 'brandnewuser',
        password: 'ValidPassword123!',
      }),
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'ACCOUNT_EXISTS');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });

  it('allows duplicate usernames (display names) for distinct emails during registration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'uniqueemail@example.com',
        username: 'existinguser',
        password: 'ValidPassword123!',
      }),
    });
    assert.equal(res.status, 201, 'Registration with existing display name but distinct email should succeed');
    const body = (await res.json()) as { user: { email: string; username: string } };
    assert.equal(body.user.email, 'uniqueemail@example.com');
    assert.equal(body.user.username, 'existinguser');
    assert.equal(unhandledRejections.length, 0, 'No unhandled promise rejection should occur');
  });
});
