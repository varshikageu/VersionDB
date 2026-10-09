import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const TableDataScreen: React.FC = () => {
  const {
    tables,
    selectedTableName,
    setSelectedTableName,
    tableRowsByTable,
    stagedRowMutations,
    setCommitModalOpen,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const activeTable = tables.find((t) => t.name === selectedTableName) || tables[0] || null;
  const rows = activeTable ? tableRowsByTable[activeTable.name] || [] : [];

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Primary-Key Record Browser
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Table Data Browser & Row Staging
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect table records and stage row-level INSERT, UPDATE, or DELETE mutations for
            versioned commits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tables.length > 0 && (
            <select
              value={activeTable?.name || ''}
              onChange={(e) => setSelectedTableName(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-1.5 font-code-sm text-xs text-on-surface"
            >
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.schema}.{t.name}
                </option>
              ))}
            </select>
          )}
          {stagedRowMutations.length > 0 && (
            <button
              type="button"
              onClick={() => setCommitModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-primary text-white font-body-sm text-xs font-semibold"
            >
              Commit Staged ({stagedRowMutations.length})
            </button>
          )}
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
        <TableSkeletonLoader rows={5} columns={5} />
      ) : !activeTable || rows.length === 0 ? (
        <EmptyStateCard
          icon="table_rows"
          title="No Table Records Loaded"
          description="No database records are available. VersionDB does not populate tables with synthetic rows. Connect a live VersionDB backend to browse and stage real table data."
          actionLabel="Open SQL Workspace"
          onAction={() => navigateTo('sql-workspace')}
          secondaryActionLabel="Schema Explorer"
          onSecondaryAction={() => navigateTo('schema-explorer')}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-x-auto">
          <table className="w-full text-left border-collapse font-code-sm text-xs">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-container text-secondary">
                {activeTable.columns.map((c) => (
                  <th key={c.name} className="py-2.5 px-3">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {rows.map((r, idx) => (
                <tr key={idx}>
                  {activeTable.columns.map((c) => (
                    <td key={c.name} className="py-2.5 px-3 text-on-surface">
                      {String(r[c.name] ?? 'NULL')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
