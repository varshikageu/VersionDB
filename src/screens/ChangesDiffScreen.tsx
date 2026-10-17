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
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Staged Mutations & Branch Comparison
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Changes & 3-Way Diff Inspector
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect staged DDL/DML changes and compare schema or primary-key record divergence between branches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalStaged > 0 && (
            <>
              <button
                type="button"
                onClick={discardAllStaged}
                className="btn-secondary text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                Discard Staged ({totalStaged})
              </button>
              <button
                type="button"
                onClick={() => setCommitModalOpen(true)}
                className="btn-primary"
              >
                <span className="material-symbols-outlined text-[15px]">commit</span>
                Commit Staged ({totalStaged})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCreateMrModalOpen(true)}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">merge</span>
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
      <div className="p-3.5 rounded-xl bg-white border border-[#e2e5f6] flex flex-wrap items-center justify-between gap-4 shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#5263a0] uppercase tracking-wider text-[11px]">Source:</span>
            <select
              value={activeBranch}
              onChange={(e) => selectBranch(e.target.value)}
              disabled={branches.length === 0}
              className="rounded-lg border border-[#e2e5f6] bg-[#f8f9ff] px-2.5 py-1 font-mono text-[12px] text-[#10172a] focus:outline-none focus:border-[#2563eb]"
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
          <span className="material-symbols-outlined text-[16px] text-[#8890b8]">arrow_forward</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#5263a0] uppercase tracking-wider text-[11px]">Target:</span>
            <select
              value={compareTargetBranch}
              onChange={(e) => setCompareTargetBranch(e.target.value)}
              disabled={branches.length === 0}
              className="rounded-lg border border-[#e2e5f6] bg-[#f8f9ff] px-2.5 py-1 font-mono text-[12px] text-[#10172a] focus:outline-none focus:border-[#2563eb]"
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
        <div className="font-mono text-[12px] text-[#5263a0]">
          <span className="font-semibold text-[#10172a]">{stagedDdlChanges.length}</span> DDL staged •{' '}
          <span className="font-semibold text-[#10172a]">{stagedRowMutations.length}</span> DML staged
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
        <div className="space-y-3.5">
          {stagedDdlChanges.map((ddl) => (
            <div
              key={ddl.id}
              className="vdb-card p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="badge badge-blue">DDL Mutation</span>
                  <span className="font-mono text-[13px] font-semibold text-[#10172a]">{ddl.table}</span>
                </div>
                <button
                  type="button"
                  onClick={() => discardStagedItem(ddl.id)}
                  className="text-[12px] font-medium text-red-600 hover:text-red-700 hover:underline"
                >
                  Discard
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] font-mono text-[11px] text-[#10172a] overflow-x-auto">
                {ddl.statement}
              </pre>
            </div>
          ))}
          {stagedRowMutations.map((row) => (
            <div
              key={row.id}
              className="vdb-card p-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    row.operation === 'INSERT'
                      ? 'badge-emerald'
                      : row.operation === 'DELETE'
                      ? 'badge-red'
                      : 'badge-blue'
                  }`}>
                    {row.operation}
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-[#10172a]">
                    {row.table}
                  </span>
                  <span className="font-mono text-[11px] text-[#5263a0]">
                    (PK: {row.primaryKeyValue})
                  </span>
                </div>
                {row.columnName && (
                  <div className="font-mono text-[11px] text-[#5263a0] mt-1 pl-1">
                    <span className="text-[#10172a] font-medium">{row.columnName}</span>: <span className="text-red-500 line-through">{String(row.oldValue)}</span> → <span className="text-emerald-600 font-semibold">{String(row.newValue)}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => discardStagedItem(row.id)}
                className="text-[12px] font-medium text-red-600 hover:text-red-700 hover:underline shrink-0"
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
