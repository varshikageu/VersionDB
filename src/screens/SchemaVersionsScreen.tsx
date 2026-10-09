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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            DDL Release Tagging
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Schema Versions & Migration Registry
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Track tagged schema releases, migration checksums, and schema drift status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('commits-and-history')}
          className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25"
        >
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label-mono text-label-sm uppercase text-secondary border-b border-surface-container">
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Commit</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4">Applied At</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
              {schemaVersions.map((sv) => (
                <tr key={sv.version}>
                  <td className="py-3.5 px-4 font-code-sm font-bold text-primary">{sv.version}</td>
                  <td className="py-3.5 px-4 font-code-sm text-xs text-on-surface">
                    {sv.commitHash}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-on-surface">{sv.ddlSummary}</td>
                  <td className="py-3.5 px-4 font-code-sm text-xs text-secondary">
                    {sv.appliedAtUtc}
                  </td>
                  <td className="py-3.5 px-4 font-label-mono text-[10px] uppercase text-secondary">
                    {sv.status}
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
