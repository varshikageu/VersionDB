import { ApiEndpointContract, UserRole } from '../types/versiondb';

/**
 * Static application branding & UI configuration.
 * Contains NO operational database records, fake users, or fabricated metrics.
 */
export const VERSIONDB_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1UT5CNhkFLNfvBLfI2N5mJUgThkK5wFxLvzyMPe5dFe07H-66W2h0d6bStKAqLM8Koh7wHf2wW4iQZcdU-nEgyE23w522-hoAUAAV85uWy6G4h03kg_xfrOAruwfU1x8JiNt72AKzyxb0UsL5Eqq8yTacT9tew4qw_OkPEo6ZA7hs70927x7NP_G6iGF9WLYUzXex7PWKAOKp-7j6MyLMT0tjWmpNHHgoRJF-eWUAO6LIDJrSGJQTVXdVw';

export interface EnvironmentConfig {
  apiBaseUrl: string;
  requestTimeoutMs: number;
  isBackendConfigured: boolean;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const envObj = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const rawUrl = (envObj?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return {
    apiBaseUrl: rawUrl,
    requestTimeoutMs: 10000,
    isBackendConfigured: rawUrl.length > 0,
  };
}

/**
 * Client-side UI visibility matrix for role-aware layout rendering.
 * IMPORTANT: This is NOT a security boundary. All authentication and RBAC
 * authorization must be enforced by the backend server.
 */
export const ROLE_UI_CAPABILITIES: Record<
  UserRole,
  {
    canExecuteSelect: boolean;
    canEditRecordsAndStage: boolean;
    canCreateCommit: boolean;
    canCreateBranch: boolean;
    canCreateMergeRequest: boolean;
    canReviewAndApproveMr: boolean;
    canResolveConflicts: boolean;
    canAdminApproveEscalation: boolean;
    canMergeProtectedMain: boolean;
    canExecuteRollback: boolean;
    canManageMembers: boolean;
  }
> = {
  Viewer: {
    canExecuteSelect: true,
    canEditRecordsAndStage: false,
    canCreateCommit: false,
    canCreateBranch: false,
    canCreateMergeRequest: false,
    canReviewAndApproveMr: false,
    canResolveConflicts: false,
    canAdminApproveEscalation: false,
    canMergeProtectedMain: false,
    canExecuteRollback: false,
    canManageMembers: false,
  },
  Developer: {
    canExecuteSelect: true,
    canEditRecordsAndStage: true,
    canCreateCommit: true,
    canCreateBranch: true,
    canCreateMergeRequest: true,
    canReviewAndApproveMr: false,
    canResolveConflicts: true,
    canAdminApproveEscalation: false,
    canMergeProtectedMain: false,
    canExecuteRollback: false,
    canManageMembers: false,
  },
  Reviewer: {
    canExecuteSelect: true,
    canEditRecordsAndStage: true,
    canCreateCommit: true,
    canCreateBranch: true,
    canCreateMergeRequest: true,
    canReviewAndApproveMr: true,
    canResolveConflicts: true,
    canAdminApproveEscalation: false,
    canMergeProtectedMain: true,
    canExecuteRollback: false,
    canManageMembers: false,
  },
  Admin: {
    canExecuteSelect: true,
    canEditRecordsAndStage: true,
    canCreateCommit: true,
    canCreateBranch: true,
    canCreateMergeRequest: true,
    canReviewAndApproveMr: true,
    canResolveConflicts: true,
    canAdminApproveEscalation: true,
    canMergeProtectedMain: true,
    canExecuteRollback: true,
    canManageMembers: true,
  },
};

/**
 * Required Backend Capabilities & Contract Registry.
 * Since the backend has not been implemented yet, all required capabilities
 * are explicitly documented with their specification status so the frontend
 * never invents fake responses or claims unsupported operations succeeded.
 */
export const BACKEND_INTEGRATION_CONTRACT: ApiEndpointContract[] = [
  {
    module: 'Authentication & Session',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Auth Session Login / Logout / Token Refresh)',
    description:
      'Authenticates user credentials, issues session token/cookie, and returns authoritative server-enforced RBAC role.',
    requiredRole: 'Viewer',
    requestSchema: 'Pending backend specification: LoginRequest { email, password }',
    responseSchema: 'Pending backend specification: AuthSessionResponse { user, expiresAtUtc }',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Repositories & Connections',
    method: 'GET',
    endpoint: 'PENDING_SPEC (List & Register Repositories / Replica Telemetry)',
    description:
      'Returns registered database repositories, live connection states, latency, WAL replication lag, and storage metrics.',
    requiredRole: 'Viewer',
    requestSchema: 'Pending backend specification: RepositoryFilterParams',
    responseSchema: 'Pending backend specification: RepositoryListResponse { repositories: Repository[] }',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'SQL Execution Engine',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Isolated SQL Query & Explain Plan Execution)',
    description:
      'Executes SQL statements against a real database branch connection without auto-committing to VersionDB.',
    requiredRole: 'Viewer',
    requestSchema: 'Pending backend specification: SqlExecutionRequest { repositoryId, branch, sql }',
    responseSchema: 'Pending backend specification: QueryExecutionResult',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Schema & Catalog Introspection',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Catalog Tables, Views, Columns, Indexes, Lineage)',
    description:
      'Introspects live PostgreSQL catalog metadata, primary/foreign keys, DDL definitions, schema versions, and dependency lineage.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: CatalogSchemaResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Staging & Commits',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Stage Row/DDL Changes & Persist Immutable Commit)',
    description:
      'Validates staged DML row mutations and DDL schema changes and commits an immutable VersionDB snapshot.',
    requiredRole: 'Developer',
    requestSchema: 'Pending backend specification: CreateCommitRequest { branch, message, stagedChanges }',
    responseSchema: 'Pending backend specification: CommitRecord',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Branches & Diffs',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Branch Management & 3-Way Schema/Row Diff Computation)',
    description:
      'Creates copy-on-write database branches and computes deterministic DDL and primary-key row diffs between branches.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: BranchDiffResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Merge Requests & Conflict Validation',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Merge Request Lifecycle & 3-Way Conflict Resolution)',
    description:
      'Manages Merge Requests, reviewer approvals, schema/record collision resolution (OURS/THEIRS/MANUAL), and protected branch merges.',
    requiredRole: 'Developer',
    responseSchema: 'Pending backend specification: MergeRequestResponse / ConflictResolutionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Admin Approvals & Governance',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Lead DBA Escalation Queue & RBAC Member Management)',
    description:
      'Records mandatory Lead DBA escalation decisions and enforces server-side RBAC role assignments.',
    requiredRole: 'Admin',
    responseSchema: 'Pending backend specification: AdminApprovalDecisionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Time Machine & Rollback',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Historical WAL Checkpoints & Point-in-Time Rollback)',
    description:
      'Lists verified WAL LSN snapshots, generates deterministic rollback SQL plans, and executes audited rollbacks.',
    requiredRole: 'Admin',
    responseSchema: 'Pending backend specification: RollbackExecutionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Audit Logs & Notifications',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Immutable Governance Ledger & Operational Notifications)',
    description:
      'Streams cryptographically chained audit events and user notification alerts.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: AuditLogListResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
];
