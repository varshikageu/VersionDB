import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const MergeRequestsScreen: React.FC = () => {
  const {
    mergeRequests,
    selectedMrNumber,
    setSelectedMrNumber,
    approveMergeRequest,
    executeMerge,
    setCreateMrModalOpen,
    navigateTo,
    isCatalogLoading,
    isOperationPending,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMrs = mergeRequests.filter((mr) => {
    const matchesStatus = statusFilter === 'ALL' ? true : mr.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      mr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(mr.number).includes(searchQuery.trim()) ||
      mr.sourceBranch.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const activeMr =
    filteredMrs.find((m) => m.number === selectedMrNumber) || filteredMrs[0] || null;

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Schema & Record Merge Pipeline
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">Merge Requests</h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Review branch diffs, verify conflict resolution, and execute protected database merges.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateMrModalOpen(true)}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">merge</span>
          New Merge Request
        </button>
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
          {(['ALL', 'OPEN', 'CONFLICT', 'NEEDS_ADMIN', 'READY', 'MERGED'] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-mono transition-all ${
                  statusFilter === status
                    ? 'bg-[#10172a] text-white font-semibold'
                    : 'text-[#5263a0] hover:text-[#10172a] hover:bg-[#f1f3fb]'
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
        <div className="relative">
          <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MRs..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] focus:bg-white w-52 transition-all"
          />
        </div>
      </div>

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : filteredMrs.length === 0 ? (
        <EmptyStateCard
          icon="merge"
          title={
            mergeRequests.length === 0
              ? 'No Merge Requests Open'
              : `No Merge Requests match "${searchQuery || statusFilter}"`
          }
          description={
            mergeRequests.length === 0
              ? 'There are 0 Merge Requests loaded. Connect a VersionDB backend repository or open a Merge Request from an active branch.'
              : 'Reset the filter to view Merge Requests.'
          }
          actionLabel={mergeRequests.length === 0 ? 'Open Merge Request' : 'Reset Filters'}
          onAction={() => {
            if (mergeRequests.length === 0) {
              setCreateMrModalOpen(true);
            } else {
              setStatusFilter('ALL');
              setSearchQuery('');
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-2.5">
            {filteredMrs.map((mr) => {
              const isSelected = activeMr?.number === mr.number;

              return (
                <button
                  key={mr.id}
                  type="button"
                  onClick={() => setSelectedMrNumber(mr.number)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.08)] ring-1 ring-[#2563eb]'
                      : 'bg-white border-[#e2e5f6] hover:border-[#b3c5ff] hover:bg-[#fbfbfe]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] font-bold text-[#2563eb]">#{mr.number}</span>
                    <span className={`badge ${
                      mr.status === 'MERGED'
                        ? 'badge-emerald'
                        : mr.status === 'CONFLICT'
                        ? 'badge-red'
                        : mr.status === 'READY'
                        ? 'badge-blue'
                        : 'badge-amber'
                    }`}>
                      {mr.status}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#10172a] line-clamp-1">
                    {mr.title}
                  </div>
                  <div className="font-mono text-[11px] text-[#5263a0] mt-1.5 flex items-center gap-1.5">
                    <span>{mr.sourceBranch}</span>
                    <span className="material-symbols-outlined text-[13px] text-[#8890b8]">arrow_forward</span>
                    <span>{mr.targetBranch}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            {activeMr && (
              <div className="vdb-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f1f3fb]">
                  <div>
                    <span className="font-mono text-[12px] text-[#2563eb] font-bold">MR #{activeMr.number}</span>
                    <h2 className="text-[17px] font-bold text-[#10172a] mt-0.5">
                      {activeMr.title}
                    </h2>
                  </div>
                  <span className={`badge ${
                    activeMr.status === 'MERGED'
                      ? 'badge-emerald'
                      : activeMr.status === 'CONFLICT'
                      ? 'badge-red'
                      : activeMr.status === 'READY'
                      ? 'badge-blue'
                      : 'badge-amber'
                  }`}>
                    {activeMr.status}
                  </span>
                </div>
                <div className="font-mono text-[12px] text-[#5263a0] flex items-center gap-2 p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6]">
                  <span className="text-[#10172a] font-medium">{activeMr.sourceBranch}</span>
                  <span className="material-symbols-outlined text-[14px] text-[#8890b8]">arrow_forward</span>
                  <span className="text-[#10172a] font-medium">{activeMr.targetBranch}</span>
                </div>
                <p className="text-[13px] text-[#5263a0] leading-relaxed">{activeMr.description}</p>
                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#f1f3fb]">
                  <button
                    type="button"
                    disabled={isOperationPending}
                    onClick={() => void approveMergeRequest(activeMr.number)}
                    className="btn-secondary text-[12px] py-1.5"
                  >
                    Approve Merge Request
                  </button>
                  <button
                    type="button"
                    disabled={isOperationPending}
                    onClick={() => void executeMerge(activeMr.number)}
                    className="btn-primary text-[12px] py-1.5"
                  >
                    Execute Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('changes-and-diff')}
                    className="btn-secondary text-[12px] py-1.5"
                  >
                    Inspect Diff
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
