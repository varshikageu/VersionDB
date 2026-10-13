import { getEnvironmentConfig } from '../config/appConfig';
import { ServiceOperationResult, UserRole } from '../types/versiondb';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  sessionToken?: string | null;
  uiRoleHint?: UserRole;
  headers?: Record<string, string>;
  silent?: boolean;
  skipRefresh?: boolean;
}

export interface ApiClientCallbacks {
  onUnauthorized?: (message: string) => void;
  onForbidden?: (message: string) => void;
}

export interface ApiClientConfigOverride {
  apiBaseUrl?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Centralized HTTP API Client for VersionDB.
 * - Reads VITE_API_BASE_URL via getEnvironmentConfig()
 * - Attaches Bearer authentication headers when a real session token exists
 * - Normalizes endpoint URLs and handles /api route prefixes gracefully
 * - Supports request cancellation (AbortSignal) and configurable timeouts
 * - Normalizes HTTP 400, 401, 403, 404, 5xx, and network errors into ServiceOperationResult
 * - Extracts structured backend Zod validation issue details into human-readable messages
 * - Never fabricates mock responses or fake operational records
 */
export class VersionDbApiClient {
  private callbacks: ApiClientCallbacks = {};
  private configOverride?: ApiClientConfigOverride;
  private defaultSessionToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(configOverride?: ApiClientConfigOverride) {
    this.configOverride = configOverride;
  }

  public setCallbacks(callbacks: ApiClientCallbacks): void {
    this.callbacks = callbacks;
  }

  public setSessionToken(token: string | null): void {
    this.defaultSessionToken = token;
  }

  public getSessionToken(): string | null {
    return this.defaultSessionToken;
  }

  public getBaseUrl(): string {
    if (this.configOverride?.apiBaseUrl !== undefined) {
      return this.configOverride.apiBaseUrl.trim().replace(/\/+$/, '');
    }
    return getEnvironmentConfig().apiBaseUrl;
  }

  public isConfigured(): boolean {
    return this.getBaseUrl().length > 0;
  }

  /**
   * Resolves final request URL given configured base URL and endpoint descriptor.
   * Handles cases where VITE_API_BASE_URL includes or omits the `/api` prefix.
   */
  public resolveUrl(resourceDescriptor: string): string {
    const baseUrl = this.getBaseUrl();
    const cleanPath = resourceDescriptor.startsWith('/') ? resourceDescriptor : `/${resourceDescriptor}`;

    if (!baseUrl) {
      return cleanPath;
    }

    if (baseUrl.endsWith('/api') && cleanPath.startsWith('/api/')) {
      return `${baseUrl}${cleanPath.slice(4)}`;
    }

    if (
      !baseUrl.endsWith('/api') &&
      !cleanPath.startsWith('/api/') &&
      !cleanPath.startsWith('/health') &&
      !cleanPath.startsWith('/ready') &&
      !cleanPath.startsWith('/metrics')
    ) {
      return `${baseUrl}/api${cleanPath}`;
    }

    return `${baseUrl}${cleanPath}`;
  }

  public async executeTokenRefresh(refreshToken: string): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshUrl = this.resolveUrl('/auth/refresh');
        const fetchFn = this.configOverride?.fetchImpl ?? globalThis.fetch.bind(globalThis);
        const response = await fetchFn(refreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
          if (data?.accessToken) {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('versiondb_token', data.accessToken);
              if (data.refreshToken) {
                localStorage.setItem('versiondb_refresh_token', data.refreshToken);
              }
            }
            this.setSessionToken(data.accessToken);
            return data.accessToken;
          }
        }

        // Refresh failed (invalid or expired refresh token)
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('versiondb_token');
          localStorage.removeItem('versiondb_refresh_token');
        }
        this.setSessionToken(null);
        return null;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T>(
    resourceDescriptor: string,
    options: ApiRequestOptions = {}
  ): Promise<ServiceOperationResult<T>> {
    const baseUrl = this.getBaseUrl();

    if (!baseUrl) {
      return {
        ok: false,
        errorCode: 'UNCONFIGURED_BACKEND',
        error: `Backend Not Configured: Cannot execute "${resourceDescriptor}" because VITE_API_BASE_URL is not set.`,
      };
    }

    if (resourceDescriptor.startsWith('PENDING_SPEC')) {
      return {
        ok: false,
        errorCode: 'PENDING_BACKEND_SPEC',
        error: `Service Contract Pending: "${resourceDescriptor}" requires backend endpoint specification.`,
      };
    }

    const timeoutMs =
      options.timeoutMs ??
      this.configOverride?.requestTimeoutMs ??
      getEnvironmentConfig().requestTimeoutMs;

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        globalThis.clearTimeout(timeoutId);
        return {
          ok: false,
          errorCode: 'NETWORK_ERROR',
          error: 'Request was cancelled by the user.',
        };
      }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };

    const token = options.sessionToken !== undefined ? options.sessionToken : this.defaultSessionToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchFn = this.configOverride?.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const targetUrl = this.resolveUrl(resourceDescriptor);

    try {
      const response = await fetchFn(targetUrl, {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401) {
        let notAuthDetail =
          'Session unauthorized or expired (HTTP 401). Please authenticate with a valid backend session.';
        try {
          const errJson = await response.json();
          if (errJson?.error && typeof errJson.error === 'object' && errJson.error.message) {
            notAuthDetail = errJson.error.message;
          } else if (typeof errJson?.error === 'string') {
            notAuthDetail = errJson.error;
          } else if (typeof errJson?.message === 'string') {
            notAuthDetail = errJson.message;
          }
        } catch {
          // Ignore parse failure
        }
        const isAuthAttempt =
          resourceDescriptor.includes('/auth/login') ||
          resourceDescriptor.includes('/auth/register') ||
          resourceDescriptor.includes('/auth/refresh');

        // Transparent token refresh on 401 if refresh token is available and not retried yet
        if (!isAuthAttempt && !options.skipRefresh && typeof window !== 'undefined' && window.localStorage) {
          const storedRefreshToken = localStorage.getItem('versiondb_refresh_token');
          if (storedRefreshToken) {
            const freshAccessToken = await this.executeTokenRefresh(storedRefreshToken);
            if (freshAccessToken) {
              return this.request<T>(resourceDescriptor, {
                ...options,
                sessionToken: freshAccessToken,
                skipRefresh: true,
              });
            }
          }
        }

        if (!isAuthAttempt && !options.silent) {
          this.callbacks.onUnauthorized?.(notAuthDetail);
        }
        return {
          ok: false,
          statusCode: 401,
          errorCode: 'UNAUTHORIZED',
          error: notAuthDetail,
        };
      }

      if (response.status === 403) {
        let msg =
          'Access denied by backend authorization policy (HTTP 403). Your account does not have permission for this operation.';
        try {
          const errJson = await response.json();
          if (errJson?.error && typeof errJson.error === 'object' && errJson.error.message) {
            msg = errJson.error.message;
          } else if (typeof errJson?.error === 'string') {
            msg = errJson.error;
          } else if (typeof errJson?.message === 'string') {
            msg = errJson.message;
          }
        } catch {
          // Ignore parse failure
        }
        if (!options.silent) {
          this.callbacks.onForbidden?.(msg);
        }
        return {
          ok: false,
          statusCode: 403,
          errorCode: 'FORBIDDEN',
          error: msg,
        };
      }

      if (response.status === 404) {
        let notFoundDetail = 'Requested resource was not found on the server (HTTP 404).';
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            notFoundDetail = errJson.error.message;
          }
        } catch {
          // Ignore parse failure
        }
        return {
          ok: false,
          statusCode: 404,
          errorCode: 'NOT_FOUND',
          error: notFoundDetail,
        };
      }

      if (!response.ok) {
        let serverDetail = '';
        let errorCode: ServiceOperationResult['errorCode'] =
          response.status === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';

        try {
          const errJson = await response.json();
          if (errJson?.error && typeof errJson.error === 'object') {
            const errObj = errJson.error as {
              code?: string;
              message?: string;
              details?: Array<{ path?: string; message?: string }>;
            };
            if (errObj.details && Array.isArray(errObj.details) && errObj.details.length > 0) {
              const detailLines = errObj.details
                .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message || 'invalid field'))
                .join('; ');
              serverDetail = `${errObj.message || 'Validation failed'}: ${detailLines}`;
            } else {
              serverDetail = errObj.message || '';
            }
            if (
              errObj.code === 'VALIDATION_ERROR' ||
              errObj.code === 'INVALID_RECORD' ||
              errObj.code === 'INVALID_MESSAGE'
            ) {
              errorCode = 'VALIDATION_ERROR';
            }
          } else if (typeof errJson?.error === 'string') {
            serverDetail = errJson.error;
          } else if (typeof errJson?.message === 'string') {
            serverDetail = errJson.message;
          }
        } catch {
          // Ignore JSON parse failures on non-JSON error payloads
        }

        return {
          ok: false,
          statusCode: response.status,
          errorCode,
          error:
            serverDetail ||
            `Backend service returned HTTP ${response.status} (${response.statusText || 'Error'}).`,
        };
      }

      if (response.status === 204) {
        return {
          ok: true,
          statusCode: 204,
        };
      }

      const data = (await response.json()) as T;
      return {
        ok: true,
        statusCode: response.status,
        data,
      };
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        error: isAbort
          ? 'Request timed out or was cancelled before the server responded.'
          : err instanceof Error
            ? `Network error communicating with backend: ${err.message}`
            : 'Unable to reach the VersionDB backend service.',
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export const apiClient = new VersionDbApiClient();
