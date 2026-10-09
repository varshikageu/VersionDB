import { getEnvironmentConfig } from '../config/appConfig';
import { ServiceOperationResult, UserRole } from '../types/versiondb';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  sessionToken?: string | null;
  uiRoleHint?: UserRole;
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
 * - Supports request cancellation (AbortSignal) and configurable timeouts
 * - Normalizes HTTP 401, 403, 404, 5xx, and network errors into ServiceOperationResult
 * - Never fabricates mock responses or fake operational records
 */
export class VersionDbApiClient {
  private callbacks: ApiClientCallbacks = {};
  private configOverride?: ApiClientConfigOverride;

  constructor(configOverride?: ApiClientConfigOverride) {
    this.configOverride = configOverride;
  }

  public setCallbacks(callbacks: ApiClientCallbacks): void {
    this.callbacks = callbacks;
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
    };

    if (options.sessionToken) {
      headers['Authorization'] = `Bearer ${options.sessionToken}`;
    }

    const fetchFn = this.configOverride?.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const normalizedPath = resourceDescriptor.startsWith('/')
      ? resourceDescriptor
      : `/${resourceDescriptor}`;

    try {
      const response = await fetchFn(`${baseUrl}${normalizedPath}`, {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401) {
        const msg =
          'Session unauthorized or expired (HTTP 401). Please authenticate with a valid backend session.';
        this.callbacks.onUnauthorized?.(msg);
        return {
          ok: false,
          statusCode: 401,
          errorCode: 'UNAUTHORIZED',
          error: msg,
        };
      }

      if (response.status === 403) {
        const msg =
          'Access denied by backend authorization policy (HTTP 403). Your account does not have permission for this operation.';
        this.callbacks.onForbidden?.(msg);
        return {
          ok: false,
          statusCode: 403,
          errorCode: 'FORBIDDEN',
          error: msg,
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          statusCode: 404,
          errorCode: 'NOT_FOUND',
          error: `Requested resource was not found on the server (HTTP 404).`,
        };
      }

      if (!response.ok) {
        let serverDetail = '';
        try {
          const errJson = await response.json();
          serverDetail = errJson?.message || errJson?.error || '';
        } catch {
          // Ignore JSON parse failures on non-JSON error payloads
        }
        return {
          ok: false,
          statusCode: response.status,
          errorCode: 'SERVER_ERROR',
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
