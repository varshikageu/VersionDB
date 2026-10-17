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
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Immutable Snapshot Ledger
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Commits & Snapshot History
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect versioned database commits, affected tables, and DDL/DML changes across branches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalStaged > 0 && (
            <button
              type="button"
              onClick={() => setCommitModalOpen(true)}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">commit</span>
              Commit Staged ({totalStaged})
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateTo('time-machine')}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">history</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#e2e5f6] p-2.5 rounded-xl shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider pl-1 mr-1">
            Branch:
          </span>
          <button
            type="button"
            onClick={() => setBranchFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[12px] font-mono transition-all ${
              branchFilter === 'ALL'
                ? 'bg-[#10172a] text-white font-semibold'
                : 'text-[#5263a0] hover:text-[#10172a] hover:bg-[#f1f3fb]'
            }`}
          >
            All Branches ({commits.length})
          </button>
          {branches.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setBranchFilter(b.name)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-mono transition-all ${
                branchFilter === b.name
                  ? 'bg-[#10172a] text-white font-semibold'
                  : 'text-[#5263a0] hover:text-[#10172a] hover:bg-[#f1f3fb]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter hash, table, message..."
              aria-label="Filter commits"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] focus:bg-white w-56 transition-all"
            />
          </div>
          <span className="text-[12px] font-mono text-[#8890b8]">
            Active: <strong className="text-[#10172a]">{activeBranch || 'None'}</strong>
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
          <div className="lg:col-span-8 vdb-card overflow-hidden">
            <table className="vdb-table">
              <thead>
                <tr>
                  <th>Commit</th>
                  <th>Message & Branch</th>
                  <th>Affected Scope</th>
                  <th>Author</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommits.map((c) => {
                  const isSelected = selectedCommit?.hash === c.hash;

                  return (
                    <tr
                      key={c.hash}
                      onClick={() => setSelectedCommit(c)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#eff4ff]' : 'hover:bg-[#f8f9ff]'
                      }`}
                    >
                      <td className="font-mono text-[12px] text-[#2563eb] font-semibold">{c.hash}</td>
                      <td>
                        <div className="text-[13px] font-medium text-[#10172a]">{c.message}</div>
                        <div className="font-mono text-[11px] text-[#5263a0] mt-0.5">{c.branch}</div>
                      </td>
                      <td className="font-mono text-[12px] text-[#5263a0]">
                        <span className="text-[#10172a] font-medium">{c.affectedTable}</span> ({c.affectedRowsLabel})
                      </td>
                      <td className="text-[12px] text-[#5263a0]">
                        <span className="font-medium text-[#10172a]">{c.authorHandle}</span> • {c.timestampRelative}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 vdb-card p-5">
            {selectedCommit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-[#2563eb] font-bold">
                    {selectedCommit.hash}
                  </span>
                  <span className="badge badge-blue">{selectedCommit.branch}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-[#10172a]">
                  {selectedCommit.message}
                </h3>
                <div className="text-[12px] text-[#5263a0]">
                  Author: <span className="font-medium text-[#10172a]">{selectedCommit.authorHandle}</span> ({selectedCommit.timestampRelative})
                </div>
                <div className="pt-2">
                  <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider block mb-1.5">
                    DDL / Mutation Preview
                  </span>
                  <pre className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] font-mono text-[11px] text-[#10172a] overflow-x-auto">
                    {selectedCommit.ddlPreview}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => selectBranch(selectedCommit.branch)}
                  className="w-full btn-secondary text-[12px] py-2 mt-2"
                >
                  Checkout {selectedCommit.branch}
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-[13px] text-[#5263a0]">
                <span className="material-symbols-outlined text-[32px] text-[#8890b8] block mb-2">touch_app</span>
                Select a commit from the table to inspect its snapshot details and DDL preview.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
