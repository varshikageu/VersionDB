import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const ChangesDiffScreen: React.FC = () => {
  const {
    activeBranch,
    compareTargetBranch,
    branches,
    selectBranch,
    setCompareTargetBranch,
    stagedRowMutations,
    stagedDdlChanges,
    discardStagedItem,
    discardAllStaged,
    setCommitModalOpen,
    setCreateMrModalOpen,
    navigateTo,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const totalStaged = stagedRowMutations.length + stagedDdlChanges.length;

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Staged Mutations & Branch Comparison
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Changes & 3-Way Diff Inspector
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect staged DDL/DML changes and compare schema or primary-key record divergence
            between branches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalStaged > 0 && (
            <>
              <button
                type="button"
                onClick={discardAllStaged}
                className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-body-sm text-xs font-medium border border-outline-variant/25"
              >
                Discard Staged ({totalStaged})
              </button>
              <button
                type="button"
                onClick={() => setCommitModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-xs font-semibold shadow-sm"
              >
                Commit Staged ({totalStaged})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCreateMrModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/25"
          >
            Open Merge Request
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

      {/* Branch Selector Bar */}
      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-label-mono uppercase text-secondary">Source Branch:</span>
            <select
              value={activeBranch}
              onChange={(e) => selectBranch(e.target.value)}
              disabled={branches.length === 0}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-2.5 py-1.5 font-code-sm text-xs text-on-surface"
            >
              {branches.length === 0 ? (
                <option value="">No branches available</option>
              ) : (
                branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <span className="material-symbols-outlined text-sm text-secondary">compare_arrows</span>
          <div className="flex items-center gap-2">
            <span className="font-label-mono uppercase text-secondary">Target Branch:</span>
            <select
              value={compareTargetBranch}
              onChange={(e) => setCompareTargetBranch(e.target.value)}
              disabled={branches.length === 0}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-2.5 py-1.5 font-code-sm text-xs text-on-surface"
            >
              {branches.length === 0 ? (
                <option value="">No branches available</option>
              ) : (
                branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="font-code-sm text-xs text-secondary">
          {stagedDdlChanges.length} DDL staged • {stagedRowMutations.length} DML row mutations
          staged
        </div>
      </div>

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : totalStaged === 0 ? (
        <EmptyStateCard
          icon="difference"
          title="No Staged Changes or Branch Diffs Loaded"
          description="There are currently 0 staged DDL statements or row mutations. Diff computation requires a connected VersionDB backend repository."
          actionLabel="Open SQL Workspace"
          onAction={() => navigateTo('sql-workspace')}
          secondaryActionLabel="Browse Table Data"
          onSecondaryAction={() => navigateTo('table-data')}
        />
      ) : (
        <div className="space-y-4">
          {stagedDdlChanges.map((ddl) => (
            <div
              key={ddl.id}
              className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-code-sm text-xs font-semibold text-primary">
                  DDL • {ddl.table}
                </span>
                <button
                  type="button"
                  onClick={() => discardStagedItem(ddl.id)}
                  className="text-xs text-error hover:underline"
                >
                  Discard
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-surface-container-low font-code-sm text-xs text-on-surface overflow-x-auto">
                {ddl.statement}
              </pre>
            </div>
          ))}
          {stagedRowMutations.map((row) => (
            <div
              key={row.id}
              className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex items-center justify-between"
            >
              <div>
                <div className="font-code-sm text-xs font-semibold text-on-surface">
                  {row.operation} on {row.table} (PK: {row.primaryKeyValue})
                </div>
                {row.columnName && (
                  <div className="font-code-sm text-[11px] text-secondary mt-0.5">
                    {row.columnName}: {String(row.oldValue)} → {String(row.newValue)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => discardStagedItem(row.id)}
                className="text-xs text-error hover:underline"
              >
                Discard
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
