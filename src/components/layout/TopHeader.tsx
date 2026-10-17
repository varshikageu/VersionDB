import React, { useEffect, useRef, useState } from 'react';
import { VersionDbLogo } from '../common/VersionDbLogo';
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
    connectionDiagnostics,
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

  // Connection badge
  const connectionBadge = (() => {
    const diag = connectionDiagnostics;
    if (diag.status === 'unconfigured' || (!isBackendConfigured && backendConnectionState === 'unconfigured')) {
      return { label: 'Not Configured', dotClass: 'status-dot-yellow', pillClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (diag.status === 'checking') {
      return { label: 'Checking…', dotClass: 'status-dot-blue', pillClass: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
    if (diag.status === 'connected' && diag.latencyMs !== null) {
      return { label: `${diag.latencyMs}ms`, dotClass: 'status-dot-green', pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    }
    if (diag.status === 'degraded' && diag.latencyMs !== null) {
      return { label: `Slow (${diag.latencyMs}ms)`, dotClass: 'status-dot-yellow', pillClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Unavailable', dotClass: 'status-dot-red', pillClass: 'bg-red-50 text-red-700 border-red-100' };
  })();

  const availableRoles: UserRole[] = ['Admin', 'Reviewer', 'Developer', 'Viewer'];

  const closeAllMenus = () => {
    setRepoMenuOpen(false);
    setBranchMenuOpen(false);
    setRoleMenuOpen(false);
    setNotifOpen(false);
  };

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md z-40 flex items-center justify-between px-4 border-b border-[#e2e5f6] shadow-[0_1px_3px_rgba(16,23,42,0.04)]"
    >
      {/* Left: Brand + Selectors */}
      <div className="flex items-center gap-2">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="flex items-center gap-2 focus:outline-none"
        >
          <VersionDbLogo size={26} className="bg-[#10172a] text-white rounded-lg" />
          <span className="text-[15px] font-bold tracking-tight text-[#10172a]">
            VersionDB
          </span>
        </button>

        <span className="text-[#e2e5f6] mx-1 text-lg font-light hidden sm:block">/</span>

        {/* Repository Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setRepoMenuOpen((v) => !v); setBranchMenuOpen(false); setRoleMenuOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-1.5 bg-[#f5f6ff] hover:bg-[#eff4ff] border border-[#d4d8f0] hover:border-[#b3c5ff] px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[#10172a] transition-all max-w-[200px]"
          >
            <span className="material-symbols-outlined text-[14px] text-[#2563eb] flex-shrink-0">dns</span>
            <span className="font-mono truncate">
              {activeRepo ? activeRepo.name : 'No Repository'}
            </span>
            {activeRepo && (
              <span className="badge badge-gray text-[10px] px-1.5 py-0 hidden md:inline-flex">
                {activeRepo.environment}
              </span>
            )}
            <span className="material-symbols-outlined text-[14px] text-[#8890b8] flex-shrink-0">expand_more</span>
          </button>

          {repoMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 vdb-dropdown z-50">
              <div className="px-3 py-2 border-b border-[#f1f3fb] flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8890b8]">Repositories</span>
                <button
                  type="button"
                  onClick={() => { closeAllMenus(); navigateTo('repositories'); }}
                  className="text-[11px] font-semibold text-[#2563eb] hover:underline"
                >
                  Manage All
                </button>
              </div>
              {repositories.length === 0 ? (
                <div className="px-3 py-5 text-center">
                  <div className="text-[13px] font-medium text-[#10172a] mb-1">No Repositories</div>
                  <p className="text-[11px] text-[#5263a0] leading-relaxed">
                    {isBackendConfigured
                      ? 'No repositories returned from the backend.'
                      : 'Configure VITE_API_BASE_URL to connect a VersionDB server.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-[#f1f3fb]">
                  {repositories.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => { selectRepository(repo.id); closeAllMenus(); }}
                      className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-[#f5f6ff] transition-colors ${activeRepo?.id === repo.id ? 'bg-[#eff4ff]' : ''}`}
                    >
                      <div>
                        <div className="text-[12px] font-semibold text-[#10172a] font-mono flex items-center gap-1.5">
                          {repo.name}
                          {activeRepo?.id === repo.id && (
                            <span className="material-symbols-outlined text-[13px] text-[#2563eb]">check</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5263a0] mt-0.5">
                          {repo.engine} {repo.engineVersion} · {repo.region}
                        </div>
                      </div>
                      <span className="badge badge-gray ml-2">{repo.environment}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-2 py-1.5 border-t border-[#f1f3fb] flex gap-1">
                <button
                  type="button"
                  onClick={() => { closeAllMenus(); setCreateRepoModalOpen(true); }}
                  className="flex-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-[#2563eb] hover:bg-[#eff4ff] flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Register Repository
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setBranchMenuOpen((v) => !v); setRepoMenuOpen(false); setRoleMenuOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-1.5 bg-[#f5f6ff] hover:bg-[#eff4ff] border border-[#d4d8f0] hover:border-[#b3c5ff] px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[#10172a] transition-all max-w-[180px]"
          >
            <span className="material-symbols-outlined text-[14px] text-[#2563eb] flex-shrink-0">account_tree</span>
            <span className="font-mono truncate">{activeBranch || 'No Branch'}</span>
            <span className="material-symbols-outlined text-[14px] text-[#8890b8] flex-shrink-0">expand_more</span>
          </button>

          {branchMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 vdb-dropdown z-50">
              <div className="px-3 py-2 border-b border-[#f1f3fb] flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8890b8]">Switch Branch</span>
                <button
                  type="button"
                  onClick={() => { closeAllMenus(); navigateTo('branches'); }}
                  className="text-[11px] font-semibold text-[#2563eb] hover:underline"
                >
                  All Branches
                </button>
              </div>
              {branches.length === 0 ? (
                <div className="px-3 py-5 text-center">
                  <div className="text-[13px] font-medium text-[#10172a] mb-1">No Branches</div>
                  <p className="text-[11px] text-[#5263a0]">Connect a repository to list branches.</p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-[#f1f3fb]">
                  {branches.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => { selectBranch(b.name); closeAllMenus(); }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#f5f6ff] transition-colors ${activeBranch === b.name ? 'bg-[#eff4ff]' : ''}`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[12px] font-mono font-medium text-[#10172a] truncate flex items-center gap-1">
                          {b.name}
                          {b.isProtected && (
                            <span className="material-symbols-outlined text-[11px] text-[#2563eb]">lock</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#5263a0] font-mono mt-0.5 truncate">
                          {b.headCommitHash} · {b.updatedRelative}
                        </div>
                      </div>
                      {activeBranch === b.name && (
                        <span className="material-symbols-outlined text-[14px] text-[#2563eb]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-2 py-1.5 border-t border-[#f1f3fb]">
                <button
                  type="button"
                  onClick={() => { closeAllMenus(); setCreateBranchModalOpen(true); }}
                  className="w-full px-2.5 py-1.5 rounded-md text-[12px] font-medium text-[#2563eb] hover:bg-[#eff4ff] flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">call_split</span>
                  Create New Branch
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connection status pill */}
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${connectionBadge.pillClass}`}
          title="Backend Integration Contract & Service Status"
        >
          <span className={`status-dot ${connectionBadge.dotClass}`} />
          {connectionBadge.label}
        </button>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between bg-[#f5f6ff] hover:bg-[#eff4ff] border border-[#d4d8f0] text-[#8890b8] px-3 py-1.5 rounded-lg text-[12px] transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[15px]">search</span>
            <span>Quick search…</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-[#d4d8f0] text-[#8890b8]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Staged indicator */}
        {stagedTotal > 0 && (
          <button
            type="button"
            onClick={() => navigateTo('changes-and-diff')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dce6ff] text-[#1d4ed8] hover:bg-[#b3c5ff] text-[11px] font-semibold transition-colors border border-[#b3c5ff]"
          >
            <span className="material-symbols-outlined text-[13px]">difference</span>
            {stagedTotal} staged
          </button>
        )}

        {/* API contract */}
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8890b8] hover:text-[#10172a] hover:bg-[#f1f3fb] transition-colors"
          title="Backend Integration Contract"
        >
          <span className="material-symbols-outlined text-[18px]">api</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setNotifOpen((v) => !v); setRepoMenuOpen(false); setBranchMenuOpen(false); setRoleMenuOpen(false); }}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#8890b8] hover:text-[#10172a] hover:bg-[#f1f3fb] transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 vdb-dropdown z-50">
              <div className="px-3 py-2 border-b border-[#f1f3fb] flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#10172a]">
                  Notifications
                  {unreadNotificationsCount > 0 && (
                    <span className="ml-2 badge badge-blue">{unreadNotificationsCount}</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button type="button" onClick={markAllNotificationsAsRead}
                      className="text-[11px] text-[#5263a0] hover:text-[#10172a]">
                      Mark all read
                    </button>
                  )}
                  <button type="button"
                    onClick={() => { closeAllMenus(); navigateTo('notifications'); }}
                    className="text-[11px] font-semibold text-[#2563eb] hover:underline">
                    View all
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#f1f3fb]">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <div className="text-[13px] font-medium text-[#10172a] mb-1">No Notifications</div>
                    <p className="text-[11px] text-[#5263a0]">
                      {isBackendConfigured
                        ? 'No operational alerts from the server.'
                        : 'Connect a VersionDB backend to receive alerts.'}
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { markNotificationAsRead(item.id); closeAllMenus(); navigateTo(item.targetScreen); }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-[#f5f6ff] transition-colors ${!item.read ? 'bg-[#eff4ff]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[#10172a]">{item.title}</span>
                        <span className="text-[10px] font-mono text-[#5263a0] shrink-0">{item.timestampRelative}</span>
                      </div>
                      <p className="text-[11px] text-[#5263a0] mt-0.5 line-clamp-2">{item.message}</p>
                    </button>
                  ))
                )}
              </div>
              {(unresolvedConflictsCount > 0 || openMrsCount > 0) && (
                <div className="px-3 py-2 border-t border-[#f1f3fb] flex items-center justify-between text-[11px] font-mono text-[#5263a0]">
                  <span>Open MRs: {openMrsCount}</span>
                  <span>Conflicts: {unresolvedConflictsCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setRoleMenuOpen((v) => !v); setRepoMenuOpen(false); setBranchMenuOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-[#f5f6ff] hover:bg-[#eff4ff] border border-[#d4d8f0] transition-all"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#e8ebf8] flex items-center justify-center">
                <span className="material-symbols-outlined text-[14px] text-[#5263a0]">person</span>
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[11px] font-semibold text-[#10172a]">
                {authState.isAuthenticated ? currentUser.name : 'Unauthenticated'}
              </span>
              <span className="text-[10px] font-mono text-[#2563eb]">
                {currentUser.role}
              </span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-[#8890b8]">expand_more</span>
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 vdb-dropdown z-50">
              <div className="px-3 py-2.5 border-b border-[#f1f3fb]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8890b8] mb-0.5">
                  UI Role Preview
                </div>
                <p className="text-[11px] text-[#5263a0]">
                  Previews role-conditioned UI only. Does not grant backend permissions.
                </p>
              </div>
              <div className="divide-y divide-[#f1f3fb]">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => { switchUserOrRole(role); closeAllMenus(); }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#f5f6ff] transition-colors ${currentUser.role === role ? 'bg-[#eff4ff]' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px] text-[#8890b8]">badge</span>
                      <span className="text-[12px] font-semibold text-[#10172a]">{role} Layout</span>
                    </div>
                    <span className={`badge text-[10px] ${
                      role === 'Admin' ? 'badge-blue'
                      : role === 'Reviewer' ? 'badge-green'
                      : role === 'Developer' ? 'badge-yellow'
                      : 'badge-gray'
                    }`}>{role}</span>
                  </button>
                ))}
              </div>
              <div className="px-3 py-2.5 border-t border-[#f1f3fb] bg-[#f5f6ff] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#5263a0]">Backend Session</span>
                  <span className={authState.isAuthenticated ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                    {authState.isAuthenticated ? 'Active' : 'Not Authenticated'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button"
                    onClick={() => { closeAllMenus(); navigateTo('profile'); }}
                    className="btn-secondary py-1.5 text-[12px] justify-center">
                    <span className="material-symbols-outlined text-[13px]">manage_accounts</span>
                    Account
                  </button>
                  {authState.isAuthenticated ? (
                    <button type="button"
                      onClick={() => { closeAllMenus(); void signOutSession(); }}
                      className="btn-danger py-1.5 text-[12px] justify-center">
                      <span className="material-symbols-outlined text-[13px]">logout</span>
                      Sign Out
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => { closeAllMenus(); navigateTo('login'); }}
                      className="btn-primary py-1.5 text-[12px] justify-center">
                      <span className="material-symbols-outlined text-[13px]">login</span>
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
