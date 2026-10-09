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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Point-in-Time WAL Recovery
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Time Machine & Historical Rollback
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect verified WAL LSN checkpoints and execute audited point-in-time rollbacks.
          </p>
        </div>
        {activeSnapshot && (
          <button
            type="button"
            onClick={() => setRollbackModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-error text-white font-body-sm text-xs font-semibold shadow-sm"
          >
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-2.5">
            {snapshots.map((snap) => (
              <button
                key={snap.id}
                type="button"
                onClick={() => setSelectedSnapshotId(snap.id)}
                className={`w-full text-left p-4 rounded-xl border ${
                  activeSnapshot?.id === snap.id
                    ? 'bg-surface-container-lowest border-primary'
                    : 'bg-surface-container-lowest border-outline-variant/25'
                }`}
              >
                <div className="font-code-sm text-xs font-bold text-primary">
                  {snap.ref} ({snap.commitHash})
                </div>
                <div className="font-headline text-body-sm font-semibold text-on-surface mt-0.5">
                  {snap.label}
                </div>
                <div className="font-code-sm text-[11px] text-secondary mt-1">
                  WAL LSN: {snap.walLsn} • {snap.timestampUtc}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-7">
            {activeSnapshot && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-6 space-y-4">
                <h2 className="font-headline text-title-md text-on-surface">
                  Rollback Plan Preview — {activeSnapshot.ref}
                </h2>
                <pre className="p-3.5 rounded-lg bg-surface-container-low font-code-sm text-xs text-on-surface overflow-x-auto">
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
