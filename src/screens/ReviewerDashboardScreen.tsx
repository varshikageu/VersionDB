import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';
import { MergeRequest } from '../types/versiondb';

export const ReviewerDashboardScreen: React.FC = () => {
  const {
    mergeRequests,
    selectedMrNumber,
    setSelectedMrNumber,
    approveMergeRequest,
    executeMerge,
    conflicts,
    activeRepo,
    currentUser,
    roleCapabilities,
    isCatalogLoading,
    isOperationPending,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    navigateTo,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'READY' | 'CONFLICT' | 'NEEDS_ADMIN' | 'MERGED'>('ALL');
  const [search, setSearch] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<number | null>(null);

  const openMrs = mergeRequests.filter((mr) => mr.status !== 'MERGED' && mr.status !== 'CLOSED');
  const readyMrs = mergeRequests.filter((mr) => mr.status === 'READY');
  const conflictMrs = mergeRequests.filter((mr) => mr.status === 'CONFLICT');
  const mergedMrs = mergeRequests.filter((mr) => mr.status === 'MERGED');

  const filteredMrs = mergeRequests.filter((mr) => {
    const matchesStatus = statusFilter === 'ALL' ? true : mr.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      mr.title.toLowerCase().includes(search.toLowerCase()) ||
      String(mr.number).includes(search.trim()) ||
      mr.sourceBranch.toLowerCase().includes(search.toLowerCase()) ||
      mr.targetBranch.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const activeMr: MergeRequest | null =
    filteredMrs.find((m) => m.number === selectedMrNumber) || filteredMrs[0] || null;

  return (
    <div className="vdb-page space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            <span>Code & Schema Review Queue</span>
            <span className="text-[#c5c9e4]">/</span>
            <span className="badge badge-blue">Reviewer Authorized</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Reviewer Dashboard
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Review open pull requests, verify schema migrations, inspect branch diffs, and approve database merges for <strong>{activeRepo?.name ?? 'all repositories'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('changes-and-diff')}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">difference</span>
            Changes & Diff
          </button>
          <button
            type="button"
            onClick={() => navigateTo('commits-and-history')}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">history</span>
            Commit History
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

      {/* Review Metrics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Pending Reviews
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">rate_review</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {openMrs.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Active pull requests awaiting sign-off
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Ready to Merge
            </span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {readyMrs.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            All checks and approvals satisfied
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Merge Conflicts
            </span>
            <span className={`material-symbols-outlined text-[18px] ${conflictMrs.length > 0 ? 'text-red-500' : 'text-[#8890b8]'}`}>
              warning
            </span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {conflictMrs.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Requires developer resolution
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Merged Requests
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">done_all</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {mergedMrs.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Successfully merged into main
          </div>
        </div>
      </div>

      {/* Review Queue Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#e2e5f6] p-2.5 rounded-xl shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'OPEN', 'READY', 'CONFLICT', 'NEEDS_ADMIN', 'MERGED'] as const).map((status) => (
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
          ))}
        </div>

        <div className="relative">
          <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title, branch, or #..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] focus:bg-white w-56 transition-all"
          />
        </div>
      </div>

      {/* Review Queue Master / Detail Split */}
      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : filteredMrs.length === 0 ? (
        <EmptyStateCard
          icon="rate_review"
          title={
            mergeRequests.length === 0
              ? 'No Merge Requests in Review Queue'
              : `No requests match "${search || statusFilter}"`
          }
          description={
            mergeRequests.length === 0
              ? 'There are currently 0 merge requests open for this repository. New merge requests submitted by developers will appear here for review.'
              : 'Clear or adjust the filters above to inspect other merge requests.'
          }
          actionLabel={search || statusFilter !== 'ALL' ? 'Reset Filters' : undefined}
          onAction={() => {
            setSearch('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* MR List (5 cols) */}
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
                    <span className="font-mono text-[12px] font-bold text-[#2563eb]">
                      MR #{mr.number}
                    </span>
                    <span
                      className={`badge ${
                        mr.status === 'MERGED'
                          ? 'badge-emerald'
                          : mr.status === 'CONFLICT'
                          ? 'badge-red'
                          : mr.status === 'READY'
                          ? 'badge-blue'
                          : 'badge-amber'
                      }`}
                    >
                      {mr.status}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#10172a] line-clamp-1">
                    {mr.title}
                  </div>
                  <div className="font-mono text-[11px] text-[#5263a0] mt-1.5 flex items-center gap-1.5">
                    <span>{mr.sourceBranch}</span>
                    <span className="material-symbols-outlined text-[13px] text-[#8890b8]">
                      arrow_forward
                    </span>
                    <span>{mr.targetBranch}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active MR Detail & Review Action Panel (7 cols) */}
          <div className="lg:col-span-7">
            {activeMr && (
              <div className="vdb-card p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#f1f3fb]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-[#2563eb] font-bold">
                        MR #{activeMr.number}
                      </span>
                      <span className="text-[11px] font-mono text-[#8890b8]">
                        Author: {activeMr.authorHandle || 'Developer'}
                      </span>
                    </div>
                    <h2 className="text-[17px] font-bold text-[#10172a] mt-0.5">
                      {activeMr.title}
                    </h2>
                  </div>
                  <span
                    className={`badge ${
                      activeMr.status === 'MERGED'
                        ? 'badge-emerald'
                        : activeMr.status === 'CONFLICT'
                        ? 'badge-red'
                        : activeMr.status === 'READY'
                        ? 'badge-blue'
                        : 'badge-amber'
                    }`}
                  >
                    {activeMr.status}
                  </span>
                </div>

                {/* Branch Routing Info */}
                <div className="font-mono text-[12px] text-[#5263a0] flex items-center justify-between p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8890b8]">Source:</span>
                    <span className="text-[#10172a] font-semibold">{activeMr.sourceBranch}</span>
                    <span className="material-symbols-outlined text-[14px] text-[#8890b8]">
                      arrow_forward
                    </span>
                    <span className="text-[#8890b8]">Target:</span>
                    <span className="text-[#10172a] font-semibold">{activeMr.targetBranch}</span>
                  </div>
                  <span className="text-[11px] text-[#2563eb] font-semibold font-mono">
                    {activeMr.targetBranch === 'main' ? 'Protected Main' : 'Feature Branch'}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[#10172a] mb-1">Description</h4>
                  <p className="text-[13px] text-[#5263a0] leading-relaxed">
                    {activeMr.description || 'No description provided.'}
                  </p>
                </div>

                {/* Conflict Status */}
                {activeMr.status === 'CONFLICT' && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-800 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-red-600 mt-0.5 shrink-0">warning</span>
                    <div>
                      <strong>Merge Blocked:</strong> Target branch has conflicting schema or row changes. Developer must resolve conflicts before merge approval.
                    </div>
                  </div>
                )}

                {/* Reviewer Action Buttons */}
                <div className="pt-3 border-t border-[#f1f3fb] space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {roleCapabilities.canReviewAndApproveMr && (
                      <button
                        type="button"
                        disabled={isOperationPending || activeMr.status === 'MERGED'}
                        onClick={() => void approveMergeRequest(activeMr.number)}
                        className="btn-primary text-[12px] py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Approve Pull Request
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowRejectInput((prev) => (prev === activeMr.number ? null : activeMr.number))}
                      className="btn-secondary text-[12px] py-2 px-3.5 text-amber-700 hover:bg-amber-50 border-amber-200"
                    >
                      <span className="material-symbols-outlined text-[16px]">rate_review</span>
                      Request Changes
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo('changes-and-diff')}
                      className="btn-secondary text-[12px] py-2 px-3.5"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#2563eb]">difference</span>
                      Inspect Schema & Row Diff
                    </button>

                    {roleCapabilities.canMergeProtectedMain && (
                      <button
                        type="button"
                        disabled={isOperationPending || activeMr.status === 'MERGED' || activeMr.status === 'CONFLICT'}
                        onClick={() => void executeMerge(activeMr.number)}
                        className="btn-primary text-[12px] py-2 px-3.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">merge</span>
                        Execute Merge
                      </button>
                    )}
                  </div>

                  {/* Request Changes feedback box */}
                  {showRejectInput === activeMr.number && (
                    <div className="p-3.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] space-y-2 animate-in fade-in">
                      <label className="block text-[12px] font-semibold text-[#10172a]">
                        Reviewer Feedback & Change Request Note
                      </label>
                      <textarea
                        rows={3}
                        value={rejectReason[activeMr.number] || ''}
                        onChange={(e) =>
                          setRejectReason((prev) => ({ ...prev, [activeMr.number]: e.target.value }))
                        }
                        placeholder="Detail required schema adjustments or test coverage before approval..."
                        className="vdb-input w-full text-[12px] font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(null)}
                          className="btn-secondary text-[11px] py-1 px-2.5"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRejectInput(null);
                          }}
                          className="btn-primary text-[11px] py-1 px-2.5 bg-amber-600 hover:bg-amber-700"
                        >
                          Submit Change Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
