import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const SchemaExplorerScreen: React.FC = () => {
  const {
    tables,
    views,
    selectedTableName,
    setSelectedTableName,
    stageDdlChange,
    isOperationPending,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState(' VARCHAR(255)');

  const activeTable = tables.find((t) => t.name === selectedTableName) || tables[0] || null;

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Relational Catalog Metadata
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Schema Explorer (Tables, Columns & Views)
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Introspect table structures, primary/foreign keys, indexes, and DDL definitions from the connected branch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('sql-workspace')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px] text-[#2563eb]">terminal</span>
          Open SQL Workspace
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
        <TableSkeletonLoader rows={5} columns={5} />
      ) : tables.length === 0 && views.length === 0 ? (
        <EmptyStateCard
          icon="schema"
          title="No Schema Objects Introspected"
          description="No tables or views are loaded because no backend database repository is connected. Connect a VersionDB backend via VITE_API_BASE_URL to introspect live PostgreSQL catalog schemas."
          actionLabel="Register Repository"
          onAction={() => navigateTo('repositories')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 vdb-card p-4 space-y-3">
            <div className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider font-semibold pb-2 border-b border-[#f1f3fb]">
              Tables ({tables.length})
            </div>
            <div className="space-y-1">
              {tables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTableName(t.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[12px] flex items-center justify-between transition-colors ${
                    activeTable?.name === t.name
                      ? 'bg-[#eff4ff] text-[#2563eb] font-semibold border border-[#c2d4ff]'
                      : 'text-[#10172a] hover:bg-[#f8f9ff]'
                  }`}
                >
                  <span className="truncate">
                    {t.schema}.{t.name}
                  </span>
                  <span className="text-[10px] text-[#8890b8] shrink-0">{t.rowCountLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {activeTable && (
              <div className="vdb-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f1f3fb]">
                  <div>
                    <h2 className="font-mono text-[16px] font-bold text-[#10172a]">
                      {activeTable.schema}.{activeTable.name}
                    </h2>
                    <span className="text-[12px] text-[#5263a0]">
                      Total Rows: {activeTable.rowCountLabel}
                    </span>
                  </div>
                  <span className="badge badge-blue">
                    PK: {activeTable.primaryKey}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="vdb-table font-mono text-[12px]">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTable.columns.map((col) => (
                        <tr key={col.name}>
                          <td className="font-semibold text-[#10172a]">{col.name}</td>
                          <td className="text-[#2563eb]">{col.dataType}</td>
                          <td>
                            <span className={`badge ${col.nullable ? 'badge-neutral' : 'badge-amber'}`}>
                              {col.nullable ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="text-[#5263a0]">{col.defaultValue || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 border-t border-[#f1f3fb] flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="New column name"
                    className="vdb-input font-mono text-[12px] py-1.5 w-44"
                  />
                  <input
                    type="text"
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value)}
                    placeholder="Data type (e.g. VARCHAR(255))"
                    className="vdb-input font-mono text-[12px] py-1.5 w-52"
                  />
                  <button
                    type="button"
                    disabled={isOperationPending || !newColName.trim()}
                    onClick={() =>
                      void stageDdlChange(
                        activeTable.name,
                        `ALTER TABLE ${activeTable.schema}.${activeTable.name} ADD COLUMN ${newColName.trim()} ${newColType.trim()};`,
                        `Add column ${newColName.trim()} to ${activeTable.name}`
                      )
                    }
                    className="btn-primary text-[12px] py-2"
                  >
                    Stage ALTER TABLE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
