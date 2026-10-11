import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKEND_INTEGRATION_CONTRACT,
  getEnvironmentConfig,
  ROLE_UI_CAPABILITIES,
} from '../config/appConfig';
import { apiClient } from '../services/apiClient';
import { versionDbServices } from '../services/versionDbServices';
import {
  AdminApprovalItem,
  ApiEndpointContract,
  AuditLogEntry,
  AuthState,
  BackendConnectionState,
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
  QueryTab,
  Repository,
  SchemaVersionTag,
  ScreenPath,
  ServiceOperationResult,
  StagedDDLChange,
  StagedRowMutation,
  TableSchema,
  UiPreferences,
  UserProfile,
  UserRole,
} from '../types/versiondb';

export interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface VersionDbContextValue {
  // Navigation
  activeScreen: ScreenPath;
  previousScreen: ScreenPath;
  navigateTo: (screen: ScreenPath) => void;
  navigateBack: () => void;

  // Backend & Service Connectivity
  apiBaseUrl: string;
  isBackendConfigured: boolean;
  backendConnectionState: BackendConnectionState;
  lastBackendError: string | null;
  isCatalogLoading: boolean;
  isOperationPending: boolean;
  refreshWorkspaceCatalog: () => Promise<ServiceOperationResult>;

  // Auth & UI Role Presentation Helper
  authState: AuthState;
  uiRoleHint: UserRole;
  currentUser: UserProfile;
  users: UserProfile[];
  roleCapabilities: (typeof ROLE_UI_CAPABILITIES)[UserRole];
  switchUserOrRole: (roleOrId: string) => void;
  signInWithBackend: (email: string, password: string) => Promise<ServiceOperationResult>;
  registerWithBackend: (
    email: string,
    username: string,
    password: string
  ) => Promise<ServiceOperationResult>;
  signOutSession: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<ServiceOperationResult>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<ServiceOperationResult>;

  // Notifications & UI Preferences
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  uiPreferences: UiPreferences;
  updateUiPreferences: (patch: Partial<UiPreferences>) => void;

  // Repositories & Branches (Server-driven, empty when unconfigured)
  repositories: Repository[];
  activeRepo: Repository | null;
  selectRepository: (repoId: string) => void;
  createRepository: (
    name: string,
    engine: string,
    environment: 'Production' | 'Staging' | 'Development',
    region: string,
    defaultBranch: string
  ) => Promise<ServiceOperationResult<Repository>>;
  setRepositoryConnectionMode: (
    repoId: string,
    mode: DatabaseConnectionMode
  ) => Promise<ServiceOperationResult<Repository>>;

  branches: BranchRecord[];
  activeBranch: string;
  selectBranch: (branchName: string) => void;
  compareTargetBranch: string;
  setCompareTargetBranch: (branchName: string) => void;
  createBranch: (name: string, fromBranch: string) => Promise<ServiceOperationResult<BranchRecord>>;

  // Schema & Table Data
  tables: TableSchema[];
  views: DatabaseView[];
  selectedTableName: string;
  setSelectedTableName: (tableName: string) => void;
  tableRowsByTable: Record<string, Record<string, any>[]>;

  // Staging & Commits
  stagedRowMutations: StagedRowMutation[];
  stagedDdlChanges: StagedDDLChange[];
  stageRowEdit: (
    table: string,
    pkValue: string,
    columnName: string,
    oldValue: any,
    newValue: any,
    rowSnapshot?: Record<string, any>
  ) => Promise<ServiceOperationResult<StagedRowMutation>>;
  stageInsertRow: (
    table: string,
    newRow: Record<string, any>
  ) => Promise<ServiceOperationResult<StagedRowMutation>>;
  stageDeleteRow: (
    table: string,
    pkValue: string,
    rowSnapshot: Record<string, any>
  ) => Promise<ServiceOperationResult<StagedRowMutation>>;
  stageDdlChange: (
    table: string,
    statement: string,
    summary: string
  ) => Promise<ServiceOperationResult<StagedDDLChange>>;
  discardStagedItem: (id: string) => void;
  discardAllStaged: () => void;
  commitStagedChanges: (message: string) => Promise<ServiceOperationResult<CommitRecord>>;

  // SQL Workspace
  queryTabs: QueryTab[];
  activeQueryTabId: string;
  setActiveQueryTabId: (id: string) => void;
  updateActiveQuerySql: (sql: string) => void;
  addNewQueryTab: (initialSql?: string, title?: string) => void;
  closeQueryTab: (id: string) => void;
  lastQueryResult: QueryExecutionResult | null;
  isQueryExecuting: boolean;
  executeActiveQuery: () => Promise<ServiceOperationResult<QueryExecutionResult>>;
  cancelActiveQuery: () => void;

  // Commits, MRs, Conflicts, Admin Approvals, Snapshots, Audit Logs
  commits: CommitRecord[];
  mergeRequests: MergeRequest[];
  selectedMrNumber: number | null;
  setSelectedMrNumber: (num: number) => void;
  conflicts: ConflictItem[];
  selectedConflictId: string;
  setSelectedConflictId: (id: string) => void;
  adminApprovals: AdminApprovalItem[];
  snapshots: HistoricalSnapshot[];
  selectedSnapshotId: string;
  setSelectedSnapshotId: (id: string) => void;
  auditLogs: AuditLogEntry[];
  schemaVersions: SchemaVersionTag[];
  lineageNodes: LineageNode[];
  apiContracts: ApiEndpointContract[];

  // Mutations (All async, backend-verified)
  createMergeRequest: (
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string
  ) => Promise<ServiceOperationResult<MergeRequest>>;
  approveMergeRequest: (mrNumber: number) => Promise<ServiceOperationResult<MergeRequest>>;
  resolveConflictItem: (
    conflictId: string,
    mode: 'OURS' | 'THEIRS' | 'MANUAL',
    manualValues?: Record<string, string>,
    auditNote?: string
  ) => Promise<ServiceOperationResult<ConflictItem>>;
  escalateConflictToAdmin: (conflictId: string, reason: string) => Promise<ServiceOperationResult>;
  decideAdminApproval: (
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string
  ) => Promise<ServiceOperationResult<AdminApprovalItem>>;
  executeMerge: (mrNumber: number) => Promise<ServiceOperationResult<MergeRequest>>;
  executeRollbackToSnapshot: (
    snapshotId: string,
    reason: string
  ) => Promise<ServiceOperationResult<HistoricalSnapshot>>;
  updateUserRole: (
    userId: string,
    newRole: UserRole
  ) => Promise<ServiceOperationResult<UserProfile>>;
  exportAuditLedger: (
    format: 'json' | 'csv'
  ) => Promise<ServiceOperationResult<{ downloadUrl: string }>>;

  // Modals & Toasts
  isCommitModalOpen: boolean;
  setCommitModalOpen: (open: boolean) => void;
  isCreateBranchModalOpen: boolean;
  setCreateBranchModalOpen: (open: boolean) => void;
  isCreateMrModalOpen: boolean;
  setCreateMrModalOpen: (open: boolean) => void;
  isCreateRepoModalOpen: boolean;
  setCreateRepoModalOpen: (open: boolean) => void;
  isRollbackModalOpen: boolean;
  setRollbackModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isApiContractDrawerOpen: boolean;
  setApiContractDrawerOpen: (open: boolean) => void;

  toasts: ToastNotification[];
  pushToast: (type: ToastNotification['type'], title: string, message: string) => void;
  dismissToast: (id: string) => void;
}

const VersionDbContext = createContext<VersionDbContextValue | undefined>(undefined);

const VALID_SCREENS: ScreenPath[] = [
  'overview',
  'repositories',
  'sql-workspace',
  'schema-explorer',
  'table-data',
  'branches',
  'commits-and-history',
  'changes-and-diff',
  'merge-requests',
  'conflict-resolution',
  'time-machine',
  'data-lineage',
  'schema-versions',
  'audit-logs',
  'members-and-permissions',
  'admin-approvals',
  'settings',
  'workspaces',
  'profile',
  'notifications',
  'onboarding',
  'login',
  'forgot-password',
  'reset-password',
  '403',
  '404',
  '500',
  '503',
];

const AUTH_SCREENS: ScreenPath[] = ['login', 'forgot-password', 'reset-password'];

function parseScreenFromHash(): ScreenPath {
  const raw = window.location.hash.replace(/^#\/?/, '').trim() as ScreenPath;
  const hasSavedToken =
    typeof window !== 'undefined' &&
    window.localStorage &&
    (!!localStorage.getItem('versiondb_token') ||
      !!localStorage.getItem('versiondb_refresh_token'));

  if (!raw || (!hasSavedToken && !AUTH_SCREENS.includes(raw))) {
    // Default to login screen for unauthenticated users or empty hash
    return 'login';
  }
  if (VALID_SCREENS.includes(raw)) {
    return raw;
  }
  return '404';
}

export const VersionDbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envConfig = getEnvironmentConfig();

  const [activeScreen, setActiveScreen] = useState<ScreenPath>(() => parseScreenFromHash());
  const [previousScreen, setPreviousScreen] = useState<ScreenPath>('overview');

  // Backend connection state
  const [backendConnectionState, setBackendConnectionState] = useState<BackendConnectionState>(() =>
    envConfig.isBackendConfigured ? 'checking' : 'unconfigured'
  );
  const [lastBackendError, setLastBackendError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [isOperationPending, setIsOperationPending] = useState<boolean>(false);

  // Authentication state (never pre-populated with fake accounts)
  // isInitialLoading=true when a saved token exists so protected routes
  // wait for hydration before rendering.
  const [authState, setAuthState] = useState<AuthState>(() => {
    const hasSavedToken =
      typeof window !== 'undefined' &&
      window.localStorage &&
      (!!localStorage.getItem('versiondb_token') ||
        !!localStorage.getItem('versiondb_refresh_token'));
    return {
      isAuthenticated: false,
      isInitialLoading: hasSavedToken,
      sessionToken: null,
      user: null,
      lastCheckedUtc: null,
      authError: null,
    };
  });

  // Presentation-only UI role hint for inspecting role-conditioned layouts
  const [uiRoleHint, setUiRoleHint] = useState<UserRole>('Developer');

  // Ref to always hold the latest isAuthenticated value — used in navigateTo to avoid stale closures
  const isAuthenticatedRef = useRef<boolean>(false);

  // Keep the ref in sync with state on every render
  isAuthenticatedRef.current = authState.isAuthenticated;

  // UI Preferences (non-operational static workspace settings)
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>({
    tableDensity: 'comfortable',
    showLineNumbers: true,
    confirmDestructiveActions: true,
  });

  // Operational collections — strictly empty unless populated by a real backend response
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string>('');
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('');
  const [compareTargetBranch, setCompareTargetBranch] = useState<string>('');
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [views, setViews] = useState<DatabaseView[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [tableRowsByTable, setTableRowsByTable] = useState<Record<string, Record<string, any>[]>>(
    {}
  );
  const [stagedRowMutations, setStagedRowMutations] = useState<StagedRowMutation[]>([]);
  const [stagedDdlChanges, setStagedDdlChanges] = useState<StagedDDLChange[]>([]);
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [mergeRequests, setMergeRequests] = useState<MergeRequest[]>([]);
  const [selectedMrNumber, setSelectedMrNumber] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [selectedConflictId, setSelectedConflictId] = useState<string>('');
  const [adminApprovals, setAdminApprovals] = useState<AdminApprovalItem[]>([]);
  const [snapshots, setSnapshots] = useState<HistoricalSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [schemaVersions, setSchemaVersions] = useState<SchemaVersionTag[]>([]);
  const [lineageNodes, setLineageNodes] = useState<LineageNode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // SQL Workspace Tabs (starts with an empty untitled buffer, no hardcoded queries)
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
    {
      id: 'tab-1',
      title: 'query_1.sql',
      targetCatalog: '',
      isDirty: false,
      sql: '',
    },
  ]);
  const [activeQueryTabId, setActiveQueryTabId] = useState<string>('tab-1');
  const [lastQueryResult, setLastQueryResult] = useState<QueryExecutionResult | null>(null);
  const [isQueryExecuting, setIsQueryExecuting] = useState<boolean>(false);
  const queryAbortControllerRef = useRef<AbortController | null>(null);

  // Modals & Toasts
  const [isCommitModalOpen, setCommitModalOpen] = useState(false);
  const [isCreateBranchModalOpen, setCreateBranchModalOpen] = useState(false);
  const [isCreateMrModalOpen, setCreateMrModalOpen] = useState(false);
  const [isCreateRepoModalOpen, setCreateRepoModalOpen] = useState(false);
  const [isRollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isApiContractDrawerOpen, setApiContractDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type: ToastNotification['type'], title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);

      // Auto-dismiss: success/info/warning after 3.5s, errors after 7s
      const delay = type === 'error' ? 7000 : 3500;
      const timer = window.setTimeout(() => {
        toastTimersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, delay);

      toastTimersRef.current.set(id, timer);
    },
    []
  );

  // Cleanup pending toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => window.clearTimeout(t));
      toastTimersRef.current.clear();
    };
  }, []);

  const navigateTo = useCallback(
    (screen: ScreenPath) => {
      // Read the latest auth state from the ref to avoid stale closure bugs
      // (e.g. when called immediately after setAuthState in signInWithBackend).
      const isAuthenticated = isAuthenticatedRef.current;
      const targetScreen =
        !isAuthenticated && !AUTH_SCREENS.includes(screen) ? 'login' : screen;
      setActiveScreen((current) => {
        if (current !== targetScreen) {
          setPreviousScreen(current);
        }
        return targetScreen;
      });
      window.location.hash = `#/${targetScreen}`;
    },
    [] // no deps — reads live state via ref
  );

  const navigateBack = useCallback(() => {
    setActiveScreen((current) => {
      const target = previousScreen && previousScreen !== current ? previousScreen : 'overview';
      window.location.hash = `#/${target}`;
      return target;
    });
  }, [previousScreen]);

  // Register global 401 and 403 handlers on the centralized API client
  useEffect(() => {
    apiClient.setCallbacks({
      onUnauthorized: (message) => {
        setAuthState({
          isAuthenticated: false,
          isInitialLoading: false,
          sessionToken: null,
          user: null,
          lastCheckedUtc: new Date().toISOString(),
          authError: message,
        });
        setBackendConnectionState('unauthorized');
        setLastBackendError(message);
        pushToast('error', '401 Unauthorized', message);
        navigateTo('login');
      },
      onForbidden: (message) => {
        setLastBackendError(message);
        pushToast('error', '403 Access Denied', message);
        navigateTo('403');
      },
    });
  }, [navigateTo, pushToast]);

  // Sync browser hash navigation with strict auth guards
  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = parseScreenFromHash();
      if (!authState.isAuthenticated && !AUTH_SCREENS.includes(nextScreen)) {
        window.location.hash = '#/login';
        setActiveScreen('login');
        return;
      }
      setActiveScreen(nextScreen);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [authState.isAuthenticated]);

  // Global keyboard shortcut Cmd/Ctrl + K for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Refresh workspace state from backend.
  // IMPORTANT: uses apiClient.getSessionToken() so this always gets the current token
  // even when called immediately after login (before React re-renders the new authState).
  const refreshWorkspaceCatalog = useCallback(async (): Promise<ServiceOperationResult> => {
    const currentEnv = getEnvironmentConfig();
    if (!currentEnv.isBackendConfigured) {
      setBackendConnectionState('unconfigured');
      setLastBackendError(
        'VITE_API_BASE_URL is not configured. Connect a VersionDB backend service to load operational repositories, schemas, commits, and metrics.'
      );
      return {
        ok: false,
        errorCode: 'UNCONFIGURED_BACKEND',
        error: 'Backend API is not configured (VITE_API_BASE_URL is empty).',
      };
    }

    // Use the apiClient's live token (always fresh) instead of a potentially stale
    // authState.sessionToken from a React closure captured before the last login.
    const liveToken = apiClient.getSessionToken();
    setIsCatalogLoading(true);
    setBackendConnectionState('checking');
    const result = await versionDbServices.catalog.fetchWorkspaceState(liveToken);
    setIsCatalogLoading(false);

    if (result.ok && result.data) {
      const data = result.data;
      setRepositories(data.repositories || []);
      setBranches(data.branches || []);
      setTables(data.tables || []);
      setViews(data.views || []);
      setCommits(data.commits || []);
      setMergeRequests(data.mergeRequests || []);
      setConflicts(data.conflicts || []);
      setAdminApprovals(data.adminApprovals || []);
      setSnapshots(data.snapshots || []);
      setAuditLogs(data.auditLogs || []);
      setSchemaVersions(data.schemaVersions || []);
      setLineageNodes(data.lineageNodes || []);
      setUsers(data.members || []);
      setNotifications(data.notifications || []);
      setBackendConnectionState('connected');
      setLastBackendError(null);

      if (data.repositories && data.repositories.length > 0) {
        const repo = data.repositories.find((r) => r.id === activeRepoId) || data.repositories[0];
        setActiveRepoId(repo.id);
        const branchName = data.branches[0]?.name || repo.defaultBranch || 'main';
        setActiveBranch((b) => b || branchName);

        if (data.tables && data.tables.length > 0) {
          const firstTable = data.tables[0].name;
          setSelectedTableName((t) => t || firstTable);
          // Use fresh token from apiClient, not stale closure
          const freshToken = apiClient.getSessionToken();
          void versionDbServices.records.fetchRecords(repo.id, branchName, firstTable, freshToken).then((rowsRes) => {
            if (rowsRes.ok && rowsRes.data) {
              setTableRowsByTable((prev) => ({ ...prev, [firstTable]: rowsRes.data! }));
            }
          });
        }
      }
      return result;
    }

    if (result.errorCode === 'UNAUTHORIZED') {
      setBackendConnectionState('unauthorized');
    } else if (result.errorCode === 'UNCONFIGURED_BACKEND') {
      setBackendConnectionState('unconfigured');
    } else {
      setBackendConnectionState('unavailable');
    }
    setLastBackendError(result.error || 'Unable to load workspace catalog from backend.');
    return result;
  // Remove authState.sessionToken from deps — we now read the live token from apiClient directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRepoId]);

  // Session hydration on mount — runs exactly once.
  // Sets isInitialLoading=false when done and redirects unauthenticated
  // users from protected routes to the login page.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const savedToken = localStorage.getItem('versiondb_token');
    const savedRefreshToken = localStorage.getItem('versiondb_refresh_token');

    if (!savedToken && !savedRefreshToken) {
      // No saved session: make sure loading is cleared and redirect to login
      // if the user landed on a protected route.
      setAuthState((prev) => ({ ...prev, isInitialLoading: false }));
      setActiveScreen((current) => {
        if (!AUTH_SCREENS.includes(current)) {
          window.location.hash = '#/login';
          return 'login';
        }
        return current;
      });
      if (envConfig.isBackendConfigured) {
        void refreshWorkspaceCatalog();
      }
      return;
    }

    let isMounted = true;
    (async () => {
      if (savedToken) {
        apiClient.setSessionToken(savedToken);
        const check = await versionDbServices.auth.verifySession(savedToken);
        if (!isMounted) return;
        if (check.ok && check.data) {
          setAuthState({
            isAuthenticated: true,
            isInitialLoading: false,
            sessionToken: savedToken,
            user: check.data,
            lastCheckedUtc: new Date().toISOString(),
            authError: null,
          });
          setBackendConnectionState('connected');
          // If currently on an auth screen, redirect to overview
          setActiveScreen((current) => {
            if (AUTH_SCREENS.includes(current)) {
              window.location.hash = '#/overview';
              return 'overview';
            }
            return current;
          });
          void refreshWorkspaceCatalog();
          return;
        }
      }

      if (savedRefreshToken) {
        const refreshRes = await versionDbServices.auth.refresh(savedRefreshToken);
        if (!isMounted) return;
        if (refreshRes.ok && refreshRes.data) {
          localStorage.setItem('versiondb_token', refreshRes.data.token);
          localStorage.setItem('versiondb_refresh_token', refreshRes.data.refreshToken);
          apiClient.setSessionToken(refreshRes.data.token);
          setAuthState({
            isAuthenticated: true,
            isInitialLoading: false,
            sessionToken: refreshRes.data.token,
            user: refreshRes.data.user,
            lastCheckedUtc: new Date().toISOString(),
            authError: null,
          });
          setBackendConnectionState('connected');
          setActiveScreen((current) => {
            if (AUTH_SCREENS.includes(current)) {
              window.location.hash = '#/overview';
              return 'overview';
            }
            return current;
          });
          void refreshWorkspaceCatalog();
          return;
        }
      }

      // Tokens expired/invalid — clear and redirect to login
      localStorage.removeItem('versiondb_token');
      localStorage.removeItem('versiondb_refresh_token');
      apiClient.setSessionToken(null);
      if (!isMounted) return;
      setAuthState({
        isAuthenticated: false,
        isInitialLoading: false,
        sessionToken: null,
        user: null,
        lastCheckedUtc: new Date().toISOString(),
        authError: null,
      });
      setActiveScreen((current) => {
        if (!AUTH_SCREENS.includes(current)) {
          window.location.hash = '#/login';
          return 'login';
        }
        return current;
      });
      if (envConfig.isBackendConfigured) {
        void refreshWorkspaceCatalog();
      }
    })();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived activeUser: either real backend user or clearly marked unauthenticated UI role preview
  const currentUser = useMemo<UserProfile>(() => {
    if (authState.isAuthenticated && authState.user) {
      return authState.user;
    }
    return {
      id: '',
      name: 'Unauthenticated Session',
      handle: 'unauthenticated',
      email: '',
      role: uiRoleHint,
      title: `UI Role Preview (${uiRoleHint})`,
      avatarUrl: '',
    };
  }, [authState.isAuthenticated, authState.user, uiRoleHint]);

  const roleCapabilities = useMemo(
    () => ROLE_UI_CAPABILITIES[currentUser.role],
    [currentUser.role]
  );

  const activeRepo = useMemo<Repository | null>(() => {
    if (repositories.length === 0) {
      return null;
    }
    return repositories.find((r) => r.id === activeRepoId) || repositories[0];
  }, [repositories, activeRepoId]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const switchUserOrRole = useCallback(
    (roleOrId: string) => {
      const validRoles: UserRole[] = ['Admin', 'Reviewer', 'Developer', 'Viewer'];
      const matchedRole = validRoles.find((r) => r.toLowerCase() === roleOrId.toLowerCase());
      if (matchedRole) {
        setUiRoleHint(matchedRole);
        pushToast(
          'info',
          `UI Role Hint: ${matchedRole}`,
          'Client-side UI layout updated. Server-side RBAC remains authoritative for all operations.'
        );
        return;
      }
      const matchedMember = users.find((u) => u.id === roleOrId);
      if (matchedMember) {
        setUiRoleHint(matchedMember.role);
      }
    },
    [pushToast, users]
  );

  // Auth operations
  const signInWithBackend = useCallback(
    async (email: string, password: string): Promise<ServiceOperationResult> => {
      setIsOperationPending(true);
      const res = await versionDbServices.auth.signIn(email, password);
      setIsOperationPending(false);

      if (res.ok && res.data) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('versiondb_token', res.data.token);
          if (res.data.refreshToken) {
            localStorage.setItem('versiondb_refresh_token', res.data.refreshToken);
          }
        }
        // Set token on apiClient FIRST — refreshWorkspaceCatalog reads from apiClient.getSessionToken()
        // to avoid stale closure issues (React state won't reflect the new token until next render).
        apiClient.setSessionToken(res.data.token);
        // Update the ref eagerly so navigateTo's auth guard sees the correct value
        // synchronously — React state updates are batched and won't be visible until next render.
        isAuthenticatedRef.current = true;
        setAuthState({
          isAuthenticated: true,
          isInitialLoading: false,
          sessionToken: res.data.token,
          user: res.data.user,
          lastCheckedUtc: new Date().toISOString(),
          authError: null,
        });
        setBackendConnectionState('connected');
        setLastBackendError(null);
        pushToast('success', 'Authenticated', `Signed in as ${res.data.user.email}.`);
        // Navigate first so the user sees the dashboard immediately, then load data in background.
        navigateTo('overview');
        void refreshWorkspaceCatalog();
        return res;
      }

      const errMsg =
        res.error ||
        'Authentication failed. Ensure the VersionDB authentication backend is configured and reachable.';
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: false,
        sessionToken: null,
        user: null,
        lastCheckedUtc: new Date().toISOString(),
        authError: errMsg,
      }));
      pushToast('error', 'Authentication Unavailable', errMsg);
      return res;
    },
    [navigateTo, pushToast, refreshWorkspaceCatalog]
  );

  const registerWithBackend = useCallback(
    async (email: string, username: string, password: string): Promise<ServiceOperationResult> => {
      setIsOperationPending(true);
      const res = await versionDbServices.auth.register(email, username, password);
      // Keep isOperationPending=true through the auto-login call so the button
      // never flickers back to enabled mid-flow.

      if (res.ok) {
        pushToast('success', 'Account Registered', `Account created for ${username}. Signing in…`);
        // signInWithBackend manages its own setIsOperationPending lifecycle.
        // Pass the flag to skip the redundant setIsOperationPending(true) at start.
        const loginRes = await signInWithBackend(email, password);
        if (!loginRes.ok) {
          // Registration succeeded but automatic login failed.
          // signInWithBackend already pushed an error toast, so only show the
          // inline-friendly error code without a second toast from here.
          return {
            ok: false,
            errorCode: loginRes.errorCode,
            error:
              `Account created. Automatic sign-in failed: ${
                loginRes.error || 'Authentication error'
              }. Please sign in manually.`,
          };
        }
        return loginRes;
      }

      setIsOperationPending(false);
      const errMsg = res.error || 'Registration failed.';
      pushToast('error', 'Registration Failed', errMsg);
      return res;
    },
    [pushToast, signInWithBackend]
  );

  const signOutSession = useCallback(async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('versiondb_refresh_token') : null;
    if (authState.sessionToken || refreshToken) {
      await versionDbServices.auth.signOut(refreshToken, authState.sessionToken);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('versiondb_token');
      localStorage.removeItem('versiondb_refresh_token');
    }
    apiClient.setSessionToken(null);
    setAuthState({
      isAuthenticated: false,
      isInitialLoading: false,
      sessionToken: null,
      user: null,
      lastCheckedUtc: new Date().toISOString(),
      authError: null,
    });
    pushToast('info', 'Session Cleared', 'Client authentication state has been cleared.');
    navigateTo('login');
  }, [authState.sessionToken, navigateTo, pushToast]);

  const requestPasswordReset = useCallback(
    async (email: string): Promise<ServiceOperationResult> => {
      setIsOperationPending(true);
      const res = await versionDbServices.auth.requestPasswordReset(email);
      setIsOperationPending(false);
      if (!res.ok) {
        pushToast(
          'error',
          'Password Reset Unavailable',
          res.error || 'Password reset service is not configured.'
        );
      }
      return res;
    },
    [pushToast]
  );

  const resetPasswordWithToken = useCallback(
    async (token: string, newPassword: string): Promise<ServiceOperationResult> => {
      setIsOperationPending(true);
      const res = await versionDbServices.auth.resetPassword(token, newPassword);
      setIsOperationPending(false);
      if (!res.ok) {
        pushToast(
          'error',
          'Password Reset Failed',
          res.error || 'Password reset service is not configured.'
        );
      }
      return res;
    },
    [pushToast]
  );

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const updateUiPreferences = useCallback(
    (patch: Partial<UiPreferences>) => {
      setUiPreferences((prev) => ({ ...prev, ...patch }));
      pushToast('info', 'UI Preferences Updated', 'Local workspace display preferences updated.');
    },
    [pushToast]
  );

  const selectRepository = useCallback((repoId: string) => {
    setActiveRepoId(repoId);
  }, []);

  const createRepository = useCallback(
    async (
      name: string,
      engine: string,
      environment: 'Production' | 'Staging' | 'Development',
      region: string,
      defaultBranch: string
    ): Promise<ServiceOperationResult<Repository>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.repositories.createRepository(
        { name, engine, environment, region, defaultBranch },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setRepositories((prev) => [res.data!, ...prev]);
        setActiveRepoId(res.data.id);
        setCreateRepoModalOpen(false);
        pushToast('success', 'Repository Created', `Repository ${res.data.name} registered.`);
      } else {
        pushToast(
          'error',
          'Repository Creation Failed',
          res.error || 'Backend repository service is not configured.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const setRepositoryConnectionMode = useCallback(
    async (
      repoId: string,
      mode: DatabaseConnectionMode
    ): Promise<ServiceOperationResult<Repository>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.repositories.updateConnectionMode(
        repoId,
        mode,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setRepositories((prev) => prev.map((r) => (r.id === repoId ? res.data! : r)));
        pushToast('success', 'Connection Updated', `Connection mode updated to ${mode}.`);
      } else {
        pushToast(
          'error',
          'Connection Update Failed',
          res.error || 'Cannot modify database connection mode without a configured backend.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const selectBranch = useCallback((branchName: string) => {
    setActiveBranch(branchName);
  }, []);

  const createBranch = useCallback(
    async (name: string, fromBranch: string): Promise<ServiceOperationResult<BranchRecord>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.branches.createBranch(
        activeRepo?.id || '',
        name,
        fromBranch,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setBranches((prev) => [res.data!, ...prev]);
        setActiveBranch(res.data.name);
        setCreateBranchModalOpen(false);
        pushToast('success', 'Branch Created', `Checked out branch ${res.data.name}.`);
      } else {
        pushToast(
          'error',
          'Branch Creation Unavailable',
          res.error || 'Backend branch service is not configured.'
        );
      }
      return res;
    },
    [activeRepo?.id, authState.sessionToken, pushToast]
  );

  // Staging & Commits
  const stageRowEdit = useCallback(
    async (
      table: string,
      pkValue: string,
      columnName: string,
      oldValue: any,
      newValue: any,
      rowSnapshot?: Record<string, any>
    ): Promise<ServiceOperationResult<StagedRowMutation>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.commits.stageRowMutation(
        {
          repositoryId: activeRepo?.id || '',
          branch: activeBranch,
          table,
          primaryKeyValue: pkValue,
          operation: 'UPDATE',
          columnName,
          oldValue,
          newValue,
          rowSnapshot,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setStagedRowMutations((prev) => [res.data!, ...prev]);
        pushToast('info', 'Row Edit Staged', `Staged UPDATE on ${table} (${pkValue}).`);
      } else {
        pushToast(
          'error',
          'Staging Unavailable',
          res.error || 'Cannot stage row mutations without a configured backend.'
        );
      }
      return res;
    },
    [activeBranch, activeRepo?.id, authState.sessionToken, pushToast]
  );

  const stageInsertRow = useCallback(
    async (
      table: string,
      newRow: Record<string, any>
    ): Promise<ServiceOperationResult<StagedRowMutation>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.commits.stageRowMutation(
        {
          repositoryId: activeRepo?.id || '',
          branch: activeBranch,
          table,
          primaryKeyValue: String(newRow.id || ''),
          operation: 'INSERT',
          rowSnapshot: newRow,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setStagedRowMutations((prev) => [res.data!, ...prev]);
        pushToast('info', 'Row Insert Staged', `Staged INSERT on ${table}.`);
      } else {
        pushToast(
          'error',
          'Staging Unavailable',
          res.error || 'Cannot stage row inserts without a configured backend.'
        );
      }
      return res;
    },
    [activeBranch, activeRepo?.id, authState.sessionToken, pushToast]
  );

  const stageDeleteRow = useCallback(
    async (
      table: string,
      pkValue: string,
      rowSnapshot: Record<string, any>
    ): Promise<ServiceOperationResult<StagedRowMutation>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.commits.stageRowMutation(
        {
          repositoryId: activeRepo?.id || '',
          branch: activeBranch,
          table,
          primaryKeyValue: pkValue,
          operation: 'DELETE',
          rowSnapshot,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setStagedRowMutations((prev) => [res.data!, ...prev]);
        pushToast('info', 'Row Delete Staged', `Staged DELETE on ${table} (${pkValue}).`);
      } else {
        pushToast(
          'error',
          'Staging Unavailable',
          res.error || 'Cannot stage row deletions without a configured backend.'
        );
      }
      return res;
    },
    [activeBranch, activeRepo?.id, authState.sessionToken, pushToast]
  );

  const stageDdlChange = useCallback(
    async (
      table: string,
      statement: string,
      summary: string
    ): Promise<ServiceOperationResult<StagedDDLChange>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.commits.stageDdlChange(
        {
          repositoryId: activeRepo?.id || '',
          branch: activeBranch,
          table,
          statement,
          summary,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setStagedDdlChanges((prev) => [res.data!, ...prev]);
        pushToast('info', 'DDL Change Staged', summary);
      } else {
        pushToast(
          'error',
          'DDL Staging Unavailable',
          res.error || 'Cannot stage DDL schema changes without a configured backend.'
        );
      }
      return res;
    },
    [activeBranch, activeRepo?.id, authState.sessionToken, pushToast]
  );

  const discardStagedItem = useCallback((id: string) => {
    setStagedRowMutations((prev) => prev.filter((item) => item.id !== id));
    setStagedDdlChanges((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const discardAllStaged = useCallback(() => {
    setStagedRowMutations([]);
    setStagedDdlChanges([]);
  }, []);

  const commitStagedChanges = useCallback(
    async (message: string): Promise<ServiceOperationResult<CommitRecord>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.commits.createCommit(
        {
          repositoryId: activeRepo?.id || '',
          branch: activeBranch,
          message,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setCommits((prev) => [res.data!, ...prev]);
        setStagedRowMutations([]);
        setStagedDdlChanges([]);
        setCommitModalOpen(false);
        pushToast('success', 'Commit Persisted', `Created commit ${res.data.hash}.`);
      } else {
        pushToast(
          'error',
          'Commit Failed',
          res.error || 'Cannot persist commit without a configured VersionDB backend.'
        );
      }
      return res;
    },
    [activeBranch, activeRepo?.id, authState.sessionToken, pushToast]
  );

  // SQL Workspace
  const updateActiveQuerySql = useCallback(
    (sql: string) => {
      setQueryTabs((prev) =>
        prev.map((tab) => (tab.id === activeQueryTabId ? { ...tab, sql, isDirty: true } : tab))
      );
    },
    [activeQueryTabId]
  );

  const addNewQueryTab = useCallback(
    (initialSql?: string, title?: string) => {
      const nextNum = queryTabs.length + 1;
      const newId = `tab-${Date.now()}`;
      const newTab: QueryTab = {
        id: newId,
        title: title || `query_${nextNum}.sql`,
        targetCatalog: activeRepo?.name || '',
        isDirty: Boolean(initialSql),
        sql: initialSql ?? '',
      };
      setQueryTabs((prev) => [...prev, newTab]);
      setActiveQueryTabId(newId);
    },
    [activeRepo?.name, queryTabs.length]
  );

  const closeQueryTab = useCallback(
    (id: string) => {
      if (queryTabs.length <= 1) return;
      const filtered = queryTabs.filter((t) => t.id !== id);
      setQueryTabs(filtered);
      if (activeQueryTabId === id) {
        setActiveQueryTabId(filtered[0].id);
      }
    },
    [activeQueryTabId, queryTabs]
  );

  const cancelActiveQuery = useCallback(() => {
    if (queryAbortControllerRef.current) {
      queryAbortControllerRef.current.abort();
      queryAbortControllerRef.current = null;
      setIsQueryExecuting(false);
      pushToast('info', 'Query Cancelled', 'Active SQL execution request was aborted.');
    }
  }, [pushToast]);

  const executeActiveQuery = useCallback(async (): Promise<
    ServiceOperationResult<QueryExecutionResult>
  > => {
    const activeTab = queryTabs.find((t) => t.id === activeQueryTabId) || queryTabs[0];
    if (!activeTab.sql.trim()) {
      const validationRes: ServiceOperationResult<QueryExecutionResult> = {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        error: 'Enter a SQL statement before executing.',
      };
      pushToast('warning', 'Empty SQL Buffer', validationRes.error!);
      return validationRes;
    }

    if (queryAbortControllerRef.current) {
      queryAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    queryAbortControllerRef.current = controller;

    setIsQueryExecuting(true);
    const res = await versionDbServices.sql.executeQuery(
      {
        repositoryId: activeRepo?.id || '',
        branch: activeBranch,
        sql: activeTab.sql,
      },
      authState.sessionToken,
      controller.signal
    );
    setIsQueryExecuting(false);
    queryAbortControllerRef.current = null;

    if (res.ok && res.data) {
      setLastQueryResult(res.data);
      return res;
    }

    const errResult: QueryExecutionResult = {
      status: 'error',
      rows: [],
      columns: [],
      rowCount: 0,
      totalTableRows: 0,
      executionTimeMs: 0,
      bufferHitsPct: 0,
      memoryMb: 0,
      targetTable: '',
      explainPlan: [],
      messages: [],
      errorMessage:
        res.error || 'SQL execution failed because the backend query engine is not configured.',
      errorCode: res.errorCode || 'UNCONFIGURED_BACKEND',
    };
    setLastQueryResult(errResult);
    pushToast('error', 'Query Execution Failed', errResult.errorMessage!);
    return res;
  }, [activeBranch, activeQueryTabId, activeRepo?.id, authState.sessionToken, pushToast, queryTabs]);

  // Merge Requests, Conflicts, Admin Approvals, Rollbacks, Roles
  const createMergeRequest = useCallback(
    async (
      title: string,
      description: string,
      sourceBranch: string,
      targetBranch: string
    ): Promise<ServiceOperationResult<MergeRequest>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.mergeRequests.createMergeRequest(
        {
          repositoryId: activeRepo?.id || '',
          title,
          description,
          sourceBranch,
          targetBranch,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setMergeRequests((prev) => [res.data!, ...prev]);
        setSelectedMrNumber(res.data.number);
        setCreateMrModalOpen(false);
        pushToast('success', 'Merge Request Created', `Opened MR #${res.data.number}.`);
      } else {
        pushToast(
          'error',
          'Merge Request Failed',
          res.error || 'Backend merge request service is not configured.'
        );
      }
      return res;
    },
    [activeRepo?.id, authState.sessionToken, pushToast]
  );

  const approveMergeRequest = useCallback(
    async (mrNumber: number): Promise<ServiceOperationResult<MergeRequest>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.mergeRequests.approveMergeRequest(
        mrNumber,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setMergeRequests((prev) => prev.map((mr) => (mr.number === mrNumber ? res.data! : mr)));
        pushToast('success', 'Review Recorded', `Approved MR #${mrNumber}.`);
      } else {
        pushToast(
          'error',
          'Review Approval Failed',
          res.error || 'Backend review service is not configured.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const resolveConflictItem = useCallback(
    async (
      conflictId: string,
      mode: 'OURS' | 'THEIRS' | 'MANUAL',
      manualValues?: Record<string, string>,
      auditNote?: string
    ): Promise<ServiceOperationResult<ConflictItem>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.mergeRequests.resolveConflict(
        { conflictId, mode, manualValues, auditNote },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setConflicts((prev) => prev.map((c) => (c.id === conflictId ? res.data! : c)));
        pushToast('success', 'Conflict Resolved', `Resolved conflict ${conflictId}.`);
      } else {
        pushToast(
          'error',
          'Conflict Resolution Failed',
          res.error || 'Backend conflict resolution service is not configured.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const escalateConflictToAdmin = useCallback(
    async (conflictId: string, reason: string): Promise<ServiceOperationResult> => {
      setIsOperationPending(true);
      const res = await versionDbServices.governance.decideAdminEscalation(
        {
          approvalId: conflictId,
          decision: 'APPROVED',
          reason,
        },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (!res.ok) {
        pushToast(
          'error',
          'Escalation Failed',
          res.error || 'Backend governance escalation service is not configured.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const decideAdminApproval = useCallback(
    async (
      approvalId: string,
      decision: 'APPROVED' | 'REJECTED',
      reason: string
    ): Promise<ServiceOperationResult<AdminApprovalItem>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.governance.decideAdminEscalation(
        { approvalId, decision, reason },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setAdminApprovals((prev) => prev.map((a) => (a.id === approvalId ? res.data! : a)));
        pushToast('success', 'Escalation Decided', `Recorded ${decision} decision.`);
      } else {
        pushToast(
          'error',
          'Escalation Decision Failed',
          res.error || 'Backend Lead DBA escalation service is not configured.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const executeMerge = useCallback(
    async (mrNumber: number): Promise<ServiceOperationResult<MergeRequest>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.mergeRequests.mergeBranch(
        mrNumber,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setMergeRequests((prev) => prev.map((mr) => (mr.number === mrNumber ? res.data! : mr)));
        pushToast('success', 'Merge Completed', `MR #${mrNumber} merged on backend.`);
      } else {
        pushToast(
          'error',
          'Merge Failed',
          res.error || 'Cannot execute branch merge without a configured backend.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const executeRollbackToSnapshot = useCallback(
    async (
      snapshotId: string,
      reason: string
    ): Promise<ServiceOperationResult<HistoricalSnapshot>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.governance.executeRollback(
        { snapshotId, reason },
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setRollbackModalOpen(false);
        pushToast('success', 'Rollback Executed', `Restored checkpoint ${res.data.ref}.`);
      } else {
        pushToast(
          'error',
          'Rollback Unavailable',
          res.error || 'Cannot execute point-in-time rollback without a configured backend.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const updateUserRole = useCallback(
    async (userId: string, newRole: UserRole): Promise<ServiceOperationResult<UserProfile>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.governance.updateMemberRole(
        userId,
        newRole,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (res.ok && res.data) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? res.data! : u)));
        pushToast('success', 'Role Updated', `Updated role to ${newRole}.`);
      } else {
        pushToast(
          'error',
          'Role Update Failed',
          res.error || 'Cannot modify RBAC roles without an authoritative backend.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const exportAuditLedger = useCallback(
    async (format: 'json' | 'csv'): Promise<ServiceOperationResult<{ downloadUrl: string }>> => {
      setIsOperationPending(true);
      const res = await versionDbServices.governance.exportAuditLogs(
        format,
        authState.sessionToken
      );
      setIsOperationPending(false);

      if (!res.ok) {
        pushToast(
          'error',
          'Audit Export Unavailable',
          res.error || 'Audit log export requires a connected VersionDB backend.'
        );
      }
      return res;
    },
    [authState.sessionToken, pushToast]
  );

  const value: VersionDbContextValue = {
    activeScreen,
    previousScreen,
    navigateTo,
    navigateBack,

    apiBaseUrl: envConfig.apiBaseUrl,
    isBackendConfigured: envConfig.isBackendConfigured,
    backendConnectionState,
    lastBackendError,
    isCatalogLoading,
    isOperationPending,
    refreshWorkspaceCatalog,

    authState,
    uiRoleHint,
    currentUser,
    users,
    roleCapabilities,
    switchUserOrRole,
    signInWithBackend,
    registerWithBackend,
    signOutSession,
    requestPasswordReset,
    resetPasswordWithToken,

    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    uiPreferences,
    updateUiPreferences,

    repositories,
    activeRepo,
    selectRepository,
    createRepository,
    setRepositoryConnectionMode,

    branches,
    activeBranch,
    selectBranch,
    compareTargetBranch,
    setCompareTargetBranch,
    createBranch,

    tables,
    views,
    selectedTableName,
    setSelectedTableName,
    tableRowsByTable,

    stagedRowMutations,
    stagedDdlChanges,
    stageRowEdit,
    stageInsertRow,
    stageDeleteRow,
    stageDdlChange,
    discardStagedItem,
    discardAllStaged,
    commitStagedChanges,

    queryTabs,
    activeQueryTabId,
    setActiveQueryTabId,
    updateActiveQuerySql,
    addNewQueryTab,
    closeQueryTab,
    lastQueryResult,
    isQueryExecuting,
    executeActiveQuery,
    cancelActiveQuery,

    commits,
    mergeRequests,
    selectedMrNumber,
    setSelectedMrNumber,
    conflicts,
    selectedConflictId,
    setSelectedConflictId,
    adminApprovals,
    snapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    auditLogs,
    schemaVersions,
    lineageNodes,
    apiContracts: BACKEND_INTEGRATION_CONTRACT,

    createMergeRequest,
    approveMergeRequest,
    resolveConflictItem,
    escalateConflictToAdmin,
    decideAdminApproval,
    executeMerge,
    executeRollbackToSnapshot,
    updateUserRole,
    exportAuditLedger,

    isCommitModalOpen,
    setCommitModalOpen,
    isCreateBranchModalOpen,
    setCreateBranchModalOpen,
    isCreateMrModalOpen,
    setCreateMrModalOpen,
    isCreateRepoModalOpen,
    setCreateRepoModalOpen,
    isRollbackModalOpen,
    setRollbackModalOpen,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    isApiContractDrawerOpen,
    setApiContractDrawerOpen,

    toasts,
    pushToast,
    dismissToast,
  };

  return <VersionDbContext.Provider value={value}>{children}</VersionDbContext.Provider>;
};

export function useVersionDb(): VersionDbContextValue {
  const ctx = useContext(VersionDbContext);
  if (!ctx) {
    throw new Error('useVersionDb must be used inside VersionDbProvider');
  }
  return ctx;
}
