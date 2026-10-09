export type ScreenPath =
  | 'overview'
  | 'repositories'
  | 'sql-workspace'
  | 'schema-explorer'
  | 'table-data'
  | 'branches'
  | 'commits-and-history'
  | 'changes-and-diff'
  | 'merge-requests'
  | 'conflict-resolution'
  | 'time-machine'
  | 'data-lineage'
  | 'schema-versions'
  | 'audit-logs'
  | 'members-and-permissions'
  | 'admin-approvals'
  | 'settings'
  | 'workspaces'
  | 'profile'
  | 'notifications'
  | 'onboarding'
  | 'login'
  | 'forgot-password'
  | 'reset-password'
  | '403'
  | '404'
  | '500'
  | '503';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'conflict' | 'merge-request' | 'commit' | 'security';
  timestampRelative: string;
  timestampUtc: string;
  read: boolean;
  targetScreen: ScreenPath;
  resourceLabel: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isInitialLoading: boolean;
  sessionToken: string | null;
  user: UserProfile | null;
  lastCheckedUtc: string | null;
  authError: string | null;
}

export type BackendConnectionState =
  | 'unconfigured'
  | 'checking'
  | 'connected'
  | 'unavailable'
  | 'unauthorized';

export interface ServiceOperationResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?:
    | 'UNCONFIGURED_BACKEND'
    | 'PENDING_BACKEND_SPEC'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'NETWORK_ERROR'
    | 'VALIDATION_ERROR'
    | 'SERVER_ERROR';
  statusCode?: number;
}

export interface UiPreferences {
  tableDensity: 'compact' | 'comfortable';
  showLineNumbers: boolean;
  confirmDestructiveActions: boolean;
}

export type UserRole = 'Viewer' | 'Developer' | 'Reviewer' | 'Admin';

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: UserRole;
  title: string;
  avatarUrl: string;
}

export type DatabaseConnectionMode = 'connected' | 'read-only' | 'disconnected';

export interface Repository {
  id: string;
  name: string;
  engine: string;
  engineVersion: string;
  environment: 'Production' | 'Staging' | 'Development';
  region: string;
  instanceDesc: string;
  defaultBranch: string;
  activeBranchesCount: number;
  commitsTodayCount: number;
  openMrCount: number;
  conflictsCount: number;
  connectionMode: DatabaseConnectionMode;
  latencyMs: number;
  walLag: string;
  snapshotDiskUsedGb: number;
  snapshotDiskTotalGb: number;
  latestSnapshotRef: string;
  replicaBufferHealthPct: number;
}

export interface ColumnDef {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  foreignKeyRef?: string;
  defaultValue?: string;
  description?: string;
}

export interface TableSchema {
  schema: string;
  name: string;
  rowCountLabel: string;
  rowCount: number;
  primaryKey: string;
  foreignKeySummary?: string;
  columns: ColumnDef[];
  ddl: string;
  indexes: string[];
}

export interface DatabaseView {
  schema: string;
  name: string;
  definition: string;
  sourceTables: string[];
}

export interface StagedRowMutation {
  id: string;
  repositoryId: string;
  branch: string;
  table: string;
  primaryKeyValue: string;
  operation: 'UPDATE' | 'INSERT' | 'DELETE';
  columnName?: string;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  rowSnapshot?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export interface StagedDDLChange {
  id: string;
  repositoryId: string;
  branch: string;
  table: string;
  statement: string;
  summary: string;
  timestamp: string;
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  targetCatalog: string;
  isDirty: boolean;
}

export interface QueryExecutionResult {
  status: 'success' | 'error';
  rows: Record<string, any>[];
  columns: { name: string; type: string }[];
  rowCount: number;
  totalTableRows: number;
  executionTimeMs: number;
  bufferHitsPct: number;
  memoryMb: number;
  targetTable: string;
  explainPlan: string[];
  messages: string[];
  errorMessage?: string;
  errorCode?: string;
}

export interface CommitRecord {
  hash: string;
  message: string;
  timestampRelative: string;
  timestampIso: string;
  summaryType: string;
  branch: string;
  affectedTable: string;
  affectedRowsLabel: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  status: 'Checks Passed' | 'Migrated' | 'Conflict' | 'Built (4m)';
  ddlPreview: string;
  dmlCount: number;
}

export interface BranchRecord {
  name: string;
  isProtected: boolean;
  headCommitHash: string;
  headCommitTitle: string;
  aheadCount: number;
  behindCount: number;
  authorHandle: string;
  updatedRelative: string;
  hasConflicts?: boolean;
}

export interface ConflictFieldDiff {
  field: string;
  isPrimaryKey?: boolean;
  isConflicted: boolean;
  oursValue: string;
  oursNote?: string;
  theirsValue: string;
  theirsNote?: string;
}

export interface ConflictItem {
  id: string;
  mrNumber: number;
  mrTitle: string;
  mrHexId: string;
  sourceBranch: string;
  sourceCommit: string;
  sourceAuthor: string;
  targetBranch: string;
  targetCommit: string;
  targetAuthor: string;
  table: string;
  primaryKeyField: string;
  primaryKeyValue: string;
  recordContextLabel: string;
  conflictType: 'RECORD_COLLISION' | 'SCHEMA_DEFAULT_MISMATCH';
  oursComplianceNote: string;
  theirsMigrationNote: string;
  fields: ConflictFieldDiff[];
  resolved: boolean;
  resolutionMode?: 'OURS' | 'THEIRS' | 'MANUAL';
  resolvedValues?: Record<string, string>;
  resolutionAuditNote?: string;
  escalatedToAdmin?: boolean;
}

export interface MergeRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  sourceBranch: string;
  sourceCommit: string;
  targetBranch: string;
  targetCommit: string;
  isProtectedTarget: boolean;
  authorHandle: string;
  authorName: string;
  authorAvatar: string;
  createdAtRelative: string;
  status: 'OPEN' | 'CONFLICT' | 'NEEDS_ADMIN' | 'READY' | 'MERGED' | 'CLOSED';
  approvalsCount: number;
  requiredApprovals: number;
  reviewers: { handle: string; approved: boolean; role: UserRole }[];
  conflictIds: string[];
  ddlChangesCount: number;
  rowsAddedCount: number;
  rowsModifiedCount: number;
  rowsDeletedCount: number;
  requiresAdminApproval: boolean;
  adminApproved?: boolean;
  adminDecisionReason?: string;
  integrityChecksPassed: boolean;
}

export interface AdminApprovalItem {
  id: string;
  mrNumber: number;
  mrTitle: string;
  sourceBranch: string;
  targetBranch: string;
  isProtectedTarget: boolean;
  authorHandle: string;
  approvalsLabel: string;
  blockerSummary: string;
  hasUnresolvedConflict: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface HistoricalSnapshot {
  id: string;
  ref: string;
  commitHash: string;
  label: string;
  timestampUtc: string;
  timestampRelative: string;
  branch: string;
  authorHandle: string;
  walLsn: string;
  sizeGb: number;
  tablesCount: number;
  totalRowsLabel: string;
  schemaVersion: string;
  rollbackSqlPreview: string[];
}

export interface AuditLogEntry {
  id: string;
  timestampUtc: string;
  timestampRelative: string;
  actorName: string;
  actorHandle: string;
  actorRole: UserRole;
  actionType:
    | 'COMMIT_CREATED'
    | 'BRANCH_CREATED'
    | 'CONFLICT_RESOLVED'
    | 'MR_APPROVED'
    | 'ADMIN_ESCALATION_DECISION'
    | 'MR_MERGED'
    | 'ROLLBACK_EXECUTED'
    | 'ROLE_UPDATED'
    | 'QUERY_EXECUTED';
  targetResource: string;
  branch: string;
  summary: string;
  immutableHash: string;
}

export interface SchemaVersionTag {
  version: string;
  migrationHash: string;
  commitHash: string;
  appliedAtUtc: string;
  appliedBy: string;
  ddlSummary: string;
  driftPct: string;
  status: 'APPLIED' | 'ACTIVE_HEAD' | 'SUPERSEDED';
  ddlScript: string;
}

export interface LineageNode {
  id: string;
  name: string;
  schema: string;
  type: 'TABLE' | 'VIEW' | 'MATERIALIZED_VIEW' | 'REPLICA_STREAM';
  rowCountLabel: string;
  hasPendingDiff?: boolean;
  upstreamIds: string[];
  downstreamIds: string[];
  columnsImpact: string[];
}

export interface ApiEndpointContract {
  module: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  description: string;
  requiredRole: UserRole;
  requestSchema?: string;
  responseSchema: string;
  contractStatus?: 'PENDING_BACKEND_SPEC' | 'CONFIGURED';
}
