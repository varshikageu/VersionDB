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

/**
 * Feature Services Layer for VersionDB.
 * All operations execute through the centralized VersionDbApiClient.
 * When the backend is not configured or an endpoint contract is pending specification,
 * methods return a truthful ServiceOperationResult failure and NEVER fabricate records.
 */
export function createVersionDbServices(client: VersionDbApiClient = apiClient) {
  return {
    auth: {
      async verifySession(sessionToken: string): Promise<ServiceOperationResult<UserProfile>> {
        return client.request<UserProfile>('PENDING_SPEC:AuthSessionVerify', {
          method: 'GET',
          sessionToken,
        });
      },
      async signIn(
        email: string,
        password: string
      ): Promise<ServiceOperationResult<{ token: string; user: UserProfile }>> {
        if (!email.trim() || !password) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Email address and password are required.',
          };
        }
        return client.request<{ token: string; user: UserProfile }>('PENDING_SPEC:AuthSignIn', {
          method: 'POST',
          body: { email: email.trim(), password },
        });
      },
      async signOut(sessionToken?: string | null): Promise<ServiceOperationResult<void>> {
        return client.request<void>('PENDING_SPEC:AuthSignOut', {
          method: 'POST',
          sessionToken,
        });
      },
      async requestPasswordReset(email: string): Promise<ServiceOperationResult<void>> {
        if (!email.trim() || !email.includes('@')) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Enter a valid email address.',
          };
        }
        return client.request<void>('PENDING_SPEC:AuthForgotPassword', {
          method: 'POST',
          body: { email: email.trim() },
        });
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
        return client.request<void>('PENDING_SPEC:AuthResetPassword', {
          method: 'POST',
          body: { token, newPassword },
        });
      },
    },

    catalog: {
      async fetchWorkspaceState(
        sessionToken?: string | null,
        signal?: AbortSignal
      ): Promise<ServiceOperationResult<CatalogSnapshotPayload>> {
        return client.request<CatalogSnapshotPayload>('PENDING_SPEC:WorkspaceCatalogBootstrap', {
          method: 'GET',
          sessionToken,
          signal,
        });
      },
    },

    repositories: {
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
        if (!payload.name.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Repository name is required.',
          };
        }
        return client.request<Repository>('PENDING_SPEC:CreateRepository', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
      async updateConnectionMode(
        repositoryId: string,
        mode: DatabaseConnectionMode,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<Repository>> {
        return client.request<Repository>('PENDING_SPEC:UpdateRepositoryConnectionMode', {
          method: 'PATCH',
          body: { repositoryId, mode },
          sessionToken,
        });
      },
    },

    branches: {
      async createBranch(
        repositoryId: string,
        name: string,
        fromBranch: string,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<BranchRecord>> {
        if (!name.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Branch name is required.',
          };
        }
        return client.request<BranchRecord>('PENDING_SPEC:CreateBranch', {
          method: 'POST',
          body: { repositoryId, name: name.trim(), fromBranch },
          sessionToken,
        });
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
        return client.request<QueryExecutionResult>('PENDING_SPEC:ExecuteSqlQuery', {
          method: 'POST',
          body: payload,
          sessionToken,
          signal,
        });
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
        return client.request<Record<string, unknown>[]>('PENDING_SPEC:FetchTableRows', {
          method: 'GET',
          sessionToken,
          signal,
        });
      },
    },

    commits: {
      async stageRowMutation(
        payload: Omit<StagedRowMutation, 'id' | 'timestamp'>,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<StagedRowMutation>> {
        return client.request<StagedRowMutation>('PENDING_SPEC:StageRowMutation', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
      async stageDdlChange(
        payload: {
          repositoryId: string;
          branch: string;
          table: string;
          statement: string;
          summary: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<StagedDDLChange>> {
        return client.request<StagedDDLChange>('PENDING_SPEC:StageDdlChange', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
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
        return client.request<CommitRecord>('PENDING_SPEC:CreateCommit', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
    },

    mergeRequests: {
      async createMergeRequest(
        payload: {
          repositoryId: string;
          title: string;
          description: string;
          sourceBranch: string;
          targetBranch: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        if (!payload.title.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Merge Request title is required.',
          };
        }
        return client.request<MergeRequest>('PENDING_SPEC:CreateMergeRequest', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
      async approveMergeRequest(
        mrNumber: number,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        return client.request<MergeRequest>('PENDING_SPEC:ApproveMergeRequest', {
          method: 'POST',
          body: { mrNumber },
          sessionToken,
        });
      },
      async mergeBranch(
        mrNumber: number,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<MergeRequest>> {
        return client.request<MergeRequest>('PENDING_SPEC:ExecuteMergeRequest', {
          method: 'POST',
          body: { mrNumber },
          sessionToken,
        });
      },
      async resolveConflict(
        payload: {
          conflictId: string;
          mode: 'OURS' | 'THEIRS' | 'MANUAL';
          manualValues?: Record<string, string>;
          auditNote?: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<ConflictItem>> {
        return client.request<ConflictItem>('PENDING_SPEC:ResolveConflict', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
    },

    governance: {
      async decideAdminEscalation(
        payload: {
          approvalId: string;
          decision: 'APPROVED' | 'REJECTED';
          reason: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<AdminApprovalItem>> {
        if (!payload.reason.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'An audit reason is required for Lead DBA escalation decisions.',
          };
        }
        return client.request<AdminApprovalItem>('PENDING_SPEC:AdminEscalationDecision', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
      async executeRollback(
        payload: {
          snapshotId: string;
          reason: string;
        },
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<HistoricalSnapshot>> {
        if (!payload.reason.trim()) {
          return {
            ok: false,
            errorCode: 'VALIDATION_ERROR',
            error: 'Rollback justification is required.',
          };
        }
        return client.request<HistoricalSnapshot>('PENDING_SPEC:ExecuteHistoricalRollback', {
          method: 'POST',
          body: payload,
          sessionToken,
        });
      },
      async updateMemberRole(
        userId: string,
        newRole: UserRole,
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<UserProfile>> {
        return client.request<UserProfile>('PENDING_SPEC:UpdateMemberRole', {
          method: 'PATCH',
          body: { userId, newRole },
          sessionToken,
        });
      },
      async exportAuditLogs(
        format: 'json' | 'csv',
        sessionToken?: string | null
      ): Promise<ServiceOperationResult<{ downloadUrl: string }>> {
        return client.request<{ downloadUrl: string }>('PENDING_SPEC:ExportAuditLogs', {
          method: 'POST',
          body: { format },
          sessionToken,
        });
      },
    },
  };
}

export const versionDbServices = createVersionDbServices();
