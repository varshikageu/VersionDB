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
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Primary-Key Record Browser
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Table Data Browser & Row Staging
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect table records and stage row-level INSERT, UPDATE, or DELETE mutations for versioned commits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tables.length > 0 && (
            <select
              value={activeTable?.name || ''}
              onChange={(e) => setSelectedTableName(e.target.value)}
              className="rounded-lg border border-[#e2e5f6] bg-white px-3 py-1.5 font-mono text-[12px] text-[#10172a] focus:outline-none focus:border-[#2563eb]"
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
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">commit</span>
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
        <div className="vdb-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f3fb] flex items-center justify-between">
            <span className="font-mono text-[13px] font-semibold text-[#10172a]">
              {activeTable.schema}.{activeTable.name}
            </span>
            <span className="text-[12px] font-mono text-[#8890b8]">
              {rows.length} rows loaded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="vdb-table font-mono text-[12px]">
              <thead>
                <tr>
                  {activeTable.columns.map((c) => (
                    <th key={c.name}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#f8f9ff]">
                    {activeTable.columns.map((c) => (
                      <td key={c.name} className="text-[#10172a]">
                        {String(r[c.name] ?? 'NULL')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
