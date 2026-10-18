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
    label: 'Conflicts',
    icon: 'warning',
    iconColorClass: 'text-amber-500',
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
    currentUser,
    isBackendConfigured,
    mergeRequests,
    conflicts,
    adminApprovals,
    unreadNotificationsCount,
    roleCapabilities,
    setCreateBranchModalOpen,
  } = useVersionDb();

  const role = currentUser.role;

  const openMrCount = mergeRequests.filter((m) => m.status !== 'MERGED').length;
  const unresolvedConflictCount = conflicts.filter((c) => !c.resolved).length;
  const pendingApprovalsCount = adminApprovals.filter((a) => a.status === 'PENDING').length;

  const renderBadge = (type?: NavItem['badgeType']) => {
    if (!type) return null;
    const count =
      type === 'mrs' ? openMrCount
      : type === 'conflicts' ? unresolvedConflictCount
      : type === 'approvals' ? pendingApprovalsCount
      : type === 'notifications' ? unreadNotificationsCount
      : 0;
    if (count <= 0) return null;

    const cls =
      type === 'conflicts'
        ? 'bg-red-50 text-red-700 border border-red-100'
        : type === 'approvals'
        ? 'bg-amber-50 text-amber-700 border border-amber-100'
        : 'bg-blue-50 text-blue-700 border border-blue-100';

    return (
      <span
        className={`ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full font-mono ${cls}`}
      >
        {count}
      </span>
    );
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeScreen === item.path;
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => navigateTo(item.path)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all text-left text-[13px] ${
          isActive
            ? 'bg-[#eff4ff] text-[#1d4ed8] font-semibold'
            : 'text-[#3d4769] hover:text-[#10172a] hover:bg-[#f1f3fb] font-medium'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[17px] flex-shrink-0 ${
            isActive
              ? 'text-[#2563eb]'
              : item.iconColorClass || 'text-[#8890b8]'
          }`}
        >
          {item.icon}
        </span>
        <span className="truncate flex-1">{item.label}</span>
        {item.requiresAdminHint && !roleCapabilities.canAdminApproveEscalation && (
          <span
            className="material-symbols-outlined text-[12px] text-[#c5c9e4]"
            title="Requires Admin authorization"
          >
            lock
          </span>
        )}
        {renderBadge(item.badgeType)}
      </button>
    );
  };

  // Build role-specific navigation lists
  const coreNavItems: NavItem[] =
    role === 'Admin'
      ? [
          { path: 'admin-dashboard', label: 'Admin Overview', icon: 'dashboard' },
          { path: 'members-and-permissions', label: 'User Management', icon: 'manage_accounts' },
          { path: 'repositories', label: 'Repositories', icon: 'dns' },
          { path: 'admin-approvals', label: 'Escalation Approvals', icon: 'verified_user', badgeType: 'approvals' },
          { path: 'audit-logs', label: 'Audit Logs', icon: 'fact_check' },
        ]
      : role === 'Reviewer'
      ? [
          { path: 'reviewer-dashboard', label: 'Reviewer Overview', icon: 'rate_review' },
          { path: 'merge-requests', label: 'Review Queue', icon: 'merge', badgeType: 'mrs' },
          { path: 'changes-and-diff', label: 'Changes & Diff', icon: 'difference' },
          { path: 'commits-and-history', label: 'Commit History', icon: 'commit' },
          { path: 'repositories', label: 'Repositories', icon: 'dns' },
          { path: 'branches', label: 'Branches', icon: 'account_tree' },
        ]
      : role === 'Viewer'
      ? [
          { path: 'viewer-dashboard', label: 'Viewer Overview', icon: 'explore' },
          { path: 'repositories', label: 'Repositories', icon: 'dns' },
          { path: 'schema-explorer', label: 'Schema Explorer', icon: 'schema' },
          { path: 'table-data', label: 'Table Data', icon: 'table_rows' },
          { path: 'branches', label: 'Branches', icon: 'account_tree' },
          { path: 'commits-and-history', label: 'Commits & History', icon: 'commit' },
          { path: 'changes-and-diff', label: 'Changes & Diff', icon: 'difference' },
          { path: 'merge-requests', label: 'Merge Status', icon: 'merge', badgeType: 'mrs' },
        ]
      : CORE_ITEMS;

  const governanceNavItems: NavItem[] =
    role === 'Viewer'
      ? [
          { path: 'sql-workspace', label: 'SQL Console (Read)', icon: 'terminal' },
          { path: 'profile', label: 'Profile & Account', icon: 'person' },
          { path: 'notifications', label: 'Notifications', icon: 'notifications', badgeType: 'notifications' },
          { path: 'settings', label: 'Settings', icon: 'settings' },
        ]
      : role === 'Reviewer'
      ? [
          { path: 'conflict-resolution', label: 'Conflicts', icon: 'warning', iconColorClass: 'text-amber-500', badgeType: 'conflicts' },
          { path: 'data-lineage', label: 'Data Lineage', icon: 'hub' },
          { path: 'profile', label: 'Profile & Account', icon: 'manage_accounts' },
          { path: 'notifications', label: 'Notifications', icon: 'notifications', badgeType: 'notifications' },
          { path: 'settings', label: 'Settings', icon: 'settings' },
        ]
      : role === 'Admin'
      ? [
          { path: 'sql-workspace', label: 'SQL Workspace', icon: 'terminal' },
          { path: 'time-machine', label: 'Time Machine', icon: 'history' },
          { path: 'data-lineage', label: 'Data Lineage', icon: 'hub' },
          { path: 'schema-versions', label: 'Schema Versions', icon: 'sell' },
          { path: 'profile', label: 'Profile & Account', icon: 'manage_accounts' },
          { path: 'notifications', label: 'Notifications', icon: 'notifications', badgeType: 'notifications' },
          { path: 'settings', label: 'Settings', icon: 'settings' },
        ]
      : GOVERNANCE_ITEMS;

  const usedGb = activeRepo?.snapshotDiskUsedGb ?? 0;
  const totalGb = activeRepo?.snapshotDiskTotalGb ?? 0;
  const storagePercent = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0;

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-60 bg-white border-r border-[#e2e5f6] flex flex-col justify-between z-30 select-none overflow-y-auto">
      {/* Navigation */}
      <div className="flex-1 py-3 px-2.5 space-y-5 overflow-y-auto">
        <div className="space-y-0.5">
          <div className="vdb-section-label px-2 pt-1 pb-1.5 flex items-center justify-between">
            <span>{role === 'Admin' ? 'Administration' : role === 'Reviewer' ? 'Code Review' : role === 'Viewer' ? 'Read-Only Explorer' : 'Core'}</span>
            <span className="badge badge-neutral text-[9px] uppercase font-mono px-1.5 py-0">{role}</span>
          </div>
          {coreNavItems.map(renderItem)}
        </div>

        <div className="space-y-0.5">
          <div className="vdb-section-label px-2 pt-1 pb-1.5">
            {role === 'Admin' ? 'Platform Tools' : role === 'Viewer' ? 'General' : 'Governance'}
          </div>
          {governanceNavItems.map(renderItem)}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="px-2.5 pb-3 pt-2 border-t border-[#e2e5f6] space-y-2.5">
        {/* Role-Specific CTA Button */}
        {roleCapabilities.canCreateBranch ? (
          <button
            type="button"
            onClick={() => setCreateBranchModalOpen(true)}
            className="btn-primary w-full justify-center py-2 text-[13px]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Branch
          </button>
        ) : role === 'Admin' ? (
          <button
            type="button"
            onClick={() => navigateTo('members-and-permissions')}
            className="btn-primary w-full justify-center py-2 text-[13px]"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Provision Users
          </button>
        ) : role === 'Reviewer' ? (
          <button
            type="button"
            onClick={() => navigateTo('merge-requests')}
            className="btn-primary w-full justify-center py-2 text-[13px]"
          >
            <span className="material-symbols-outlined text-[16px]">rate_review</span>
            Review Queue
          </button>
        ) : (
          <div className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-center">
            <span className="text-[11px] font-mono text-[#5263a0]">Viewer Mode (Read-Only)</span>
          </div>
        )}

        {/* Storage Widget */}
        <div className="bg-[#f5f6ff] rounded-lg border border-[#e2e5f6] px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8890b8] font-mono">
              Snapshot Storage
            </span>
            <span className="text-[10px] font-mono text-[#5263a0] font-medium">
              {activeRepo ? `${usedGb} / ${totalGb} GB` : '— / —'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#e2e5f6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${storagePercent > 85 ? 'bg-red-500' : storagePercent > 65 ? 'bg-amber-500' : 'bg-[#2563eb]'}`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#8890b8]">WAL checkpoint:</span>
            <span className="text-[#2563eb] font-semibold truncate max-w-[100px]">
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

