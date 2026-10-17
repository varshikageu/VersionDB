import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const AuditLogsScreen: React.FC = () => {
  const {
    auditLogs,
    exportAuditLedger,
    isOperationPending,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter(
    (entry) =>
      entry.summary.toLowerCase().includes(search.toLowerCase()) ||
      entry.actorHandle.toLowerCase().includes(search.toLowerCase()) ||
      entry.actionType.toLowerCase().includes(search.toLowerCase()) ||
      entry.targetResource.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Immutable Governance Ledger
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">Audit Logs</h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Cryptographically chained audit trail of commits, conflict resolutions, approvals, rollbacks, and RBAC updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter actor, action, resource..."
              aria-label="Filter audit logs"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] w-56 transition-all"
            />
          </div>
          <button
            type="button"
            disabled={isOperationPending}
            onClick={() => void exportAuditLedger('json')}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">download</span>
            {isOperationPending ? 'Exporting...' : 'Export JSON'}
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

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={6} columns={6} />
      ) : filteredLogs.length === 0 ? (
        <EmptyStateCard
          icon="fact_check"
          title={
            auditLogs.length === 0
              ? 'No Audit Log Events Recorded'
              : `No audit entries match "${search}"`
          }
          description={
            auditLogs.length === 0
              ? 'No audit events are loaded because no backend service is configured or no audited operations have occurred.'
              : 'Clear the search filter to view recorded events.'
          }
          actionLabel={search ? 'Clear Search Filter' : undefined}
          onAction={search ? () => setSearch('') : undefined}
        />
      ) : (
        <div className="vdb-card overflow-hidden">
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Actor & Role</th>
                <th>Action</th>
                <th>Resource / Branch</th>
                <th>Summary</th>
                <th className="text-right">Ledger Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8f9ff]">
                  <td className="font-mono text-[12px] text-[#5263a0] whitespace-nowrap">
                    <div className="text-[#10172a] font-medium">{log.timestampRelative}</div>
                    <div className="text-[10px] text-[#8890b8]">{log.timestampUtc}</div>
                  </td>
                  <td>
                    <div className="font-medium text-[#10172a] text-[13px]">{log.actorName}</div>
                    <div className="font-mono text-[11px] text-[#5263a0]">
                      {log.actorHandle} • {log.actorRole}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="font-mono text-[12px]">
                    <div className="text-[#10172a] font-semibold">{log.targetResource}</div>
                    <div className="text-[11px] text-[#2563eb]">{log.branch}</div>
                  </td>
                  <td className="text-[12px] text-[#5263a0] max-w-md">{log.summary}</td>
                  <td className="text-right font-mono text-[11px] text-[#8890b8]">
                    {log.immutableHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
