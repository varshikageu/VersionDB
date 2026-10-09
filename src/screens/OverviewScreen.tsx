import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const OverviewScreen: React.FC = () => {
  const {
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

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-code-sm text-xs text-secondary mb-1">
            <span>{activeRepo ? activeRepo.name : 'No Repository Selected'}</span>
            <span>/</span>
            <span className="text-primary font-semibold">
              {activeBranch || 'No Active Branch'}
            </span>
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface tracking-tight">
            Database Version Control Overview
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigateTo('sql-workspace')}
            className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-primary">terminal</span>
            Open SQL Workspace
          </button>
          <button
            type="button"
            onClick={() =>
              activeRepo ? setCreateBranchModalOpen(true) : setCreateRepoModalOpen(true)
            }
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">
              {activeRepo ? 'call_split' : 'add'}
            </span>
            {activeRepo ? 'Create Branch' : 'Register Repository'}
          </button>
        </div>
      </div>

      {/* Backend Connectivity Status Banner */}
      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {/* Truthful Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => navigateTo('branches')}
          className="text-left p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="font-label-mono text-label-sm uppercase">Active Branches</span>
            <span className="material-symbols-outlined text-base text-primary">account_tree</span>
          </div>
          <div className="font-headline text-2xl font-bold text-on-surface">
            {branches.length}
          </div>
          <div className="font-code-sm text-[11px] text-secondary mt-1">
            {activeRepo ? `Default: ${activeRepo.defaultBranch}` : 'No repository connected'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('commits-and-history')}
          className="text-left p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="font-label-mono text-label-sm uppercase">Recorded Commits</span>
            <span className="material-symbols-outlined text-base text-primary">commit</span>
          </div>
          <div className="font-headline text-2xl font-bold text-on-surface">{commits.length}</div>
          <div className="font-code-sm text-[11px] text-secondary mt-1">
            {stagedCount > 0 ? `${stagedCount} changes staged locally` : '0 staged changes'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('merge-requests')}
          className="text-left p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="font-label-mono text-label-sm uppercase">Open Merge Requests</span>
            <span className="material-symbols-outlined text-base text-primary">merge</span>
          </div>
          <div className="font-headline text-2xl font-bold text-on-surface">{openMrs.length}</div>
          <div className="font-code-sm text-[11px] text-secondary mt-1">
            {mergeRequests.length} total merge requests
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('conflict-resolution')}
          className="text-left p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="font-label-mono text-label-sm uppercase">Unresolved Conflicts</span>
            <span
              className={`material-symbols-outlined text-base ${
                unresolvedConflicts.length > 0 ? 'text-error' : 'text-secondary'
              }`}
            >
              warning
            </span>
          </div>
          <div className="font-headline text-2xl font-bold text-on-surface">
            {unresolvedConflicts.length}
          </div>
          <div className="font-code-sm text-[11px] text-secondary mt-1">
            {unresolvedConflicts.length > 0
              ? 'Requires 3-way resolution'
              : 'No active schema/row conflicts'}
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      {isCatalogLoading ? (
        <TableSkeletonLoader rows={5} columns={5} />
      ) : !activeRepo && commits.length === 0 ? (
        <EmptyStateCard
          icon="database"
          title="No Operational Database Repository Connected"
          description="VersionDB does not display fabricated commits, fake replica telemetry, or placeholder charts. Connect a live VersionDB backend via VITE_API_BASE_URL and register a PostgreSQL repository to view real commit timelines, branch diffs, and database health."
          actionLabel="Register Repository"
          onAction={() => setCreateRepoModalOpen(true)}
          secondaryActionLabel="View Onboarding Checklist"
          onSecondaryAction={() => navigateTo('onboarding')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Commits Table */}
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between">
              <h2 className="font-headline text-title-md text-on-surface">Recent Commits</h2>
              <button
                type="button"
                onClick={() => navigateTo('commits-and-history')}
                className="font-body-sm text-xs font-semibold text-primary hover:underline"
              >
                Full History →
              </button>
            </div>
            {commits.length === 0 ? (
              <div className="p-8 text-center font-body-sm text-xs text-secondary">
                No commits returned for this repository.
              </div>
            ) : (
              <div className="divide-y divide-surface-container">
                {commits.slice(0, 6).map((c) => (
                  <div
                    key={c.hash}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-surface-container-low/50"
                  >
                    <div>
                      <div className="font-body-sm text-xs font-semibold text-on-surface">
                        {c.message}
                      </div>
                      <div className="font-code-sm text-[11px] text-secondary mt-0.5">
                        {c.hash} • {c.branch} • {c.authorHandle}
                      </div>
                    </div>
                    <span className="font-code-sm text-[11px] text-secondary">
                      {c.timestampRelative}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repository Telemetry & Merge Requests */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-title-md text-on-surface">
                  Repository Telemetry
                </h3>
                <span className="font-code-sm text-xs text-secondary">
                  {activeRepo ? activeRepo.connectionMode : 'Unconnected'}
                </span>
              </div>
              {activeRepo ? (
                <div className="space-y-2 text-xs font-code-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Engine:</span>
                    <span className="text-on-surface">
                      {activeRepo.engine} {activeRepo.engineVersion}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Region:</span>
                    <span className="text-on-surface">{activeRepo.region}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Latency:</span>
                    <span className="text-on-surface">{activeRepo.latencyMs}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">WAL Lag:</span>
                    <span className="text-on-surface">{activeRepo.walLag}</span>
                  </div>
                </div>
              ) : (
                <p className="font-body-sm text-xs text-secondary">
                  Telemetry metrics are unavailable until a backend repository is connected.
                </p>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-title-md text-on-surface">Merge Requests</h3>
                <button
                  type="button"
                  onClick={() => setCreateMrModalOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Open MR
                </button>
              </div>
              {openMrs.length === 0 ? (
                <p className="font-body-sm text-xs text-secondary">No open Merge Requests.</p>
              ) : (
                <div className="space-y-2">
                  {openMrs.slice(0, 4).map((mr) => (
                    <button
                      key={mr.id}
                      type="button"
                      onClick={() => navigateTo('merge-requests')}
                      className="w-full text-left p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                    >
                      <div className="font-code-sm text-xs font-semibold text-on-surface">
                        #{mr.number} {mr.title}
                      </div>
                      <div className="font-code-sm text-[10px] text-secondary mt-0.5">
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
