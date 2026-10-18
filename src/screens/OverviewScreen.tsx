import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const OverviewScreen: React.FC = () => {
  const {
    currentUser,
    roleCapabilities,
    activeRepo,
    activeBranch,
    branches,
    commits,
    mergeRequests,
    conflicts,
    stagedRowMutations,
    stagedDdlChanges,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    navigateTo,
    setCreateRepoModalOpen,
    setCreateBranchModalOpen,
    setCreateMrModalOpen,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const openMrs = mergeRequests.filter((mr) => mr.status !== 'MERGED' && mr.status !== 'CLOSED');
  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);
  const stagedCount = stagedRowMutations.length + stagedDdlChanges.length;

  const role = currentUser.role;

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5263a0] mb-1">
            <span>{activeRepo ? activeRepo.name : 'No Repository'}</span>
            <span className="text-[#c5c9e4]">/</span>
            <span className="text-[#2563eb] font-semibold">{activeBranch || 'No Branch'}</span>
            <span className="text-[#c5c9e4]">·</span>
            <span className="badge badge-neutral text-[10px] uppercase font-mono">{role}</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            {role === 'Admin'
              ? 'Administrator Overview'
              : role === 'Reviewer'
              ? 'Reviewer Dashboard'
              : role === 'Viewer'
              ? 'Repository Explorer (Read-Only)'
              : 'Database Developer Overview'}
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            {role === 'Admin'
              ? `Platform administration, repository access governance, and schema health for ${activeRepo?.name ?? 'VersionDB'}`
              : role === 'Reviewer'
              ? `Review queue, branch comparisons, and merge approvals for ${activeRepo?.name ?? 'your database'}`
              : role === 'Viewer'
              ? `Browse committed tables, schema definitions, and branch history in read-only mode`
              : `Version control dashboard, SQL workspace, and branch staging for ${activeRepo?.name ?? 'your database'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role === 'Admin' && (
            <button
              type="button"
              onClick={() => navigateTo('members-and-permissions')}
              className="btn-secondary"
            >
              <span className="material-symbols-outlined text-[15px] text-[#2563eb]">admin_panel_settings</span>
              User Management
            </button>
          )}

          {role === 'Reviewer' && (
            <button
              type="button"
              onClick={() => navigateTo('merge-requests')}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">rate_review</span>
              Review Queue ({openMrs.length})
            </button>
          )}

          {roleCapabilities.canExecuteSelect && (
            <button
              type="button"
              onClick={() => navigateTo('sql-workspace')}
              className="btn-secondary"
            >
              <span className="material-symbols-outlined text-[15px] text-[#2563eb]">terminal</span>
              SQL Workspace
            </button>
          )}

          {roleCapabilities.canCreateBranch && (
            <button
              type="button"
              onClick={() => activeRepo ? setCreateBranchModalOpen(true) : setCreateRepoModalOpen(true)}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">
                {activeRepo ? 'call_split' : 'add'}
              </span>
              {activeRepo ? 'Create Branch' : 'Register Repository'}
            </button>
          )}
        </div>
      </div>

      {/* Backend Status Banner */}
      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Branches',
            value: branches.length,
            icon: 'account_tree',
            sub: activeRepo ? `Default: ${activeRepo.defaultBranch}` : 'No repository',
            screen: 'branches' as const,
          },
          {
            label: 'Commits',
            value: commits.length,
            icon: 'commit',
            sub: stagedCount > 0 ? `${stagedCount} staged locally` : '0 staged',
            screen: 'commits-and-history' as const,
          },
          {
            label: 'Open Merge Requests',
            value: openMrs.length,
            icon: 'merge',
            sub: `${mergeRequests.length} total`,
            screen: 'merge-requests' as const,
          },
          {
            label: 'Conflicts',
            value: unresolvedConflicts.length,
            icon: 'warning',
            sub: unresolvedConflicts.length > 0 ? 'Requires resolution' : 'No conflicts',
            screen: 'conflict-resolution' as const,
            alert: unresolvedConflicts.length > 0,
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigateTo(card.screen)}
            className="vdb-card p-5 text-left hover:border-[#b3c5ff] hover:shadow-[0_2px_8px_rgba(37,99,235,0.08)] transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider">
                {card.label}
              </span>
              <span className={`material-symbols-outlined text-[18px] ${card.alert ? 'text-red-500' : 'text-[#8890b8] group-hover:text-[#2563eb]'} transition-colors`}>
                {card.icon}
              </span>
            </div>
            <div className="text-[28px] font-bold text-[#10172a] leading-none">
              {card.value}
            </div>
            <div className="text-[11px] font-mono text-[#8890b8] mt-1.5">{card.sub}</div>
          </button>
        ))}
      </div>

      {/* Main Content */}
      {isCatalogLoading ? (
        <TableSkeletonLoader rows={5} columns={5} />
      ) : !activeRepo && commits.length === 0 ? (
        <EmptyStateCard
          icon="database"
          title="No Database Repository Connected"
          description="VersionDB does not display fabricated commits or placeholder charts. Connect a live VersionDB backend via VITE_API_BASE_URL and register a PostgreSQL repository to view real commit timelines, branch diffs, and database health."
          actionLabel="Register Repository"
          onAction={() => setCreateRepoModalOpen(true)}
          secondaryActionLabel="View Onboarding"
          onSecondaryAction={() => navigateTo('onboarding')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Recent Commits */}
          <div className="lg:col-span-8 vdb-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f3fb] flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#10172a]">Recent Commits</h2>
              <button
                type="button"
                onClick={() => navigateTo('commits-and-history')}
                className="text-[12px] font-semibold text-[#2563eb] hover:underline"
              >
                Full History →
              </button>
            </div>
            {commits.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#5263a0]">
                No commits returned for this repository.
              </div>
            ) : (
              <div className="divide-y divide-[#f1f3fb]">
                {commits.slice(0, 6).map((c) => (
                  <div
                    key={c.hash}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#f5f6ff] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#10172a] truncate">{c.message}</div>
                      <div className="text-[11px] font-mono text-[#5263a0] mt-0.5">
                        <span className="text-[#2563eb]">{c.hash}</span>
                        {' · '}{c.branch}{' · '}{c.authorHandle}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#8890b8] shrink-0">{c.timestampRelative}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Panels */}
          <div className="lg:col-span-4 space-y-4">
            {/* Repo Telemetry */}
            <div className="vdb-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#10172a]">Repository</h3>
                {activeRepo && (
                  <span className="badge badge-blue">{activeRepo.connectionMode}</span>
                )}
              </div>
              {activeRepo ? (
                <div className="space-y-2">
                  {[
                    { label: 'Engine', value: `${activeRepo.engine} ${activeRepo.engineVersion}` },
                    { label: 'Region', value: activeRepo.region },
                    { label: 'Latency', value: `${activeRepo.latencyMs}ms` },
                    { label: 'WAL Lag', value: activeRepo.walLag },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-[12px]">
                      <span className="text-[#8890b8] font-mono">{label}</span>
                      <span className="text-[#10172a] font-mono font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#5263a0]">
                  Telemetry metrics are unavailable until a backend repository is connected.
                </p>
              )}
            </div>

            {/* Merge Requests */}
            <div className="vdb-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#10172a]">Merge Requests</h3>
                <button
                  type="button"
                  onClick={() => setCreateMrModalOpen(true)}
                  className="text-[12px] font-semibold text-[#2563eb] hover:underline"
                >
                  + Open MR
                </button>
              </div>
              {openMrs.length === 0 ? (
                <p className="text-[12px] text-[#5263a0]">No open Merge Requests.</p>
              ) : (
                <div className="space-y-1.5">
                  {openMrs.slice(0, 4).map((mr) => (
                    <button
                      key={mr.id}
                      type="button"
                      onClick={() => navigateTo('merge-requests')}
                      className="w-full text-left p-2.5 rounded-lg bg-[#f5f6ff] hover:bg-[#eff4ff] border border-[#e2e5f6] transition-colors"
                    >
                      <div className="text-[12px] font-semibold text-[#10172a]">
                        #{mr.number} {mr.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#5263a0] mt-0.5">
                        {mr.sourceBranch} → {mr.targetBranch}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
