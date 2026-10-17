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
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            3-Way Schema & Primary-Key Collision Resolution
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Conflict Resolution Workspace
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect conflicting record or schema mutations between branches and submit a resolution to the backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('merge-requests')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px] text-[#2563eb]">merge</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-2.5">
            {conflicts.map((c) => {
              const isSelected = activeConflict.id === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConflictId(c.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.08)] ring-1 ring-[#2563eb]'
                      : 'bg-white border-[#e2e5f6] hover:border-[#b3c5ff] hover:bg-[#fbfbfe]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] font-bold text-[#10172a]">
                      {c.table}
                    </span>
                    <span className={`badge ${c.resolved ? 'badge-emerald' : 'badge-red'}`}>
                      {c.resolved ? 'Resolved' : 'Conflict'}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#5263a0]">
                    PK: {c.primaryKeyField}={c.primaryKeyValue}
                  </div>
                  <div className="font-mono text-[11px] text-[#8890b8] mt-1">
                    MR #{c.mrNumber} • {c.sourceBranch} → {c.targetBranch}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8">
            <div className="vdb-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f3fb]">
                <div>
                  <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider">
                    Collision Context
                  </span>
                  <h2 className="text-[17px] font-bold text-[#10172a] mt-0.5">
                    {activeConflict.table} — {activeConflict.recordContextLabel}
                  </h2>
                </div>
                <span className={`badge ${activeConflict.resolved ? 'badge-emerald' : 'badge-red'}`}>
                  {activeConflict.resolved ? 'Resolved' : 'Unresolved'}
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider block">
                  Field Values Comparison
                </span>
                {activeConflict.fields.map((f) => (
                  <div
                    key={f.field}
                    className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] grid grid-cols-3 gap-3 font-mono text-[12px] items-center"
                  >
                    <span className="font-semibold text-[#10172a]">{f.field}</span>
                    <div className="p-1.5 rounded bg-blue-50/70 border border-blue-100 text-[#2563eb]">
                      <span className="text-[10px] uppercase font-bold block opacity-70">Target (OURS)</span>
                      {f.oursValue}
                    </div>
                    <div className="p-1.5 rounded bg-red-50/70 border border-red-100 text-red-600">
                      <span className="text-[10px] uppercase font-bold block opacity-70">Incoming (THEIRS)</span>
                      {f.theirsValue}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Resolution Audit Justification
                </label>
                <input
                  type="text"
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  placeholder="Document resolution reason for audit log..."
                  className="vdb-input w-full text-[12px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#f1f3fb]">
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void resolveConflictItem(activeConflict.id, 'OURS', undefined, auditNote)
                  }
                  className="btn-primary text-[12px] py-1.5"
                >
                  Keep Target (OURS)
                </button>
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void resolveConflictItem(activeConflict.id, 'THEIRS', undefined, auditNote)
                  }
                  className="btn-secondary text-[12px] py-1.5"
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
                  className="btn-secondary text-[12px] py-1.5 text-red-600 hover:bg-red-50 hover:border-red-200"
                >
                  Escalate to Lead DBA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
