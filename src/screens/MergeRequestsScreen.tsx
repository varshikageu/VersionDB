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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Schema & Record Merge Pipeline
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">Merge Requests</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Review branch diffs, verify conflict resolution, and execute protected database merges.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateMrModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-b from-primary to-primary-container text-on-primary rounded-lg font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">merge</span>
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

      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low p-2.5 rounded-lg">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'OPEN', 'CONFLICT', 'NEEDS_ADMIN', 'READY', 'MERGED'] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded text-xs font-code-sm transition-colors ${
                  statusFilter === status
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Merge Requests..."
          className="px-3 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 font-body-sm text-xs text-on-surface"
        />
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-2.5">
            {filteredMrs.map((mr) => (
              <button
                key={mr.id}
                type="button"
                onClick={() => setSelectedMrNumber(mr.number)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeMr?.number === mr.number
                    ? 'bg-surface-container-lowest border-primary'
                    : 'bg-surface-container-lowest border-outline-variant/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-code-sm text-xs font-bold text-primary">#{mr.number}</span>
                  <span className="font-label-mono text-[10px] uppercase text-secondary">
                    {mr.status}
                  </span>
                </div>
                <div className="font-headline text-body-md font-semibold text-on-surface mt-1">
                  {mr.title}
                </div>
                <div className="font-code-sm text-[11px] text-secondary mt-1">
                  {mr.sourceBranch} → {mr.targetBranch}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-7">
            {activeMr && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-title-lg text-on-surface">
                    #{activeMr.number} — {activeMr.title}
                  </h2>
                  <span className="font-code-sm text-xs text-secondary">{activeMr.status}</span>
                </div>
                <p className="font-body-sm text-xs text-secondary">{activeMr.description}</p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isOperationPending}
                    onClick={() => void approveMergeRequest(activeMr.number)}
                    className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/30 disabled:opacity-50"
                  >
                    Approve Merge Request
                  </button>
                  <button
                    type="button"
                    disabled={isOperationPending}
                    onClick={() => void executeMerge(activeMr.number)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-xs font-semibold disabled:opacity-50"
                  >
                    Execute Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('changes-and-diff')}
                    className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-body-sm text-xs font-medium"
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
