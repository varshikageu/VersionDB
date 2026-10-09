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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Immutable Governance Ledger
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">Audit Logs</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Cryptographically chained audit trail of commits, conflict resolutions, approvals,
            rollbacks, and RBAC updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter actor, action, resource..."
            aria-label="Filter audit logs"
            className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={isOperationPending}
            onClick={() => void exportAuditLedger('json')}
            className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/30 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">download</span>
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label-mono text-label-sm uppercase text-secondary border-b border-surface-container">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor & Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource / Branch</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4 text-right">Ledger Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container-low/50">
                  <td className="py-3 px-4 font-code-sm text-code-sm text-secondary whitespace-nowrap">
                    <div>{log.timestampRelative}</div>
                    <div className="text-[10px] text-secondary/70">{log.timestampUtc}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-on-surface">{log.actorName}</div>
                    <div className="font-code-sm text-[11px] text-secondary">
                      {log.actorHandle} • {log.actorRole}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded font-label-mono text-[10px] uppercase font-bold bg-surface-container text-on-surface">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-code-sm text-code-sm">
                    <div className="text-on-surface font-semibold">{log.targetResource}</div>
                    <div className="text-[11px] text-primary">{log.branch}</div>
                  </td>
                  <td className="py-3 px-4 text-secondary max-w-md">{log.summary}</td>
                  <td className="py-3 px-4 text-right font-code-sm text-code-sm text-secondary">
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
