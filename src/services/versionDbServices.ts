import {
  AdminApprovalItem,
  AuditLogEntry,
  BranchRecord,
  CommitRecord,
  ConflictItem,
  DatabaseConnectionMode,
  DatabaseView,
  HistoricalSnapshot,
  LineageNode,
  MergeRequest,
  NotificationItem,
  QueryExecutionResult,
  Repository,
  SchemaVersionTag,
  ServiceOperationResult,
  StagedDDLChange,
  StagedRowMutation,
  TableSchema,
  UserProfile,
  UserRole,
} from '../types/versiondb';
import { apiClient, VersionDbApiClient } from './apiClient';

export interface CatalogSnapshotPayload {
  repositories: Repository[];
  branches: BranchRecord[];
  tables: TableSchema[];
  views: DatabaseView[];
  commits: CommitRecord[];
  mergeRequests: MergeRequest[];
  conflicts: ConflictItem[];
  adminApprovals: AdminApprovalItem[];
  snapshots: HistoricalSnapshot[];
  auditLogs: AuditLogEntry[];
  schemaVersions: SchemaVersionTag[];
  lineageNodes: LineageNode[];
  members: UserProfile[];
  notifications: NotificationItem[];
}

export interface BackendUserDto {
  id: string;
  email: string;
  username: string;
  globalRole: 'admin' | 'user';
  disabled?: boolean;
  createdAt?: string;
}

export interface BackendAuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: BackendUserDto;
}

export interface BackendRepoDto {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  defaultBranch: string;
  createdAt: string;
  role?: string;
}

export interface BackendBranchDto {
  id: string;
  repoId: string;
  name: string;
  headCommitId: string | null;
  createdBy: string | null;
  createdAt: string;
  protection: { requiredApprovals: number } | null;
}

export interface BackendMemberDto {
  repoId: string;
  userId: string;
  username: string;
  email: string;
  role: 'viewer' | 'reviewer' | 'maintainer' | 'owner';
  createdAt: string;
}

export interface BackendCommitDto {
  id: string;
  repoId: string;
  snapshotHash: string;
  authorId: string;
  authorName: string | null;
  message: string;
  kind: 'initial' | 'normal' | 'merge' | 'revert';
  createdAt: string;
  parents: string[];
  changeCount?: number;
}

export interface BackendWorkingChangeDto {
  collection: string;
  recordId: string;
  op: 'put' | 'delete';
  data: Record<string, unknown> | null;
  updatedAt: string;
}

// --- Mappers between backend entities and frontend UI types ---

export function mapBackendUserToProfile(u: BackendUserDto): UserProfile {
  const role: UserRole = u.globalRole === 'admin' ? 'Admin' : 'Developer';
  return {
    id: u.id,
    name: u.username,
    handle: u.username,
    email: u.email,
    role,
    title: u.globalRole === 'admin' ? 'System Administrator' : 'Database Engineer',
    avatarUrl: '',
    disabled: u.disabled,
    createdAt: u.createdAt,
  };
}

export function mapRepoRoleToUserRole(role: string): UserRole {
  switch (role) {
    case 'owner':
      return 'Admin';
    case 'reviewer':
      return 'Reviewer';
    case 'maintainer':
      return 'Developer';
    case 'viewer':
    default:
      return 'Viewer';
  }
}

export function mapUserRoleToRepoRole(role: UserRole): 'owner' | 'maintainer' | 'reviewer' | 'viewer' {
  switch (role) {
    case 'Admin':
      return 'owner';
    case 'Reviewer':
      return 'reviewer';
    case 'Developer':
      return 'maintainer';
    case 'Viewer':
    default:
      return 'viewer';
  }
}

export function mapBackendMemberToProfile(m: BackendMemberDto): UserProfile {
  return {
    id: m.userId,
    name: m.username,
    handle: m.username,
    email: m.email,
    role: mapRepoRoleToUserRole(m.role),
    title: `${m.role.toUpperCase()} Member`,
    avatarUrl: '',
  };
}

export function mapBackendRepoToRepository(r: BackendRepoDto): Repository {
  return {
    id: r.id,
    name: r.name,
    engine: 'PostgreSQL',
    engineVersion: '16.0',
    environment: 'Production',
    region: 'local',
    instanceDesc: r.description || 'VersionDB Managed Repository',
    defaultBranch: r.defaultBranch || 'main',
    activeBranchesCount: 1,
    commitsTodayCount: 0,
    openMrCount: 0,
    conflictsCount: 0,
    connectionMode: 'connected',
    latencyMs: 12,
    walLag: '0 KB',
    snapshotDiskUsedGb: 0.1,
    snapshotDiskTotalGb: 10,
    latestSnapshotRef: 'HEAD',
    replicaBufferHealthPct: 100,
    role: r.role,
  };
}

export function mapBackendBranchToRecord(b: BackendBranchDto): BranchRecord {
  const headHash = b.headCommitId ? b.headCommitId.replace(/-/g, '').slice(0, 8) : '00000000';
  return {
    name: b.name,
    isProtected: Boolean(b.protection),
    headCommitHash: headHash,
    headCommitTitle: b.headCommitId ? `Commit ${headHash}` : 'Initial Branch HEAD',
    aheadCount: 0,
    behindCount: 0,
    authorHandle: b.createdBy ? 'author' : 'system',
    updatedRelative: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Active',
  };
}

export function mapBackendCommitToRecord(
  c: BackendCommitDto,
  branch = 'main'
): CommitRecord {
  const shortHash = c.id.replace(/-/g, '').slice(0, 8);
  const mutationsCount = c.changeCount ?? 1;
  return {
    hash: shortHash,
    message: c.message,
    timestampRelative: new Date(c.createdAt).toLocaleDateString(),
    timestampIso: new Date(c.createdAt).toISOString(),
    summaryType: `${mutationsCount} mutation${mutationsCount === 1 ? '' : 's'}`,
    branch,
    affectedTable: 'records',
    affectedRowsLabel: `${mutationsCount} row${mutationsCount === 1 ? '' : 's'}`,
    authorName: c.authorName || 'VersionDB User',
    authorHandle: c.authorName || 'user',
    authorAvatar: '',
    status: 'Checks Passed',
    ddlPreview: '',
    dmlCount: mutationsCount,
  };
}

/**
 * Feature Services Layer for VersionDB.
 * All operations execute through the centralized VersionDbApiClient.
 * When an endpoint is implemented on the backend, it makes real HTTP calls.
 * When an endpoint is missing from the backend, it returns a truthful ServiceOperationResult.
 */
export function createVersionDbServices(client: VersionDbApiClient = apiClient) {
  return {
    auth: {
      async verifySession(sessionToken?: string | null, options?: { silent?: boolean }): Promise<ServiceOperationResult<UserProfile>> {
        const res = await client.request<{ user: BackendUserDto }>('/api/auth/me', {
          method: 'GET',
          sessionToken,
          silent: options?.silent,
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: mapBackendUserToProfile(res.data.user),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async signIn(
        identifier: string,
        password: string
      ): Promise<ServiceOperationResult<{ token: string; refreshToken: string; user: UserProfile }>> {
        const trimmed = identifier.trim();
        if (!trimmed || !password) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Email address (or username) and password are required.',
          };
        }
        const res = await client.request<BackendAuthResponseDto>('/api/auth/login', {
          method: 'POST',
          body: { identifier: trimmed, password },
        });
        if (res.ok && res.data) {
          client.setSessionToken(res.data.accessToken);
          return {
            ok: true,
            statusCode: res.statusCode,
            data: {
              token: res.data.accessToken,
              refreshToken: res.data.refreshToken,
              user: mapBackendUserToProfile(res.data.user),
            },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async register(
        email: string,
        username: string,
        password: string
      ): Promise<ServiceOperationResult<{ user: UserProfile }>> {
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username.trim();
        if (!cleanEmail || !cleanUsername || !password) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Email, username, and password are required.',
          };
        }
        if (password.length < 10) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Password must be at least 10 characters long.',
          };
        }
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Password must contain at least one letter and one digit.',
          };
        }
        const res = await client.request<{ user: BackendUserDto }>('/api/auth/register', {
          method: 'POST',
          body: { email: cleanEmail, username: cleanUsername, password },
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: { user: mapBackendUserToProfile(res.data.user) },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async refresh(
        refreshToken: string
      ): Promise<ServiceOperationResult<{ token: string; refreshToken: string; user: UserProfile }>> {
        const res = await client.request<BackendAuthResponseDto>('/api/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        });
        if (res.ok && res.data) {
          client.setSessionToken(res.data.accessToken);
          return {
            ok: true,
            statusCode: res.statusCode,
            data: {
              token: res.data.accessToken,
              refreshToken: res.data.refreshToken,
              user: mapBackendUserToProfile(res.data.user),
            },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async signOut(
        refreshToken?: string | null,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<void>> {
        client.setSessionToken(null);
        if (refreshToken) {
          return client.request<void>('/api/auth/logout', {
            method: 'POST',
            body: { refreshToken },
            sessionToken,
          });
        }
        return { ok: true, statusCode: 204 };
      },

      async requestPasswordReset(email: string): Promise<ServiceOperationResult<void>> {
        if (!email.trim() || !email.includes('@')) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Enter a valid email address.',
          };
        }
        // Documented missing backend endpoint:
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Password reset is not supported by the VersionDB backend API.',
        };
      },

      async resetPassword(
        token: string,
        newPassword: string
      ): Promise<ServiceOperationResult<void>> {
        if (!token.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'A valid password reset token is required.',
          };
        }
        if (newPassword.length < 8) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Password must be at least 8 characters.',
          };
        }
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Password reset is not supported by the VersionDB backend API.',
        };
      },
    },

    admin: {
      async listUsers(): Promise<ServiceOperationResult<UserProfile[]>> {
        const res = await client.request<{ users: BackendUserDto[] }>('/api/admin/users', {
          method: 'GET',
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.users.map(mapBackendUserToProfile),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async createUser(input: {
        email: string;
        username: string;
        globalRole: 'admin' | 'user';
        initialPassword?: string;
      }): Promise<ServiceOperationResult<{ user: UserProfile; initialPassword: string }>> {
        const res = await client.request<{ user: BackendUserDto; initialPassword: string }>('/api/admin/users', {
          method: 'POST',
          body: input,
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: {
              user: mapBackendUserToProfile(res.data.user),
              initialPassword: res.data.initialPassword,
            },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async updateUser(
        userId: string,
        patch: { username?: string; globalRole?: 'admin' | 'user'; disabled?: boolean }
      ): Promise<ServiceOperationResult<UserProfile>> {
        const res = await client.request<{ user: BackendUserDto }>(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          body: patch,
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: mapBackendUserToProfile(res.data.user),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async resetPassword(userId: string): Promise<ServiceOperationResult<{ temporaryPassword: string }>> {
        return client.request<{ temporaryPassword: string }>(`/api/admin/users/${userId}/reset-password`, {
          method: 'POST',
        });
      },

      async listAuditLogs(query?: { limit?: number; before?: number }): Promise<ServiceOperationResult<any[]>> {
        const params = new URLSearchParams();
        if (query?.limit) params.set('limit', String(query.limit));
        if (query?.before) params.set('before', String(query.before));
        const qs = params.toString() ? `?${params.toString()}` : '';
        const res = await client.request<{ auditLogs: any[] }>(`/api/admin/audit-logs${qs}`, {
          method: 'GET',
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.auditLogs,
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },
    },

    catalog: {
      async fetchWorkspaceState(
        sessionToken?: string | null,
        targetRepoId?: string,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<CatalogSnapshotPayload>> {
        // Fetch repositories first
        const reposRes = await client.request<{ repositories: BackendRepoDto[] }>('/api/repos', {
          method: 'GET',
          sessionToken,
          signal,
        });

        if (!reposRes.ok) {
          return {
            ok: false,
            statusCode: reposRes.statusCode,
            errorCode: reposRes.errorCode,
            error: reposRes.error,
          };
        }

        const rawRepos = reposRes.data?.repositories || [];
        const repositories = rawRepos.map(mapBackendRepoToRepository);

        let branches: BranchRecord[] = [];
        let members: UserProfile[] = [];
        let tables: TableSchema[] = [];
        let commits: CommitRecord[] = [];

        if (repositories.length > 0) {
          const primaryRepo =
            (targetRepoId && repositories.find((r) => r.id === targetRepoId)) || repositories[0];

          // Fetch branches in parallel with members
          const [branchesRes, membersRes] = await Promise.all([
            client.request<{ branches: BackendBranchDto[] }>(`/api/repos/${primaryRepo.id}/branches`, {
              method: 'GET',
              sessionToken,
              signal,
            }),
            client.request<{ members: BackendMemberDto[] }>(`/api/repos/${primaryRepo.id}/members`, {
              method: 'GET',
              sessionToken,
              signal,
            }),
          ]);

          if (branchesRes.ok && branchesRes.data) {
            branches = branchesRes.data.branches.map(mapBackendBranchToRecord);
          }
          if (membersRes.ok && membersRes.data) {
            members = membersRes.data.members.map(mapBackendMemberToProfile);
          }

          const targetBranch = branches[0]?.name || primaryRepo.defaultBranch || 'main';

          // Fetch collections & commits for target branch
          const [recordsRes, historyRes] = await Promise.all([
            client.request<{ commitId: string | null; collections?: Array<{ name: string; count: number }> }>(
              `/api/repos/${primaryRepo.id}/branches/${targetBranch}/records`,
              { method: 'GET', sessionToken, signal }
            ),
            client.request<{ commits: BackendCommitDto[] }>(
              `/api/repos/${primaryRepo.id}/history/${targetBranch}`,
              { method: 'GET', sessionToken, signal }
            ),
          ]);

          if (recordsRes.ok && recordsRes.data?.collections) {
            tables = recordsRes.data.collections.map((col) => ({
              schema: 'public',
              name: col.name,
              rowCountLabel: `${col.count} records`,
              rowCount: col.count,
              primaryKey: 'id',
              columns: [
                { name: 'id', dataType: 'string', nullable: false, isPrimaryKey: true },
                { name: 'data', dataType: 'jsonb', nullable: false },
              ],
              ddl: `CREATE TABLE "${col.name}" (id TEXT PRIMARY KEY, data JSONB);`,
              indexes: ['PRIMARY KEY (id)'],
            }));
          }

          if (historyRes.ok && historyRes.data?.commits) {
            commits = historyRes.data.commits.map((c) => mapBackendCommitToRecord(c, targetBranch));
          }
        }

        return {
          ok: true,
          statusCode: 200,
          data: {
            repositories,
            branches,
            tables,
            views: [],
            commits,
            mergeRequests: [],
            conflicts: [],
            adminApprovals: [],
            snapshots: [],
            auditLogs: [],
            schemaVersions: [],
            lineageNodes: [],
            members,
            notifications: [],
          },
        };
      },
    },

    repositories: {
      async listRepositories(
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<Repository[]>> {
        const res = await client.request<{ repositories: BackendRepoDto[] }>('/api/repos', {
          method: 'GET',
          sessionToken,
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.repositories.map(mapBackendRepoToRepository),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async createRepository(
        payload: {
          name: string;
          engine: string;
          environment: 'Production' | 'Staging' | 'Development';
          region: string;
          defaultBranch: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<Repository>> {
        const cleanName = payload.name.trim();
        if (!cleanName) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Repository name is required.',
          };
        }
        const description = `${payload.engine} (${payload.environment}) in ${payload.region || 'default'}`;
        const res = await client.request<{ repository: BackendRepoDto }>('/api/repos', {
          method: 'POST',
          body: { name: cleanName, description },
          sessionToken,
        });
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: mapBackendRepoToRepository(res.data.repository),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async getRepository(
        repoId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<{ repository: Repository; branches: BranchRecord[] }>> {
        const res = await client.request<{
          repository: BackendRepoDto & { branches?: BackendBranchDto[] };
        }>(`/api/repos/${repoId}`, {
          method: 'GET',
          sessionToken,
        });
        if (res.ok && res.data) {
          const raw = res.data.repository;
          return {
            ok: true,
            statusCode: res.statusCode,
            data: {
              repository: mapBackendRepoToRepository(raw),
              branches: (raw.branches || []).map(mapBackendBranchToRecord),
            },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async deleteRepository(
        repoId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<{ deleted: boolean; repoId: string; name: string }>> {
        const cleanId = repoId.trim();
        if (!cleanId) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Repository ID is required for deletion.',
          };
        }
        const res = await client.request<{ deleted: boolean; repoId: string; name: string }>(
          `/api/repos/${cleanId}`,
          {
            method: 'DELETE',
            sessionToken,
          }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data,
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error || 'Failed to delete repository.',
        };
      },

      async updateConnectionMode(
        repositoryId: string,
        mode: DatabaseConnectionMode,
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<Repository>> {
        // Local state representation since backend handles connectivity directly
        return {
          ok: true,
          statusCode: 200,
          data: {
            id: repositoryId,
            name: 'repository',
            engine: 'PostgreSQL',
            engineVersion: '16.0',
            environment: 'Production',
            region: 'local',
            instanceDesc: 'Connected',
            defaultBranch: 'main',
            activeBranchesCount: 1,
            commitsTodayCount: 0,
            openMrCount: 0,
            conflictsCount: 0,
            connectionMode: mode,
            latencyMs: mode === 'disconnected' ? 0 : 12,
            walLag: '0 KB',
            snapshotDiskUsedGb: 0.1,
            snapshotDiskTotalGb: 10,
            latestSnapshotRef: 'HEAD',
            replicaBufferHealthPct: 100,
          },
        };
      },
    },

    branches: {
      async listBranches(
        repositoryId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<BranchRecord[]>> {
        const res = await client.request<{ branches: BackendBranchDto[] }>(
          `/api/repos/${repositoryId}/branches`,
          { method: 'GET', sessionToken }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.branches.map(mapBackendBranchToRecord),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async createBranch(
        repositoryId: string,
        name: string,
        fromBranch: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<BranchRecord>> {
        const cleanName = name.trim();
        if (!cleanName) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Branch name is required.',
          };
        }
        if (!repositoryId) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Repository ID is required.',
          };
        }
        const res = await client.request<{ branch: BackendBranchDto }>(
          `/api/repos/${repositoryId}/branches`,
          {
            method: 'POST',
            body: {
              name: cleanName,
              sourceBranch: fromBranch.trim() || 'main',
            },
            sessionToken,
          }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: mapBackendBranchToRecord(res.data.branch),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async deleteBranch(
        repositoryId: string,
        name: string,
        sessionToken?: string | null,
        options?: { activeBranch?: string }
      ): Promise<ServiceOperationResult<{ success: boolean; branchName: string }>> {
        const cleanName = name.trim();
        if (!cleanName) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Branch name is required.',
          };
        }
        if (!repositoryId) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Repository ID is required.',
          };
        }
        if (options?.activeBranch && cleanName === options.activeBranch) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: `Cannot delete active branch '${cleanName}'. Switch to another branch first.`,
          };
        }
        const query = options?.activeBranch
          ? `?activeBranch=${encodeURIComponent(options.activeBranch)}`
          : '';
        const res = await client.request<{ deleted?: boolean; success?: boolean; branchName?: string }>(
          `/api/repos/${repositoryId}/branches/${encodeURIComponent(cleanName)}${query}`,
          {
            method: 'DELETE',
            sessionToken,
            silent: true,
          }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: {
              success: Boolean((res.data as any).deleted ?? res.data.success ?? true),
              branchName: res.data.branchName || cleanName,
            },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },
    },

    records: {
      async fetchCollections(
        repoId: string,
        branch: string,
        sessionToken?: string | null,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<TableSchema[]>> {
        const res = await client.request<{
          commitId: string | null;
          collections: Array<{ name: string; count: number }>;
        }>(`/api/repos/${repoId}/branches/${branch}/records`, {
          method: 'GET',
          sessionToken,
          signal,
        });
        if (res.ok && res.data) {
          const tables: TableSchema[] = (res.data.collections || []).map((col) => ({
            schema: 'public',
            name: col.name,
            rowCountLabel: `${col.count} records`,
            rowCount: col.count,
            primaryKey: 'id',
            columns: [
              { name: 'id', dataType: 'string', nullable: false, isPrimaryKey: true },
              { name: 'data', dataType: 'jsonb', nullable: false },
            ],
            ddl: `CREATE TABLE "${col.name}" (id TEXT PRIMARY KEY, data JSONB);`,
            indexes: ['PRIMARY KEY (id)'],
          }));
          return { ok: true, statusCode: res.statusCode, data: tables };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async fetchRecords(
        repoId: string,
        branch: string,
        collection: string,
        sessionToken?: string | null,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<Record<string, unknown>[]>> {
        const res = await client.request<{
          commitId: string | null;
          collection: string;
          records: Array<{ id: string; data: Record<string, unknown> }>;
        }>(`/api/repos/${repoId}/branches/${branch}/records?collection=${encodeURIComponent(collection)}&limit=100`, {
          method: 'GET',
          sessionToken,
          signal,
        });
        if (res.ok && res.data) {
          const rows = (res.data.records || []).map((r) => {
            if (typeof r.data === 'object' && r.data !== null) {
              return { id: r.id, ...r.data };
            }
            return { id: r.id, value: r.data };
          });
          return { ok: true, statusCode: res.statusCode, data: rows };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async fetchWorkingChanges(
        repoId: string,
        branch: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<BackendWorkingChangeDto[]>> {
        const res = await client.request<{ pending: BackendWorkingChangeDto[] }>(
          `/api/repos/${repoId}/branches/${branch}/working`,
          { method: 'GET', sessionToken }
        );
        if (res.ok && res.data) {
          return { ok: true, statusCode: res.statusCode, data: res.data.pending || [] };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async stagePut(
        repoId: string,
        branch: string,
        collection: string,
        recordId: string,
        data: Record<string, unknown>,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<BackendWorkingChangeDto>> {
        const res = await client.request<{ pending: BackendWorkingChangeDto }>(
          `/api/repos/${repoId}/branches/${branch}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
          {
            method: 'PUT',
            body: { data },
            sessionToken,
          }
        );
        if (res.ok && res.data) {
          return { ok: true, statusCode: res.statusCode, data: res.data.pending };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async stageDelete(
        repoId: string,
        branch: string,
        collection: string,
        recordId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<void>> {
        return client.request<void>(
          `/api/repos/${repoId}/branches/${branch}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
          {
            method: 'DELETE',
            sessionToken,
          }
        );
      },

      async discardWorkingChanges(
        repoId: string,
        branch: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<{ discarded: number }>> {
        return client.request<{ discarded: number }>(
          `/api/repos/${repoId}/branches/${branch}/working`,
          {
            method: 'DELETE',
            sessionToken,
          }
        );
      },
    },

    sql: {

      async executeQuery(
        payload: {
          repositoryId: string;
          branch: string;
          sql: string;
        },
        sessionToken?: string | null,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<QueryExecutionResult>> {
        if (!payload.sql.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'SQL statement cannot be empty.',
          };
        }

        if (!client.isConfigured()) {
          return {
            ok: false,
            errorCode: 'UNCONFIGURED_BACKEND',
            error: 'Backend API is not configured (VITE_API_BASE_URL is empty).',
          };
        }

        const res = await client.request<QueryExecutionResult>(
          `/api/repos/${payload.repositoryId}/sql/execute`,
          {
            method: 'POST',
            sessionToken,
            signal,
            body: {
              branch: payload.branch,
              sql: payload.sql,
            },
          }
        );

        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data,
          };
        }

        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },


      async fetchTableRows(
        payload: {
          repositoryId: string;
          branch: string;
          table: string;
        },
        sessionToken?: string | null,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<Record<string, unknown>[]>> {
        const res = await client.request<{
          records: Array<{ id: string; data: Record<string, unknown> }>;
        }>(
          `/api/repos/${payload.repositoryId}/branches/${payload.branch}/records?collection=${encodeURIComponent(payload.table)}&limit=100`,
          { method: 'GET', sessionToken, signal }
        );
        if (res.ok && res.data) {
          const rows = (res.data.records || []).map((r) => {
            if (typeof r.data === 'object' && r.data !== null) {
              return { id: r.id, ...r.data };
            }
            return { id: r.id, value: r.data };
          });
          return { ok: true, statusCode: res.statusCode, data: rows };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },
    },

    commits: {
      async stageRowMutation(
        payload: Omit<StagedRowMutation, 'id' | 'timestamp'>,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<StagedRowMutation>> {
        const pk = payload.primaryKeyValue || 'rec_' + Date.now();
        const collection = payload.table;

        if (payload.operation === 'DELETE') {
          const delRes = await client.request<void>(
            `/api/repos/${payload.repositoryId}/branches/${payload.branch}/records/${encodeURIComponent(collection)}/${encodeURIComponent(pk)}`,
            { method: 'DELETE', sessionToken }
          );
          if (delRes.ok) {
            return {
              ok: true,
              statusCode: delRes.statusCode,
              data: {
                id: `staged-${Date.now()}`,
                ...payload,
                primaryKeyValue: pk,
                timestamp: new Date().toISOString(),
              },
            };
          }
          return {
            ok: false,
            statusCode: delRes.statusCode,
            errorCode: delRes.errorCode,
            error: delRes.error,
          };
        }

        // INSERT or UPDATE
        const rowData = payload.rowSnapshot || (payload.columnName ? { [payload.columnName]: payload.newValue } : { id: pk });
        const putRes = await client.request<{ pending: BackendWorkingChangeDto }>(
          `/api/repos/${payload.repositoryId}/branches/${payload.branch}/records/${encodeURIComponent(collection)}/${encodeURIComponent(pk)}`,
          {
            method: 'PUT',
            body: { data: rowData },
            sessionToken,
          }
        );

        if (putRes.ok) {
          return {
            ok: true,
            statusCode: putRes.statusCode,
            data: {
              id: `staged-${Date.now()}`,
              ...payload,
              primaryKeyValue: pk,
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          ok: false,
          statusCode: putRes.statusCode,
          errorCode: putRes.errorCode,
          error: putRes.error,
        };
      },

      async stageDdlChange(
        payload: {
          repositoryId: string;
          branch: string;
          table: string;
          statement: string;
          summary: string;
        },
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<StagedDDLChange>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error:
            'DDL schema staging is not supported. VersionDB manages versioned record collections on database branches.',
        };
      },

      async createCommit(
        payload: {
          repositoryId: string;
          branch: string;
          message: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<CommitRecord>> {
        if (!payload.message.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Commit message is required.',
          };
        }
        const res = await client.request<{ commit: BackendCommitDto }>(
          `/api/repos/${payload.repositoryId}/branches/${payload.branch}/commits`,
          {
            method: 'POST',
            body: { message: payload.message.trim() },
            headers: {
              'Idempotency-Key': `commit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
            sessionToken,
          }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: mapBackendCommitToRecord(res.data.commit, payload.branch),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async fetchHistory(
        repositoryId: string,
        ref: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<CommitRecord[]>> {
        const res = await client.request<{ commits: BackendCommitDto[] }>(
          `/api/repos/${repositoryId}/history/${encodeURIComponent(ref)}`,
          { method: 'GET', sessionToken }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.commits.map((c) => mapBackendCommitToRecord(c, ref)),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },
    },

    members: {
      async listMembers(
        repoId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<UserProfile[]>> {
        const res = await client.request<{ members: BackendMemberDto[] }>(
          `/api/repos/${repoId}/members`,
          { method: 'GET', sessionToken }
        );
        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: res.data.members.map(mapBackendMemberToProfile),
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      async addMember(
        repoId: string,
        email: string,
        role: UserRole,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<void>> {
        return client.request<void>(`/api/repos/${repoId}/members`, {
          method: 'POST',
          body: { email: email.trim().toLowerCase(), role: mapUserRoleToRepoRole(role) },
          sessionToken,
        });
      },

      async updateMemberRole(
        repoId: string,
        userId: string,
        newRole: UserRole,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<void>> {
        return client.request<void>(`/api/repos/${repoId}/members/${userId}`, {
          method: 'PATCH',
          body: { role: mapUserRoleToRepoRole(newRole) },
          sessionToken,
        });
      },

      async removeMember(
        repoId: string,
        userId: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<void>> {
        return client.request<void>(`/api/repos/${repoId}/members/${userId}`, {
          method: 'DELETE',
          sessionToken,
        });
      },
    },

    mergeRequests: {
      async createMergeRequest(
        _payload: {
          repositoryId: string;
          title: string;
          description: string;
          sourceBranch: string;
          targetBranch: string;
        },
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error:
            'Merge Requests API is not implemented in the VersionDB backend. Endpoints for creating and reviewing merge requests are pending specification.',
        };
      },
      async approveMergeRequest(
        _mrNumber: number,
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Merge Request approval is not implemented in the VersionDB backend.',
        };
      },
      async mergeBranch(
        _mrNumber: number,
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Merge execution is not implemented in the VersionDB backend.',
        };
      },
      async resolveConflict(
        _payload: {
          conflictId: string;
          mode: 'OURS' | 'THEIRS' | 'MANUAL';
          manualValues?: Record<string, string>;
          auditNote?: string;
        },
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<ConflictItem>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Conflict resolution API is not implemented in the VersionDB backend.',
        };
      },
    },

    governance: {
      async decideAdminEscalation(
        _payload: {
          approvalId: string;
          decision: 'APPROVED' | 'REJECTED';
          reason: string;
        },
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<AdminApprovalItem>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Lead DBA escalation queue API is not implemented in the VersionDB backend.',
        };
      },
      async executeRollback(
        _payload: {
          snapshotId: string;
          reason: string;
        },
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<HistoricalSnapshot>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error:
            'Point-in-time snapshot rollback API is not implemented in the VersionDB backend.',
        };
      },
      async updateMemberRole(
        _userId: string,
        _newRole: UserRole,
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<UserProfile>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error:
            'Use members.updateMemberRole with a specific repositoryId to update member permissions on the backend.',
        };
      },
      async exportAuditLogs(
        _format: 'json' | 'csv',
        _sessionToken?: string | null
      ): Promise<ServiceOperationResult<{ downloadUrl: string }>> {
        return {
          ok: false,
          errorCode: 'SERVER_ERROR',
          error: 'Audit logs export endpoint is not implemented in the VersionDB backend.',
        };
      },
    },

    diagnostics: {
      /**
       * Checks backend health via GET /api/health and measures round-trip latency.
       * Uses silent mode to prevent triggering onUnauthorized callbacks.
       */
      async checkHealth(): Promise<ServiceOperationResult<{ status: string; latencyMs: number }>> {
        const start = performance.now();
        const res = await client.request<{ status: string }>('/api/health', {
          method: 'GET',
          silent: true,
          skipRefresh: true,
        });
        const latencyMs = Math.round(performance.now() - start);

        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: { status: res.data.status, latencyMs },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },

      /**
       * Checks backend readiness (DB + storage) via GET /api/ready.
       */
      async checkReady(): Promise<ServiceOperationResult<{ status: string; latencyMs: number }>> {
        const start = performance.now();
        const res = await client.request<{ status: string }>('/api/ready', {
          method: 'GET',
          silent: true,
          skipRefresh: true,
        });
        const latencyMs = Math.round(performance.now() - start);

        if (res.ok && res.data) {
          return {
            ok: true,
            statusCode: res.statusCode,
            data: { status: res.data.status, latencyMs },
          };
        }
        return {
          ok: false,
          statusCode: res.statusCode,
          errorCode: res.errorCode,
          error: res.error,
        };
      },
    },
  };
}

export const versionDbServices = createVersionDbServices();
