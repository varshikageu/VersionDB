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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Relational Catalog Metadata
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Schema Explorer (Tables, Columns & Views)
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Introspect table structures, primary/foreign keys, indexes, and DDL definitions from the
            connected branch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('sql-workspace')}
          className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25"
        >
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-4 space-y-3">
            <div className="font-label-mono text-label-sm uppercase text-secondary">
              Tables ({tables.length})
            </div>
            <div className="space-y-1">
              {tables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTableName(t.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg font-code-sm text-xs flex items-center justify-between ${
                    activeTable?.name === t.name
                      ? 'bg-primary-fixed/30 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span>
                    {t.schema}.{t.name}
                  </span>
                  <span className="text-[10px] text-secondary">{t.rowCountLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {activeTable && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-code-sm text-sm font-bold text-on-surface">
                    {activeTable.schema}.{activeTable.name}
                  </h2>
                  <span className="font-code-sm text-xs text-secondary">
                    PK: {activeTable.primaryKey}
                  </span>
                </div>

                <table className="w-full text-left border-collapse font-code-sm text-xs">
                  <thead>
                    <tr className="border-b border-surface-container text-secondary">
                      <th className="py-2">Column</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Nullable</th>
                      <th className="py-2">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {activeTable.columns.map((col) => (
                      <tr key={col.name}>
                        <td className="py-2 font-semibold text-on-surface">{col.name}</td>
                        <td className="py-2 text-primary">{col.dataType}</td>
                        <td className="py-2 text-secondary">{col.nullable ? 'YES' : 'NO'}</td>
                        <td className="py-2 text-secondary">{col.defaultValue || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pt-3 border-t border-surface-container flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="New column name"
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-code-sm text-xs"
                  />
                  <input
                    type="text"
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value)}
                    placeholder="Data type"
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-code-sm text-xs"
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
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-white font-body-sm text-xs font-semibold disabled:opacity-50"
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
