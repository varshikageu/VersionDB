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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Organization Context
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Workspace & Project Selector
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Select a registered database repository or inspect backend integration status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repositories..."
            className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 font-body-sm text-xs text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setCreateRepoModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
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
                className={`p-5 rounded-xl bg-surface-container-lowest border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary/20 shadow-sm'
                    : 'border-outline-variant/25 hover:border-outline-variant/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-code-sm text-sm font-bold text-on-surface">
                      {repo.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-label-mono uppercase text-secondary">
                      {repo.environment}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-secondary mb-4">
                    {repo.engine} {repo.engineVersion} • {repo.region}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    selectRepository(repo.id);
                    navigateTo('overview');
                  }}
                  className="w-full py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/25"
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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Getting Started
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Repository Setup & Onboarding
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Follow these steps to connect a live VersionDB backend and register your first database.
          </p>
        </div>
        <span className="px-3 py-1 rounded-lg bg-surface-container-low border border-outline-variant/25 font-code-sm text-xs text-secondary">
          Endpoint: {apiBaseUrl || 'Unconfigured'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-code-sm text-xs font-bold text-primary">STEP {step.num}</span>
                <span
                  className={`px-2 py-0.5 rounded font-label-mono text-[10px] uppercase font-semibold ${
                    step.completed
                      ? 'bg-[#dcfce7] text-[#15803d]'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {step.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <h3 className="font-headline text-title-md text-on-surface">{step.title}</h3>
              <p className="font-body-sm text-xs text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={step.onAction}
                className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/25 transition-colors"
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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Operational Feed
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">Notifications Center</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Real-time alerts for merge conflicts, review requests, commits, and RBAC events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25"
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
            className={`px-3 py-1 rounded-md font-label-mono text-xs uppercase transition-colors ${
              categoryFilter === cat
                ? 'bg-primary text-white font-semibold'
                : 'bg-surface-container-low text-secondary hover:text-on-surface'
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
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 divide-y divide-surface-container">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-start justify-between gap-4 ${
                !item.read ? 'bg-primary-fixed/10' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-headline text-body-md font-semibold text-on-surface">
                    {item.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-[10px] text-secondary">
                    {item.resourceLabel}
                  </span>
                </div>
                <p className="font-body-sm text-xs text-secondary">{item.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    markNotificationAsRead(item.id);
                    navigateTo(item.targetScreen);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-medium text-primary"
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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Account & Preferences
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            User Profile & Workspace Preferences
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            View current session authentication state and configure local UI preferences.
          </p>
        </div>
        {authState.isAuthenticated ? (
          <button
            type="button"
            onClick={() => void signOutSession()}
            className="px-3.5 py-2 rounded-lg bg-error text-white font-body-sm text-xs font-semibold"
          >
            Sign Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-xs font-semibold"
          >
            Sign In to Backend
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-4">
          <h2 className="font-headline text-title-md text-on-surface">
            Authentication Session Status
          </h2>
          {!authState.isAuthenticated ? (
            <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/25 space-y-2">
              <div className="font-headline text-body-sm font-semibold text-on-surface">
                Not Authenticated
              </div>
              <p className="font-body-sm text-xs text-secondary leading-relaxed">
                No active backend user session is present. The active UI Role Hint (
                <code className="font-code-sm text-primary">{currentUser.role}</code>) only previews
                role-specific interface layouts and does not represent a logged-in account.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs font-code-sm">
              <div className="flex justify-between py-1.5 border-b border-surface-container">
                <span className="text-secondary">Authenticated User:</span>
                <span className="text-on-surface font-semibold">{currentUser.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container">
                <span className="text-secondary">Email:</span>
                <span className="text-on-surface">{currentUser.email}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-secondary">Authoritative Role:</span>
                <span className="text-primary font-semibold">{currentUser.role}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-4">
          <h2 className="font-headline text-title-md text-on-surface">
            Local Workspace UI Preferences
          </h2>
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between py-2 border-b border-surface-container cursor-pointer">
              <span className="text-on-surface font-medium">Show SQL Editor Line Numbers</span>
              <input
                type="checkbox"
                checked={uiPreferences.showLineNumbers}
                onChange={(e) => updateUiPreferences({ showLineNumbers: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between py-2 border-b border-surface-container cursor-pointer">
              <span className="text-on-surface font-medium">
                Require Confirmation on Rollback & Merge Actions
              </span>
              <input
                type="checkbox"
                checked={uiPreferences.confirmDestructiveActions}
                onChange={(e) =>
                  updateUiPreferences({ confirmDestructiveActions: e.target.checked })
                }
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
