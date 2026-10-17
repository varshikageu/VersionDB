import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const SchemaVersionsScreen: React.FC = () => {
  const {
    schemaVersions,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            DDL Release Tagging
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Schema Versions & Migration Registry
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Track tagged schema releases, migration checksums, and schema drift status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('commits-and-history')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px] text-[#2563eb]">commit</span>
          Commits History
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
        <TableSkeletonLoader rows={4} columns={5} />
      ) : schemaVersions.length === 0 ? (
        <EmptyStateCard
          icon="sell"
          title="No Tagged Schema Versions"
          description="No schema release tags are loaded because no backend repository is connected."
          actionLabel="View Commits History"
          onAction={() => navigateTo('commits-and-history')}
        />
      ) : (
        <div className="vdb-card overflow-hidden">
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Commit</th>
                <th>Summary</th>
                <th>Applied At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schemaVersions.map((sv) => (
                <tr key={sv.version} className="hover:bg-[#f8f9ff]">
                  <td className="font-mono font-bold text-[#2563eb] text-[13px]">{sv.version}</td>
                  <td className="font-mono text-[12px] text-[#10172a] font-medium">
                    {sv.commitHash}
                  </td>
                  <td className="text-[12px] text-[#10172a]">{sv.ddlSummary}</td>
                  <td className="font-mono text-[12px] text-[#5263a0]">
                    {sv.appliedAtUtc}
                  </td>
                  <td>
                    <span className="badge badge-emerald">
                      {sv.status}
                    </span>
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
