import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const TimeMachineScreen: React.FC = () => {
  const {
    snapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    setRollbackModalOpen,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const activeSnapshot =
    snapshots.find((s) => s.id === selectedSnapshotId) || snapshots[0] || null;

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Point-in-Time WAL Recovery
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Time Machine & Historical Rollback
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect verified WAL LSN checkpoints and execute audited point-in-time rollbacks.
          </p>
        </div>
        {activeSnapshot && (
          <button
            type="button"
            onClick={() => setRollbackModalOpen(true)}
            className="btn-primary bg-red-600 hover:bg-red-700 text-white"
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            Rollback to {activeSnapshot.ref}
          </button>
        )}
      </div>

      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : snapshots.length === 0 ? (
        <EmptyStateCard
          icon="history"
          title="No Historical WAL Snapshots Available"
          description="No point-in-time WAL checkpoints are loaded because no backend repository is connected. Connect a VersionDB backend to inspect verified snapshots and rollback SQL plans."
          actionLabel="View Commits History"
          onAction={() => navigateTo('commits-and-history')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-2.5">
            {snapshots.map((snap) => {
              const isSelected = activeSnapshot?.id === snap.id;

              return (
                <button
                  key={snap.id}
                  type="button"
                  onClick={() => setSelectedSnapshotId(snap.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.08)] ring-1 ring-[#2563eb]'
                      : 'bg-white border-[#e2e5f6] hover:border-[#b3c5ff] hover:bg-[#fbfbfe]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] font-bold text-[#2563eb]">
                      {snap.ref}
                    </span>
                    <span className="badge badge-neutral">{snap.commitHash}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#10172a] mt-0.5">
                    {snap.label}
                  </div>
                  <div className="font-mono text-[11px] text-[#5263a0] mt-1.5">
                    WAL LSN: {snap.walLsn} • {snap.timestampUtc}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            {activeSnapshot && (
              <div className="vdb-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f1f3fb]">
                  <div>
                    <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider font-semibold">
                      Plan Preview
                    </span>
                    <h2 className="text-[16px] font-bold text-[#10172a] mt-0.5">
                      Rollback Plan Preview — {activeSnapshot.ref}
                    </h2>
                  </div>
                  <span className="badge badge-blue">{activeSnapshot.walLsn}</span>
                </div>
                <pre className="p-3.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] font-mono text-[11px] text-[#10172a] overflow-x-auto">
                  {activeSnapshot.rollbackSqlPreview.join('\n')}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
