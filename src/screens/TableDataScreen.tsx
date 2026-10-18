
import React, { useState } from 'react';
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
    stageInsertRow,
  } = useVersionDb();

  const activeTable =
    tables.find((t) => t.name === selectedTableName) || tables[0] || null;
  const rows = activeTable ? tableRowsByTable[activeTable.name] || [] : [];

  const [collection, setCollection] = useState(activeTable?.name || '');
  const [recordId, setRecordId] = useState('');
  const [jsonData, setJsonData] = useState('{\n  \n}');
  const [formError, setFormError] = useState('');
  const [isStaging, setIsStaging] = useState(false);

  const handleStageRecord = async () => {
    setFormError('');

    const cleanCollection = collection.trim();
    const cleanId = recordId.trim();

    if (!cleanCollection || !cleanId) {
      setFormError('Collection name and Record ID are required.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      setFormError('Invalid JSON. Please correct the record data.');
      return;
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      setFormError('Record data must be a JSON object.');
      return;
    }

    const row = parsed as Record<string, unknown>;

    if (row.id !== undefined && String(row.id) !== cleanId) {
      setFormError('The JSON id must match the Record ID field.');
      return;
    }

    const newRow = { ...row, id: cleanId };

    setIsStaging(true);
    try {
      const result = await stageInsertRow(cleanCollection, newRow);
      if (!result.ok) {
        setFormError(result.error || 'Could not stage this record.');
        return;
      }

      setSelectedTableName(cleanCollection);
      setRecordId('');
      setJsonData('{\n  \n}');
      setFormError('');
    } finally {
      setIsStaging(false);
    }
  };

  return (
    <div className="vdb-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Versioned Record Browser
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Table Data Browser
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-1">
            Add JSON records to a collection, stage changes, and commit them to your branch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tables.length > 0 && (
            <select
              value={activeTable?.name || ''}
              onChange={(e) => {
                setSelectedTableName(e.target.value);
                setCollection(e.target.value);
              }}
              className="rounded-lg border border-[#e2e5f6] bg-white px-3 py-2 font-mono text-[12px]"
            >
              {tables.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.schema}.{table.name}
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

      <section className="vdb-card p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#10172a]">
            Add Record
          </h2>
          <p className="text-[12px] text-[#687397] mt-1">
            Records are JSON objects. Staging does not commit them automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-[12px] font-medium text-[#5263a0] space-y-1">
            Collection name
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="e.g. users"
              className="w-full rounded-lg border border-[#e2e5f6] px-3 py-2 text-sm text-[#10172a]"
            />
          </label>

          <label className="text-[12px] font-medium text-[#5263a0] space-y-1">
            Record ID
            <input
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="e.g. user-001"
              className="w-full rounded-lg border border-[#e2e5f6] px-3 py-2 text-sm text-[#10172a]"
            />
          </label>
        </div>

        <label className="block text-[12px] font-medium text-[#5263a0] space-y-1">
          Record data (JSON)
          <textarea
            value={jsonData}
            onChange={(e) => setJsonData(e.target.value)}
            rows={7}
            spellCheck={false}
            className="w-full rounded-lg border border-[#e2e5f6] px-3 py-2 font-mono text-[12px] text-[#10172a]"
          />
        </label>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleStageRecord()}
          disabled={isStaging || isCatalogLoading}
          className="btn-primary disabled:opacity-50"
        >
          {isStaging ? 'Staging...' : 'Stage Record'}
        </button>
      </section>

      <section className="vdb-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f1f3fb]">
          <h2 className="font-semibold text-[13px] text-[#10172a]">
            {activeTable
              ? `${activeTable.schema}.${activeTable.name}`
              : 'Committed Collections'}
          </h2>
          <p className="text-[12px] text-[#8890b8] mt-1">
            {rows.length} committed records loaded
          </p>
        </div>

        {isCatalogLoading ? (
          <TableSkeletonLoader rows={5} columns={5} />
        ) : !activeTable || rows.length === 0 ? (
          <div className="p-5">
            <EmptyStateCard
              icon="table_rows"
              title="No Committed Records"
              description="Stage a record above, then commit your staged changes. The collection will appear here after the committed workspace refreshes."
              actionLabel="Open SQL Workspace"
              onAction={() => navigateTo('sql-workspace')}
              secondaryActionLabel="Refresh"
              onSecondaryAction={() => void refreshWorkspaceCatalog()}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="vdb-table font-mono text-[12px]">
              <thead>
                <tr>
                  {activeTable.columns.map((column) => (
                    <th key={column.name}>{column.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    {activeTable.columns.map((column) => (
                      <td key={column.name} className="text-[#10172a]">
                        {String(row[column.name] ?? 'NULL')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
