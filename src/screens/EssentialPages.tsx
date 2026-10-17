import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const WorkspacesScreen: React.FC = () => {
  const {
    repositories,
    activeRepo,
    selectRepository,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setCreateRepoModalOpen,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [search, setSearch] = useState('');

  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.environment.toLowerCase().includes(search.toLowerCase()) ||
      r.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Organization Context
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Workspace & Project Selector
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Select a registered database repository or inspect backend integration status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter repositories..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] w-52 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateRepoModalOpen(true)}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            Register Repository
          </button>
        </div>
      </div>

      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={3} columns={4} />
      ) : filteredRepos.length === 0 ? (
        <EmptyStateCard
          icon="folder_off"
          title={
            repositories.length === 0
              ? 'No Database Repositories Available'
              : `No repositories match "${search}"`
          }
          description={
            repositories.length === 0
              ? 'No repositories are loaded because no backend service is configured or no databases have been registered yet.'
              : 'Clear the search filter to view available repositories.'
          }
          actionLabel={repositories.length === 0 ? 'Register Repository' : 'Clear Filter'}
          onAction={() => {
            if (repositories.length === 0) {
              setCreateRepoModalOpen(true);
            } else {
              setSearch('');
            }
          }}
          secondaryActionLabel="Onboarding Checklist"
          onSecondaryAction={() => navigateTo('onboarding')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => {
            const isSelected = activeRepo?.id === repo.id;
            return (
              <div
                key={repo.id}
                className={`p-5 rounded-xl bg-white border transition-all flex flex-col justify-between shadow-[0_1px_3px_rgba(16,23,42,0.04)] ${
                  isSelected
                    ? 'border-[#2563eb] ring-1 ring-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.08)]'
                    : 'border-[#e2e5f6] hover:border-[#b3c5ff]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[14px] font-bold text-[#10172a]">
                      {repo.name}
                    </span>
                    <span className="badge badge-neutral">
                      {repo.environment}
                    </span>
                  </div>
                  <p className="font-mono text-[12px] text-[#5263a0] mb-4">
                    {repo.engine} {repo.engineVersion} • {repo.region}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    selectRepository(repo.id);
                    navigateTo('overview');
                  }}
                  className={`w-full py-2 rounded-lg font-medium text-[12px] transition-colors border ${
                    isSelected
                      ? 'bg-[#eff4ff] text-[#2563eb] border-[#c2d4ff]'
                      : 'bg-white hover:bg-[#f8f9ff] text-[#10172a] border-[#e2e5f6]'
                  }`}
                >
                  {isSelected ? 'Active Workspace' : 'Switch to Workspace'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const OnboardingScreen: React.FC = () => {
  const {
    isBackendConfigured,
    apiBaseUrl,
    repositories,
    branches,
    commits,
    setCreateRepoModalOpen,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const steps = [
    {
      num: '01',
      title: 'Configure Backend API Endpoint (VITE_API_BASE_URL)',
      description:
        'Point VersionDB at your backend server via VITE_API_BASE_URL so authentication, catalog introspection, and branch operations can execute.',
      completed: isBackendConfigured,
      actionLabel: 'Inspect Backend Contract',
      onAction: () => setApiContractDrawerOpen(true),
    },
    {
      num: '02',
      title: 'Register a PostgreSQL Database Repository',
      description:
        'Connect a live PostgreSQL instance to initialize the protected default branch and schema catalog.',
      completed: repositories.length > 0,
      actionLabel: 'Register Repository',
      onAction: () => setCreateRepoModalOpen(true),
    },
    {
      num: '03',
      title: 'Create an Isolated Database Branch',
      description:
        'Branch off your default branch before running DDL migrations or staging row edits.',
      completed: branches.length > 1,
      actionLabel: 'Go to Branches',
      onAction: () => navigateTo('branches'),
    },
    {
      num: '04',
      title: 'Stage Changes & Persist an Immutable Commit',
      description:
        'Stage SQL schema or table record changes and commit a versioned database snapshot.',
      completed: commits.length > 0,
      actionLabel: 'Open SQL Workspace',
      onAction: () => navigateTo('sql-workspace'),
    },
  ];

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Getting Started
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Repository Setup & Onboarding
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Follow these steps to connect a live VersionDB backend and register your first database.
          </p>
        </div>
        <span className="badge badge-neutral font-mono text-[11px]">
          Endpoint: {apiBaseUrl || 'Unconfigured'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="p-5 rounded-xl bg-white border border-[#e2e5f6] flex flex-col justify-between space-y-4 shadow-[0_1px_3px_rgba(16,23,42,0.04)]"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] font-bold text-[#2563eb]">STEP {step.num}</span>
                <span
                  className={`badge ${
                    step.completed ? 'badge-emerald' : 'badge-neutral'
                  }`}
                >
                  {step.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-[#10172a]">{step.title}</h3>
              <p className="text-[12px] text-[#5263a0] leading-relaxed">
                {step.description}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={step.onAction}
                className="btn-secondary text-[12px] py-1.5"
              >
                {step.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const NotificationsScreen: React.FC = () => {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filtered = notifications.filter((n) =>
    categoryFilter === 'ALL' ? true : n.category === categoryFilter
  );

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Operational Feed
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">Notifications Center</h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Real-time alerts for merge conflicts, review requests, commits, and RBAC events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              className="btn-secondary text-[12px] py-1.5"
            >
              Mark all as read ({unreadNotificationsCount})
            </button>
          )}
        </div>
      </div>

      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {(['ALL', 'conflict', 'merge-request', 'commit', 'security'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-lg font-mono text-[11px] uppercase font-semibold transition-all ${
              categoryFilter === cat
                ? 'bg-[#10172a] text-white shadow-xs'
                : 'bg-white text-[#5263a0] border border-[#e2e5f6] hover:text-[#10172a]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : filtered.length === 0 ? (
        <EmptyStateCard
          icon="notifications_none"
          title="No Operational Notifications"
          description="There are no notifications in this category. Notifications are populated by real backend events when a VersionDB server is connected."
        />
      ) : (
        <div className="vdb-card overflow-hidden divide-y divide-[#f1f3fb]">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                !item.read ? 'bg-[#eff4ff]/40' : 'hover:bg-[#f8f9ff]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#10172a]">
                    {item.title}
                  </span>
                  <span className="badge badge-neutral">
                    {item.resourceLabel}
                  </span>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-[#2563eb]"></span>}
                </div>
                <p className="text-[12px] text-[#5263a0]">{item.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    markNotificationAsRead(item.id);
                    navigateTo(item.targetScreen);
                  }}
                  className="btn-secondary text-[12px] py-1 px-3 text-[#2563eb] border-[#c2d4ff] hover:bg-[#eff4ff]"
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileAccountScreen: React.FC = () => {
  const {
    authState,
    currentUser,
    uiPreferences,
    updateUiPreferences,
    signOutSession,
    navigateTo,
  } = useVersionDb();

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Account & Preferences
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            User Profile & Workspace Preferences
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            View current session authentication state and configure local UI preferences.
          </p>
        </div>
        {authState.isAuthenticated ? (
          <button
            type="button"
            onClick={() => void signOutSession()}
            className="btn-primary bg-red-600 hover:bg-red-700 text-white"
          >
            Sign Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className="btn-primary"
          >
            Sign In to Backend
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="vdb-card p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#10172a] pb-2 border-b border-[#f1f3fb]">
            Authentication Session Status
          </h2>
          {!authState.isAuthenticated ? (
            <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e5f6] space-y-2">
              <div className="text-[13px] font-semibold text-[#10172a]">
                Not Authenticated
              </div>
              <p className="text-[12px] text-[#5263a0] leading-relaxed">
                No active backend user session is present. The active UI Role Hint (
                <code className="font-mono text-[#2563eb]">{currentUser.role}</code>) only previews
                role-specific interface layouts and does not represent a logged-in account.
              </p>
            </div>
          ) : (
            <div className="space-y-2 font-mono text-[12px]">
              <div className="flex justify-between py-1.5 border-b border-[#f8f9ff]">
                <span className="text-[#5263a0]">Authenticated User:</span>
                <span className="text-[#10172a] font-semibold">{currentUser.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#f8f9ff]">
                <span className="text-[#5263a0]">Email:</span>
                <span className="text-[#10172a]">{currentUser.email}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#5263a0]">Authoritative Role:</span>
                <span className="text-[#2563eb] font-semibold">{currentUser.role}</span>
              </div>
            </div>
          )}
        </div>

        <div className="vdb-card p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#10172a] pb-2 border-b border-[#f1f3fb]">
            Local Workspace UI Preferences
          </h2>
          <div className="space-y-3 text-[12px]">
            <label className="flex items-center justify-between py-2 border-b border-[#f8f9ff] cursor-pointer">
              <span className="text-[#10172a] font-medium">Show SQL Editor Line Numbers</span>
              <input
                type="checkbox"
                checked={uiPreferences.showLineNumbers}
                onChange={(e) => updateUiPreferences({ showLineNumbers: e.target.checked })}
                className="w-4 h-4 rounded text-[#2563eb] focus:ring-[#2563eb]/20 border-[#c5c9e4]"
              />
            </label>
            <label className="flex items-center justify-between py-2 border-b border-[#f8f9ff] cursor-pointer">
              <span className="text-[#10172a] font-medium">
                Require Confirmation on Rollback & Merge Actions
              </span>
              <input
                type="checkbox"
                checked={uiPreferences.confirmDestructiveActions}
                onChange={(e) =>
                  updateUiPreferences({ confirmDestructiveActions: e.target.checked })
                }
                className="w-4 h-4 rounded text-[#2563eb] focus:ring-[#2563eb]/20 border-[#c5c9e4]"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
