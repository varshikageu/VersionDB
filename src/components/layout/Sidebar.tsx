import React from 'react';
import { useVersionDb } from '../../context/VersionDbContext';
import { ScreenPath } from '../../types/versiondb';

interface NavItem {
  path: ScreenPath;
  label: string;
  icon: string;
  iconColorClass?: string;
  badgeType?: 'mrs' | 'conflicts' | 'approvals' | 'notifications';
  requiresAdminHint?: boolean;
}

const CORE_ITEMS: NavItem[] = [
  { path: 'overview', label: 'Overview', icon: 'dashboard' },
  { path: 'workspaces', label: 'Workspaces', icon: 'workspaces' },
  { path: 'repositories', label: 'Repositories', icon: 'dns' },
  { path: 'sql-workspace', label: 'SQL Workspace', icon: 'terminal' },
  { path: 'schema-explorer', label: 'Schema Explorer', icon: 'schema' },
  { path: 'table-data', label: 'Table Data', icon: 'table_rows' },
  { path: 'branches', label: 'Branches', icon: 'account_tree' },
  { path: 'commits-and-history', label: 'Commits & History', icon: 'commit' },
  { path: 'changes-and-diff', label: 'Changes & Diff', icon: 'difference' },
  { path: 'merge-requests', label: 'Merge Requests', icon: 'merge', badgeType: 'mrs' },
  {
    path: 'conflict-resolution',
    label: 'Conflict Resolution',
    icon: 'warning',
    iconColorClass: 'text-[#d97706]',
    badgeType: 'conflicts',
  },
];

const GOVERNANCE_ITEMS: NavItem[] = [
  {
    path: 'admin-approvals',
    label: 'Admin Approvals',
    icon: 'verified_user',
    badgeType: 'approvals',
    requiresAdminHint: true,
  },
  {
    path: 'time-machine',
    label: 'Time Machine',
    icon: 'history',
    requiresAdminHint: true,
  },
  { path: 'data-lineage', label: 'Data Lineage', icon: 'hub' },
  { path: 'schema-versions', label: 'Schema Versions', icon: 'sell' },
  { path: 'audit-logs', label: 'Audit Logs', icon: 'fact_check' },
  { path: 'members-and-permissions', label: 'Members & RBAC', icon: 'group' },
  {
    path: 'notifications',
    label: 'Notifications',
    icon: 'notifications',
    badgeType: 'notifications',
  },
  { path: 'profile', label: 'Profile & Account', icon: 'manage_accounts' },
  { path: 'settings', label: 'Settings', icon: 'settings' },
];

export const Sidebar: React.FC = () => {
  const {
    activeScreen,
    navigateTo,
    activeRepo,
    isBackendConfigured,
    mergeRequests,
    conflicts,
    adminApprovals,
    unreadNotificationsCount,
    roleCapabilities,
    setCreateBranchModalOpen,
  } = useVersionDb();

  const openMrCount = mergeRequests.filter((m) => m.status !== 'MERGED').length;
  const unresolvedConflictCount = conflicts.filter((c) => !c.resolved).length;
  const pendingApprovalsCount = adminApprovals.filter((a) => a.status === 'PENDING').length;

  const renderBadge = (type?: NavItem['badgeType']) => {
    if (!type) return null;
    if (type === 'mrs' && openMrCount > 0) {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-code-sm rounded bg-primary-fixed text-primary font-semibold">
          {openMrCount}
        </span>
      );
    }
    if (type === 'conflicts' && unresolvedConflictCount > 0) {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-code-sm rounded bg-error-container text-on-error-container font-semibold">
          {unresolvedConflictCount}
        </span>
      );
    }
    if (type === 'approvals' && pendingApprovalsCount > 0) {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-code-sm rounded bg-[#fef3c7] text-[#b45309] font-semibold">
          {pendingApprovalsCount}
        </span>
      );
    }
    if (type === 'notifications' && unreadNotificationsCount > 0) {
      return (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-code-sm rounded bg-primary/15 text-primary font-semibold">
          {unreadNotificationsCount}
        </span>
      );
    }
    return null;
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeScreen === item.path;
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => navigateTo(item.path)}
        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md transition-all text-left ${
          isActive
            ? 'text-blue-600 bg-blue-50/80 font-semibold border-l-2 border-blue-600'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        }`}
      >
        <span
          className={`material-symbols-outlined text-lg ${
            isActive ? 'text-blue-600' : item.iconColorClass || ''
          }`}
        >
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
        {item.requiresAdminHint && !roleCapabilities.canAdminApproveEscalation && (
          <span
            className="ml-auto material-symbols-outlined text-[13px] text-secondary/70"
            title="Requires Admin / Lead DBA authorization on backend"
          >
            lock
          </span>
        )}
        {renderBadge(item.badgeType)}
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-slate-50 border-r border-surface-container flex flex-col justify-between p-3 z-30 font-['Inter'] text-xs font-medium select-none overflow-y-auto">
      <div className="space-y-5">
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-['JetBrains_Mono']">
            Core Operations
          </div>
          {CORE_ITEMS.map(renderItem)}
        </div>

        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-['JetBrains_Mono']">
            Governance & System
          </div>
          {GOVERNANCE_ITEMS.map(renderItem)}
        </div>
      </div>

      {/* Bottom Primary Action & Truthful Snapshot Storage Footer */}
      <div className="pt-3 border-t border-slate-200/70 space-y-2.5 mt-4">
        <button
          type="button"
          onClick={() => setCreateBranchModalOpen(true)}
          className="w-full py-2 px-3 bg-gradient-to-b from-primary to-primary-container text-on-primary rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>New Branch</span>
        </button>

        <div className="px-2 py-1.5 rounded-md bg-white border border-outline-variant/25 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-['JetBrains_Mono']">
            <span className="uppercase">Snapshot Storage</span>
            <span>
              {activeRepo
                ? `${activeRepo.snapshotDiskUsedGb} GB / ${activeRepo.snapshotDiskTotalGb} GB`
                : '— / —'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all"
              style={{
                width:
                  activeRepo && activeRepo.snapshotDiskTotalGb > 0
                    ? `${Math.min(
                        100,
                        Math.round(
                          (activeRepo.snapshotDiskUsedGb / activeRepo.snapshotDiskTotalGb) * 100
                        )
                      )}%`
                    : '0%',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-code-sm text-secondary pt-0.5">
            <span>WAL Checkpoint:</span>
            <span className="text-primary font-semibold">
              {activeRepo
                ? activeRepo.latestSnapshotRef
                : isBackendConfigured
                  ? 'No Repo'
                  : 'Unconfigured'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
