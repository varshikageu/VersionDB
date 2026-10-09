import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  ErrorStateCard,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const SqlWorkspaceScreen: React.FC = () => {
  const {
    activeRepo,
    activeBranch,
    tables,
    views,
    queryTabs,
    activeQueryTabId,
    setActiveQueryTabId,
    updateActiveQuerySql,
    addNewQueryTab,
    closeQueryTab,
    lastQueryResult,
    isQueryExecuting,
    executeActiveQuery,
    cancelActiveQuery,
    stagedDdlChanges,
    stagedRowMutations,
    stageDdlChange,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    navigateTo,
    setCommitModalOpen,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [resultSubTab, setResultSubTab] = useState<'rows' | 'explain' | 'messages'>('rows');

  const activeTab = queryTabs.find((t) => t.id === activeQueryTabId) || queryTabs[0];
  const totalStaged = stagedDdlChanges.length + stagedRowMutations.length;

  const isDdlOrDmlStatement = /^\s*(ALTER|CREATE|DROP|UPDATE|INSERT|DELETE)\b/i.test(
    activeTab.sql || ''
  );

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-code-sm text-xs text-secondary mb-1">
            <span>{activeRepo ? activeRepo.name : 'Unconnected Repository'}</span>
            <span>/</span>
            <span className="text-primary font-semibold">{activeBranch || 'No Branch'}</span>
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            SQL Workspace & Isolated Query Runner
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isQueryExecuting ? (
            <button
              type="button"
              onClick={cancelActiveQuery}
              className="px-4 py-2 rounded-lg bg-error text-white font-body-sm text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">stop_circle</span>
              Cancel Query
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void executeActiveQuery()}
              className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-xs font-semibold shadow-sm hover:opacity-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              Run Query
            </button>
          )}
          {isDdlOrDmlStatement && (
            <button
              type="button"
              onClick={() =>
                void stageDdlChange(
                  'sql_workspace',
                  activeTab.sql.trim(),
                  `Staged SQL mutation from ${activeTab.title}`
                )
              }
              className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/30 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-primary">playlist_add</span>
              Stage for Commit
            </button>
          )}
          {totalStaged > 0 && (
            <button
              type="button"
              onClick={() => setCommitModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-primary-fixed text-primary font-code-sm text-xs font-semibold"
            >
              Commit ({totalStaged})
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Catalog Sidebar */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-label-mono text-label-sm uppercase text-secondary">
              Schema Catalog
            </span>
            <button
              type="button"
              onClick={() => navigateTo('schema-explorer')}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Explorer
            </button>
          </div>

          {tables.length === 0 && views.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <span className="material-symbols-outlined text-secondary text-xl">schema</span>
              <div className="font-body-sm text-xs font-medium text-on-surface">
                No Catalog Objects Loaded
              </div>
              <p className="font-body-sm text-[11px] text-secondary">
                Connect a backend repository to introspect tables, columns, and views.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="font-label-mono text-[10px] uppercase text-secondary mb-1">
                  Tables ({tables.length})
                </div>
                <div className="space-y-1">
                  {tables.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => updateActiveQuerySql(`SELECT * FROM ${t.schema}.${t.name} LIMIT 50;`)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-surface-container-low font-code-sm text-xs text-on-surface flex items-center justify-between"
                    >
                      <span>{t.name}</span>
                      <span className="text-[10px] text-secondary">{t.rowCountLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right SQL Editor & Results Panel */}
        <div className="lg:col-span-9 space-y-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-xs">
            {/* Query Tabs */}
            <div className="bg-surface-container-low px-3 py-2 border-b border-surface-container flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {queryTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-code-sm cursor-pointer transition-colors ${
                      tab.id === activeQueryTabId
                        ? 'bg-white text-primary font-semibold shadow-2xs border border-outline-variant/25'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                    onClick={() => setActiveQueryTabId(tab.id)}
                  >
                    <span>{tab.title}</span>
                    {queryTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeQueryTab(tab.id);
                        }}
                        className="text-secondary hover:text-error"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addNewQueryTab()}
                  className="px-2 py-1 rounded text-xs font-code-sm text-secondary hover:text-primary"
                  title="New SQL Buffer"
                >
                  + New Tab
                </button>
              </div>
              <span className="font-code-sm text-[11px] text-secondary">
                Isolated Execution (Does not auto-commit)
              </span>
            </div>

            {/* SQL Textarea */}
            <div className="p-3 bg-[#0f172a]">
              <textarea
                rows={8}
                value={activeTab.sql}
                onChange={(e) => updateActiveQuerySql(e.target.value)}
                placeholder="-- Enter a SQL statement to execute against the connected database branch..."
                aria-label="SQL Query Editor"
                className="w-full bg-transparent text-slate-100 font-code-sm text-xs leading-relaxed focus:outline-none resize-y"
              />
            </div>
          </div>

          {/* Query Results */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['rows', 'explain', 'messages'] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setResultSubTab(tabKey)}
                    className={`px-2.5 py-1 rounded text-xs font-label-mono uppercase transition-colors ${
                      resultSubTab === tabKey
                        ? 'bg-white text-primary font-semibold shadow-2xs'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    {tabKey === 'rows'
                      ? `Result Rows (${lastQueryResult?.rowCount ?? 0})`
                      : tabKey === 'explain'
                        ? 'Explain Plan'
                        : 'Engine Messages'}
                  </button>
                ))}
              </div>
              {lastQueryResult && lastQueryResult.status === 'success' && (
                <span className="font-code-sm text-[11px] text-secondary">
                  {lastQueryResult.executionTimeMs}ms • {lastQueryResult.rowCount} rows
                </span>
              )}
            </div>

            <div className="p-4">
              {isQueryExecuting ? (
                <div className="py-10 text-center space-y-2">
                  <span className="material-symbols-outlined text-primary text-2xl animate-spin">
                    progress_activity
                  </span>
                  <div className="font-body-sm text-xs text-secondary">
                    Executing SQL statement against backend...
                  </div>
                </div>
              ) : !lastQueryResult ? (
                <EmptyStateCard
                  icon="terminal"
                  title="No Query Executed Yet"
                  description="Enter a SQL statement above and click Run Query. Results are returned directly from the configured VersionDB backend without synthetic rows."
                />
              ) : lastQueryResult.status === 'error' ? (
                <ErrorStateCard
                  title="SQL Execution Failed"
                  message={
                    lastQueryResult.errorMessage ||
                    'The query could not be executed because the backend SQL engine is unavailable.'
                  }
                  code={lastQueryResult.errorCode || 'ERR_SQL_ENGINE'}
                  onRetry={() => void executeActiveQuery()}
                />
              ) : resultSubTab === 'rows' ? (
                lastQueryResult.rows.length === 0 ? (
                  <div className="py-8 text-center font-body-sm text-xs text-secondary">
                    Query executed successfully and returned 0 rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-code-sm text-xs">
                      <thead>
                        <tr className="border-b border-surface-container text-secondary">
                          {lastQueryResult.columns.map((col) => (
                            <th key={col.name} className="py-2 px-3">
                              {col.name}{' '}
                              <span className="text-[10px] opacity-70">({col.type})</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container">
                        {lastQueryResult.rows.map((row, idx) => (
                          <tr key={idx}>
                            {lastQueryResult.columns.map((col) => (
                              <td key={col.name} className="py-2 px-3 text-on-surface">
                                {String(row[col.name] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : resultSubTab === 'explain' ? (
                <pre className="font-code-sm text-xs text-on-surface bg-surface-container-low p-3 rounded-lg overflow-x-auto">
                  {lastQueryResult.explainPlan.length > 0
                    ? lastQueryResult.explainPlan.join('\n')
                    : 'No explain plan returned.'}
                </pre>
              ) : (
                <div className="space-y-1 font-code-sm text-xs text-secondary">
                  {lastQueryResult.messages.length > 0
                    ? lastQueryResult.messages.map((m, i) => <div key={i}>{m}</div>)
                    : 'No engine messages returned.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
