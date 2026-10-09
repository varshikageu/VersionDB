import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';
import { CommitRecord } from '../types/versiondb';

export const CommitsHistoryScreen: React.FC = () => {
  const {
    commits,
    branches,
    activeBranch,
    selectBranch,
    setCommitModalOpen,
    stagedRowMutations,
    stagedDdlChanges,
    navigateTo,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCommit, setSelectedCommit] = useState<CommitRecord | null>(null);

  const filteredCommits = commits.filter((c) => {
    const matchesBranch = branchFilter === 'ALL' ? true : c.branch === branchFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      c.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.authorHandle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.affectedTable.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  const totalStaged = stagedRowMutations.length + stagedDdlChanges.length;

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Immutable Snapshot Ledger
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Commits & Snapshot History
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect versioned database commits, affected tables, and DDL/DML changes across
            branches.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {totalStaged > 0 && (
            <button
              type="button"
              onClick={() => setCommitModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-b from-primary to-primary-container text-on-primary rounded-lg font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">commit</span>
              Commit Staged ({totalStaged})
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateTo('time-machine')}
            className="px-3 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-body-sm text-body-sm font-medium border border-outline-variant/25 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-primary">history</span>
            Time Machine
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low p-2.5 rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label-mono text-label-sm uppercase text-secondary pl-1">
            Branch Filter:
          </span>
          <button
            type="button"
            onClick={() => setBranchFilter('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-code-sm transition-colors ${
              branchFilter === 'ALL'
                ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            All Branches ({commits.length})
          </button>
          {branches.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setBranchFilter(b.name)}
              className={`px-2.5 py-1 rounded text-xs font-code-sm transition-colors ${
                branchFilter === b.name
                  ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pr-2">
          <div className="relative">
            <span className="material-symbols-outlined text-xs text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter hash, table, message..."
              aria-label="Filter commits"
              className="pl-7 pr-3 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <span className="font-code-sm text-code-sm text-secondary">
            Active Branch: <strong className="text-on-surface">{activeBranch || 'None'}</strong>
          </span>
        </div>
      </div>

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={5} columns={5} />
      ) : filteredCommits.length === 0 ? (
        <EmptyStateCard
          icon="commit"
          title={
            commits.length === 0
              ? 'No Commits Recorded'
              : `No commits match "${searchQuery || branchFilter}"`
          }
          description={
            commits.length === 0
              ? 'No commit history is loaded because no backend repository is connected or no commits have been persisted yet.'
              : 'Reset the branch or search filter.'
          }
          actionLabel={commits.length === 0 ? 'Open SQL Workspace' : 'Reset Filters'}
          onAction={() => {
            if (commits.length === 0) {
              navigateTo('sql-workspace');
            } else {
              setBranchFilter('ALL');
              setSearchQuery('');
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-mono text-label-sm uppercase text-secondary border-b border-surface-container">
                  <th className="py-3 px-4">Commit</th>
                  <th className="py-3 px-4">Message & Branch</th>
                  <th className="py-3 px-4">Affected Scope</th>
                  <th className="py-3 px-4">Author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                {filteredCommits.map((c) => (
                  <tr
                    key={c.hash}
                    onClick={() => setSelectedCommit(c)}
                    className="cursor-pointer hover:bg-surface-container-low/60"
                  >
                    <td className="py-3 px-4 font-code-sm text-primary font-semibold">{c.hash}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-on-surface">{c.message}</div>
                      <div className="font-code-sm text-[11px] text-secondary">{c.branch}</div>
                    </td>
                    <td className="py-3 px-4 font-code-sm text-xs text-secondary">
                      {c.affectedTable} ({c.affectedRowsLabel})
                    </td>
                    <td className="py-3 px-4 font-code-sm text-xs text-secondary">
                      {c.authorHandle} • {c.timestampRelative}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm p-5 border border-outline-variant/20">
            {selectedCommit ? (
              <div className="space-y-3">
                <div className="font-code-sm text-xs text-primary font-bold">
                  {selectedCommit.hash}
                </div>
                <h3 className="font-headline text-title-md text-on-surface">
                  {selectedCommit.message}
                </h3>
                <pre className="p-3 rounded-lg bg-surface-container-low font-code-sm text-xs text-on-surface overflow-x-auto">
                  {selectedCommit.ddlPreview}
                </pre>
                <button
                  type="button"
                  onClick={() => selectBranch(selectedCommit.branch)}
                  className="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high font-body-sm text-xs font-semibold text-on-surface"
                >
                  Checkout {selectedCommit.branch}
                </button>
              </div>
            ) : (
              <div className="text-center py-8 font-body-sm text-xs text-secondary">
                Select a commit from the table to inspect its snapshot details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
