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
    canDeleteBranch: boolean;
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
    canDeleteBranch: false,
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
    canDeleteBranch: true,
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
    canDeleteBranch: false,
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
    canDeleteBranch: true,
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
    endpoint: '/api/auth/login, /api/auth/register, /api/auth/me, /api/auth/refresh, /api/auth/logout',
    description:
      'Authenticates user credentials, registers users, verifies JWT bearer session, and provides rotating refresh token handling.',
    requiredRole: 'Viewer',
    requestSchema: 'LoginRequest { identifier, password } | RegisterRequest { email, username, password }',
    responseSchema: 'AuthResult { accessToken, refreshToken, expiresIn, user: { id, email, username, globalRole } }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Repositories & Connections',
    method: 'GET',
    endpoint: '/api/repos, /api/repos/:repoId',
    description:
      'Lists repositories accessible to user and creates new repositories with initial protected main branch.',
    requiredRole: 'Viewer',
    requestSchema: 'CreateRepoBody { name, description }',
    responseSchema: 'RepositoryListResponse { repositories: RepositoryWithRole[] }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Records & Staging',
    method: 'GET',
    endpoint: '/api/repos/:repoId/branches/:branch/records, /working',
    description:
      'Reads branch collections and records, stages record PUT/DELETE mutations in caller working state, and clears working changes.',
    requiredRole: 'Developer',
    requestSchema: 'PutRecordBody { data: Record<string, unknown> }',
    responseSchema: 'RecordListResponse | WorkingChangeResponse',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Commits & Snapshot History',
    method: 'POST',
    endpoint: '/api/repos/:repoId/branches/:branch/commits, /api/repos/:repoId/history/:ref',
    description:
      'Persists staged changes into an immutable content-addressed commit with CAS ref movement, and retrieves ref commit history.',
    requiredRole: 'Developer',
    requestSchema: 'CommitBody { message: string }',
    responseSchema: 'CommitResponse { commit: Commit & { changeCount: number } }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Members & Access Control',
    method: 'GET',
    endpoint: '/api/repos/:repoId/members, /api/repos/:repoId/members/:userId',
    description:
      'Lists repository members, assigns roles (owner, maintainer, reviewer, viewer), and removes members with last-owner protection.',
    requiredRole: 'Admin',
    requestSchema: 'MemberBody { email, role } | MemberRoleBody { role }',
    responseSchema: 'MemberListResponse { members: Member[] }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Branches (Listing & Management)',
    method: 'GET',
    endpoint: '/api/repos/:repoId/branches, POST /api/repos/:repoId/branches, DELETE /api/repos/:repoId/branches/:branchName',
    description:
      'Lists branches for repository, creates isolated branches from existing refs, and deletes non-default, unprotected branches.',
    requiredRole: 'Developer',
    responseSchema: 'BranchListResponse { branches: Branch[] } | BranchResponse { branch: Branch }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'SQL Execution Engine',
    method: 'POST',
    endpoint: '/api/repos/:repoId/sql/execute',
    description:
      'Executes SELECT queries against version-controlled collection snapshots for a branch.',
    requiredRole: 'Viewer',
    requestSchema: 'SqlExecutionRequest { branch: string, sql: string }',
    responseSchema: 'QueryExecutionResult { status, rows, columns, rowCount, executionTimeMs, ... }',
    contractStatus: 'CONFIGURED',
  },
  {
    module: 'Schema & Catalog Introspection',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Catalog introspection via DDL not implemented; managed as collections)',
    description:
      'Introspects live PostgreSQL catalog metadata, primary/foreign keys, DDL definitions, schema versions, and dependency lineage.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: CatalogSchemaResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Branches & Diffs',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Diff engine endpoint not implemented in backend)',
    description:
      'Creates copy-on-write database branches and computes deterministic DDL and primary-key row diffs between branches.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: BranchDiffResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Merge Requests & Conflict Validation',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Merge request endpoints not implemented in backend)',
    description:
      'Manages Merge Requests, reviewer approvals, schema/record collision resolution (OURS/THEIRS/MANUAL), and protected branch merges.',
    requiredRole: 'Developer',
    responseSchema: 'Pending backend specification: MergeRequestResponse / ConflictResolutionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Admin Approvals & Governance',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Lead DBA escalation queue endpoint not implemented in backend)',
    description:
      'Records mandatory Lead DBA escalation decisions and enforces server-side RBAC role assignments.',
    requiredRole: 'Admin',
    responseSchema: 'Pending backend specification: AdminApprovalDecisionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Time Machine & Rollback',
    method: 'POST',
    endpoint: 'PENDING_SPEC (Rollback endpoint not implemented in backend)',
    description:
      'Lists verified WAL LSN snapshots, generates deterministic rollback SQL plans, and executes audited rollbacks.',
    requiredRole: 'Admin',
    responseSchema: 'Pending backend specification: RollbackExecutionResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
  {
    module: 'Audit Logs & Notifications',
    method: 'GET',
    endpoint: 'PENDING_SPEC (Audit logged internally to DB table; no public HTTP query route)',
    description:
      'Streams cryptographically chained audit events and user notification alerts.',
    requiredRole: 'Viewer',
    responseSchema: 'Pending backend specification: AuditLogListResponse',
    contractStatus: 'PENDING_BACKEND_SPEC',
  },
];
