import React, { useEffect, useRef, useState } from 'react';
import { VERSIONDB_LOGO_URL } from '../../config/appConfig';
import { useVersionDb } from '../../context/VersionDbContext';
import { UserRole } from '../../types/versiondb';

export const TopHeader: React.FC = () => {
  const {
    activeRepo,
    repositories,
    selectRepository,
    activeBranch,
    branches,
    selectBranch,
    currentUser,
    switchUserOrRole,
    authState,
    signOutSession,
    backendConnectionState,
    isBackendConfigured,
    mergeRequests,
    conflicts,
    stagedRowMutations,
    stagedDdlChanges,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    navigateTo,
    setCommandPaletteOpen,
    setCreateBranchModalOpen,
    setCreateRepoModalOpen,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setRepoMenuOpen(false);
        setBranchMenuOpen(false);
        setRoleMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unresolvedConflictsCount = conflicts.filter((c) => !c.resolved).length;
  const openMrsCount = mergeRequests.filter((mr) => mr.status !== 'MERGED').length;
  const stagedTotal = stagedRowMutations.length + stagedDdlChanges.length;

  const connectionBadge = (() => {
    if (!isBackendConfigured || backendConnectionState === 'unconfigured') {
      return {
        label: 'Backend Not Configured',
        dotClass: 'bg-[#f59e0b]',
        pillClass: 'bg-[#fffbeb] text-[#b45309] border-[#f59e0b]/30',
      };
    }
    if (backendConnectionState === 'checking') {
      return {
        label: 'Checking Service...',
        dotClass: 'bg-primary animate-pulse',
        pillClass: 'bg-primary-fixed/40 text-primary border-primary/25',
      };
    }
    if (backendConnectionState !== 'connected' || !activeRepo) {
      return {
        label: 'Service Unavailable',
        dotClass: 'bg-error',
        pillClass: 'bg-error-container/50 text-on-error-container border-error/20',
      };
    }
    if (activeRepo.connectionMode === 'connected') {
      return {
        label: `Connected (${activeRepo.latencyMs}ms)`,
        dotClass: 'bg-[#16a34a]',
        pillClass: 'bg-[#f0fdf4] text-[#15803d] border-[#16a34a]/20',
      };
    }
    if (activeRepo.connectionMode === 'read-only') {
      return {
        label: 'Read-Only Replica',
        dotClass: 'bg-[#d97706]',
        pillClass: 'bg-[#fffbeb] text-[#b45309] border-[#d97706]/25',
      };
    }
    return {
      label: 'Disconnected',
      dotClass: 'bg-error',
      pillClass: 'bg-error-container/50 text-on-error-container border-error/20',
    };
  })();

  const availableRoles: UserRole[] = ['Admin', 'Reviewer', 'Developer', 'Viewer'];

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md z-40 flex items-center justify-between px-4 border-b border-surface-container"
    >
      {/* Left: Brand + Repository + Branch Selectors */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-b from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-base">database</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 font-headline">
            VersionDB
          </span>
        </button>

        <div className="h-4 w-[1px] bg-outline-variant/40 mx-1 hidden sm:block" />

        {/* Repository Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setRepoMenuOpen((v) => !v);
              setBranchMenuOpen(false);
              setRoleMenuOpen(false);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-md text-xs font-medium text-on-surface border border-outline-variant/25 transition-colors"
          >
            <span className="material-symbols-outlined text-xs text-primary">dns</span>
            <span className="font-code-sm font-medium max-w-[165px] truncate">
              {activeRepo ? activeRepo.name : 'No Repository Connected'}
            </span>
            {activeRepo && (
              <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] font-label-mono uppercase bg-surface-container-high text-secondary">
                {activeRepo.environment}
              </span>
            )}
            <span className="material-symbols-outlined text-xs text-secondary">expand_more</span>
          </button>

          {repoMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-outline-variant/30 py-1.5 z-50">
              <div className="px-3 py-1.5 border-b border-surface-container flex items-center justify-between">
                <span className="font-label-mono text-label-sm uppercase text-secondary">
                  Database Repositories
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRepoMenuOpen(false);
                    navigateTo('repositories');
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Manage All
                </button>
              </div>
              {repositories.length === 0 ? (
                <div className="px-3 py-4 text-center space-y-1.5">
                  <div className="font-body-sm text-xs font-medium text-on-surface">
                    No Repositories Loaded
                  </div>
                  <p className="font-body-sm text-[11px] text-secondary">
                    {isBackendConfigured
                      ? 'No repositories were returned by the backend server.'
                      : 'Configure VITE_API_BASE_URL to load database repositories from your VersionDB server.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-surface-container/60">
                  {repositories.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => {
                        selectRepository(repo.id);
                        setRepoMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left flex items-start justify-between hover:bg-surface-container-low transition-colors ${
                        activeRepo?.id === repo.id ? 'bg-primary-fixed/25' : ''
                      }`}
                    >
                      <div>
                        <div className="font-code-sm text-xs font-semibold text-on-surface flex items-center gap-1.5">
                          <span>{repo.name}</span>
                          {activeRepo?.id === repo.id && (
                            <span className="material-symbols-outlined text-xs text-primary">
                              check
                            </span>
                          )}
                        </div>
                        <div className="font-body-sm text-[11px] text-secondary mt-0.5">
                          {repo.engine} {repo.engineVersion} • {repo.region}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-label-mono uppercase text-secondary">
                        {repo.environment}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-2 pt-1.5 mt-1 border-t border-surface-container flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRepoMenuOpen(false);
                    setCreateRepoModalOpen(true);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary-fixed/30 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Register Repository...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepoMenuOpen(false);
                    navigateTo('workspaces');
                  }}
                  className="px-2.5 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  Workspaces
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setBranchMenuOpen((v) => !v);
              setRepoMenuOpen(false);
              setRoleMenuOpen(false);
              setNotifOpen(false);
            }}
            className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-md text-xs font-medium text-on-surface border border-outline-variant/25 transition-colors"
          >
            <span className="material-symbols-outlined text-xs text-primary">account_tree</span>
            <span className="font-code-sm max-w-[150px] truncate">
              {activeBranch || 'No Active Branch'}
            </span>
            <span className="material-symbols-outlined text-xs text-secondary">expand_more</span>
          </button>

          {branchMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-outline-variant/30 py-1.5 z-50">
              <div className="px-3 py-1.5 border-b border-surface-container flex items-center justify-between">
                <span className="font-label-mono text-label-sm uppercase text-secondary">
                  Switch Branch
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBranchMenuOpen(false);
                    navigateTo('branches');
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  All Branches
                </button>
              </div>
              {branches.length === 0 ? (
                <div className="px-3 py-4 text-center space-y-1">
                  <div className="font-body-sm text-xs font-medium text-on-surface">
                    No Branches Available
                  </div>
                  <p className="font-body-sm text-[11px] text-secondary">
                    Connect a repository to list or checkout branches.
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-surface-container/60">
                  {branches.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => {
                        selectBranch(b.name);
                        setBranchMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                        activeBranch === b.name ? 'bg-primary-fixed/25' : ''
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-code-sm text-xs font-medium text-on-surface truncate flex items-center gap-1.5">
                          <span>{b.name}</span>
                          {b.isProtected && (
                            <span className="material-symbols-outlined text-[12px] text-primary">
                              lock
                            </span>
                          )}
                        </div>
                        <div className="font-code-sm text-[10px] text-secondary truncate">
                          {b.headCommitHash} • {b.updatedRelative}
                        </div>
                      </div>
                      {activeBranch === b.name && (
                        <span className="material-symbols-outlined text-sm text-primary">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-2 pt-1.5 mt-1 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => {
                    setBranchMenuOpen(false);
                    setCreateBranchModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary-fixed/30 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">call_split</span>
                  Create New Branch...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Truthful Backend / DB Connection Pill */}
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-code-sm transition-colors ${connectionBadge.pillClass}`}
          title="Inspect Backend Integration Contract & Service Status"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${connectionBadge.dotClass}`} />
          <span>{connectionBadge.label}</span>
        </button>
      </div>

      {/* Center: Global Search / Command Palette Trigger */}
      <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between bg-surface-container-low hover:bg-surface-container text-secondary px-3 py-1.5 rounded-lg border border-outline-variant/25 text-xs transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">search</span>
            <span>Jump to screen, action, contract...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-code-sm bg-white rounded border border-outline-variant/30 text-secondary">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Staged Indicator, API Contract, Notifications, and UI Role Preview / Auth */}
      <div className="flex items-center gap-2">
        {stagedTotal > 0 && (
          <button
            type="button"
            onClick={() => navigateTo('changes-and-diff')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-fixed/40 text-primary hover:bg-primary-fixed/70 text-xs font-code-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-xs">difference</span>
            <span>{stagedTotal} staged</span>
          </button>
        )}

        {/* API Contract Drawer Button */}
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="p-1.5 text-secondary hover:text-on-surface hover:bg-surface-container-low rounded-md transition-colors"
          title="Backend Integration Contract"
        >
          <span className="material-symbols-outlined text-lg">api</span>
        </button>

        {/* Notifications Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setRepoMenuOpen(false);
              setBranchMenuOpen(false);
              setRoleMenuOpen(false);
            }}
            className="relative p-1.5 text-secondary hover:text-on-surface hover:bg-surface-container-low rounded-md transition-colors"
            title="Operational Notifications"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50">
              <div className="px-3 py-1.5 border-b border-surface-container flex items-center justify-between">
                <span className="font-label-mono text-label-sm uppercase text-secondary">
                  Notifications ({unreadNotificationsCount} unread)
                </span>
                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      className="text-[11px] font-medium text-secondary hover:text-on-surface"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      navigateTo('notifications');
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    View Center
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-surface-container">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center space-y-1">
                    <div className="font-body-sm text-xs font-medium text-on-surface">
                      No Notifications
                    </div>
                    <p className="font-body-sm text-[11px] text-secondary">
                      {isBackendConfigured
                        ? 'No operational alerts returned from the server.'
                        : 'Operational alerts appear here when a VersionDB backend is connected.'}
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        markNotificationAsRead(item.id);
                        setNotifOpen(false);
                        navigateTo(item.targetScreen);
                      }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-surface-container-low transition-colors ${
                        !item.read ? 'bg-primary-fixed/15' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body-sm text-xs font-semibold text-on-surface">
                          {item.title}
                        </span>
                        <span className="font-code-sm text-[10px] text-secondary">
                          {item.timestampRelative}
                        </span>
                      </div>
                      <p className="font-body-sm text-[11px] text-secondary mt-0.5 line-clamp-2">
                        {item.message}
                      </p>
                    </button>
                  ))
                )}
              </div>
              {(unresolvedConflictsCount > 0 || openMrsCount > 0) && (
                <div className="px-3 pt-2 mt-1 border-t border-surface-container flex items-center justify-between text-[11px] font-code-sm text-secondary">
                  <span>Open MRs: {openMrsCount}</span>
                  <span>Conflicts: {unresolvedConflictsCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* UI Role Preview & Auth Status Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setRoleMenuOpen((v) => !v);
              setRepoMenuOpen(false);
              setBranchMenuOpen(false);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 transition-colors"
            title="UI Role Layout Switcher & Session State"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover border border-primary/20"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-sm">person</span>
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[11px] font-semibold text-on-surface">
                {authState.isAuthenticated ? currentUser.name : 'Unauthenticated'}
              </span>
              <span className="text-[10px] font-label-mono uppercase text-primary">
                UI Hint: {currentUser.role}
              </span>
            </div>
            <span className="material-symbols-outlined text-xs text-secondary">expand_more</span>
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50">
              <div className="px-3 py-2 border-b border-surface-container">
                <div className="font-label-mono text-label-sm uppercase text-secondary">
                  UI Role Presentation Hint
                </div>
                <p className="font-body-sm text-[11px] text-secondary mt-0.5">
                  Previews role-conditioned UI states only. Does not grant backend permissions or authenticate a user.
                </p>
              </div>
              <div className="divide-y divide-surface-container/60">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      switchUserOrRole(role);
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                      currentUser.role === role ? 'bg-primary-fixed/25' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-secondary">
                        badge
                      </span>
                      <span className="font-body-sm text-xs font-semibold text-on-surface">
                        {role} Layout Preview
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-label-mono uppercase font-semibold ${
                        role === 'Admin'
                          ? 'bg-primary-fixed text-primary'
                          : role === 'Reviewer'
                            ? 'bg-[#dcfce7] text-[#15803d]'
                            : role === 'Developer'
                              ? 'bg-[#fef3c7] text-[#b45309]'
                              : 'bg-surface-container-high text-secondary'
                      }`}
                    >
                      {role}
                    </span>
                  </button>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-surface-container bg-surface-container-low/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-code-sm">
                  <span className="text-secondary">Backend Session:</span>
                  <span
                    className={
                      authState.isAuthenticated
                        ? 'text-[#15803d] font-semibold'
                        : 'text-[#b45309] font-semibold'
                    }
                  >
                    {authState.isAuthenticated ? 'Active' : 'Not Authenticated'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMenuOpen(false);
                      navigateTo('profile');
                    }}
                    className="px-2.5 py-1.5 rounded bg-white hover:bg-surface-container text-on-surface border border-outline-variant/25 font-body-sm text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">manage_accounts</span>
                    Account
                  </button>
                  {authState.isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        void signOutSession();
                      }}
                      className="px-2.5 py-1.5 rounded bg-white hover:bg-error-container/30 text-error border border-outline-variant/25 font-body-sm text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">logout</span>
                      Sign Out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        navigateTo('login');
                      }}
                      className="px-2.5 py-1.5 rounded bg-primary text-white hover:opacity-95 font-body-sm text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">login</span>
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
