import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const ConflictResolutionScreen: React.FC = () => {
  const {
    conflicts,
    selectedConflictId,
    setSelectedConflictId,
    resolveConflictItem,
    escalateConflictToAdmin,
    isOperationPending,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [auditNote, setAuditNote] = useState('');

  const activeConflict =
    conflicts.find((c) => c.id === selectedConflictId) || conflicts[0] || null;

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            3-Way Schema & Primary-Key Collision Resolution
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Conflict Resolution Workspace
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect conflicting record or schema mutations between branches and submit a resolution
            to the backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('merge-requests')}
          className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25"
        >
          View Merge Requests
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

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : conflicts.length === 0 || !activeConflict ? (
        <EmptyStateCard
          icon="check_circle"
          title="No Merge Conflicts Detected"
          description="There are 0 unresolved record or schema conflicts. Conflicts are reported here when the VersionDB backend detects concurrent branch modifications on the same primary key or table schema."
          actionLabel="View Merge Requests"
          onAction={() => navigateTo('merge-requests')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {conflicts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedConflictId(c.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  activeConflict.id === c.id
                    ? 'bg-surface-container-lowest border-primary'
                    : 'bg-surface-container-lowest border-outline-variant/25'
                }`}
              >
                <div className="font-code-sm text-xs font-bold text-on-surface">
                  {c.table} ({c.primaryKeyField}={c.primaryKeyValue})
                </div>
                <div className="font-code-sm text-[11px] text-secondary mt-0.5">
                  MR #{c.mrNumber} • {c.sourceBranch} → {c.targetBranch}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-title-md text-on-surface">
                {activeConflict.table} — {activeConflict.recordContextLabel}
              </h2>
              <span className="font-code-sm text-xs text-secondary">
                {activeConflict.resolved ? 'Resolved' : 'Unresolved'}
              </span>
            </div>

            <div className="space-y-2">
              {activeConflict.fields.map((f) => (
                <div
                  key={f.field}
                  className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 grid grid-cols-3 gap-2 font-code-sm text-xs"
                >
                  <span className="font-semibold text-on-surface">{f.field}</span>
                  <span className="text-primary">OURS: {f.oursValue}</span>
                  <span className="text-error">THEIRS: {f.theirsValue}</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                Resolution Audit Justification
              </label>
              <input
                type="text"
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                placeholder="Document resolution reason for audit log..."
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() =>
                  void resolveConflictItem(activeConflict.id, 'OURS', undefined, auditNote)
                }
                className="px-3.5 py-2 rounded-lg bg-primary text-white font-body-sm text-xs font-semibold disabled:opacity-50"
              >
                Keep Target (OURS)
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() =>
                  void resolveConflictItem(activeConflict.id, 'THEIRS', undefined, auditNote)
                }
                className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/30 disabled:opacity-50"
              >
                Accept Incoming (THEIRS)
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() =>
                  void escalateConflictToAdmin(
                    activeConflict.id,
                    auditNote || 'Escalated for Lead DBA review'
                  )
                }
                className="px-3.5 py-2 rounded-lg bg-error/10 text-error font-body-sm text-xs font-semibold disabled:opacity-50"
              >
                Escalate to Lead DBA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
