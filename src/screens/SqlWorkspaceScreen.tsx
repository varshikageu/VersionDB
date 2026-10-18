import React, { useState } from 'react';
import {
  BackendStatusBanner,
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

  const isInvalidPgSyntax = /^\s*SHOW\s+(DATABASES|TABLES|COLUMNS|SCHEMAS)\b/i.test(activeTab.sql || '');

  return (
    <div className="vdb-page">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5263a0] mb-1">
            <span>{activeRepo ? activeRepo.name : 'Unconnected Repository'}</span>
            <span className="text-[#c5c9e4]">/</span>
            <span className="text-[#2563eb] font-semibold">{activeBranch || 'No Branch'}</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            SQL Workspace
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Query editor and staged mutation composer for isolated database branches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isQueryExecuting ? (
            <button
              type="button"
              onClick={cancelActiveQuery}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              <span className="material-symbols-outlined text-[15px]">stop_circle</span>
              Cancel
            </button>
          ) : (
            // <button
            //   type="button"
            //   onClick={() => void executeActiveQuery()}
            //   title="SQL execution is not yet implemented in the backend"
            //   className="btn-secondary opacity-60 cursor-not-allowed"
            //   disabled
            // >
            //   <span className="material-symbols-outlined text-[15px]">play_arrow</span>
            //   Run Query
            // </button>

            <button
              type="button"
              onClick={() => void executeActiveQuery()}
               title={
                !activeRepo
                  ? 'Connect or select a repository to run SQL queries'
                  : 'Execute SQL query against active branch snapshot'
              }
              className={`btn-primary ${!activeRepo ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!activeRepo}
              title="Execute SQL query"
              className="btn-primary"
              disabled={!activeRepo || !activeBranch || !activeTab?.sql?.trim() || isQueryExecuting}
            
              <span className="material-symbols-outlined text-[15px]">play_arrow</span>
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
              className="btn-secondary text-[#2563eb] border-[#c2d4ff] hover:bg-[#eff4ff]"
            >
              <span className="material-symbols-outlined text-[15px]">playlist_add</span>
              Stage for Commit
            </button>
          )}
          {totalStaged > 0 && (
            <button
              type="button"
              onClick={() => setCommitModalOpen(true)}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">commit</span>
              Commit ({totalStaged})
            </button>
          )}
        </div>
      </div>

      {/* SQL Engine Scope & Capabilities Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 text-blue-950">
        <span className="material-symbols-outlined text-[#2563eb] text-[20px] mt-0.5 shrink-0">database</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#1e40af] flex items-center gap-2">
            <span>Branch Snapshot SQL Execution Engine</span>
            <span className="text-[10px] bg-blue-200/80 text-blue-900 px-1.5 py-0.2 rounded font-mono font-medium">Active</span>
          </div>
          <p className="text-[12px] opacity-90 mt-0.5 leading-relaxed">
            Execute read queries directly against version-controlled collection snapshots on branch <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded text-blue-900 font-semibold">{activeBranch || 'main'}</code> via <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded text-blue-900">POST /api/repos/:repoId/sql/execute</code>.
            Supported operations include single-collection <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded text-blue-900">SELECT</code> statements with column selection, <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded text-blue-900">WHERE</code> filters, and <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded text-blue-900">LIMIT</code>.
            To stage mutations (<code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">CREATE</code>, <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">INSERT</code>, <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">UPDATE</code>, <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">DELETE</code>) into VersionDB's commit history, use <strong>Stage for Commit</strong>.
          </p>
          {isInvalidPgSyntax && (
            <p className="text-[12px] text-amber-950 mt-1.5 font-semibold">
              ⚠ <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">SHOW DATABASES</code> is MySQL syntax and is not valid PostgreSQL.
              Select from your collection name (e.g. <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">SELECT * FROM &lt;collection&gt; LIMIT 50;</code>).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="shrink-0 btn-secondary text-[11px] py-1.5 bg-white text-blue-950 border-blue-300 hover:bg-blue-100"
        >
          View Contract
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Catalog Sidebar */}
        <div className="lg:col-span-3 vdb-card p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#f1f3fb]">
            <span className="text-[11px] font-mono text-[#5263a0] uppercase tracking-wider font-semibold">
              Schema Catalog
            </span>
            <button
              type="button"
              onClick={() => navigateTo('schema-explorer')}
              className="text-[11px] font-semibold text-[#2563eb] hover:underline"
            >
              Explorer →
            </button>
          </div>

          {tables.length === 0 && views.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <span className="material-symbols-outlined text-[#8890b8] text-[24px]">schema</span>
              <div className="text-[12px] font-medium text-[#10172a]">
                No Catalog Objects Loaded
              </div>
              <p className="text-[11px] text-[#5263a0]">
                Connect a backend repository to introspect tables, columns, and views.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-[#8890b8] font-bold mb-1.5">
                  Tables ({tables.length})
                </div>
                <div className="space-y-1">
                  {tables.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => updateActiveQuerySql(`SELECT * FROM ${t.schema}.${t.name} LIMIT 50;`)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#f5f6ff] font-mono text-[12px] text-[#10172a] flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] text-[#8890b8] shrink-0">{t.rowCountLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right SQL Editor & Results Panel */}
        <div className="lg:col-span-9 space-y-4">
          <div className="vdb-card overflow-hidden">
            {/* Query Tabs */}
            <div className="bg-[#f8f9ff] px-3.5 py-2 border-b border-[#e2e5f6] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {queryTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-mono cursor-pointer transition-all ${tab.id === activeQueryTabId
                        ? 'bg-white text-[#2563eb] font-semibold shadow-xs border border-[#e2e5f6]'
                        : 'text-[#5263a0] hover:text-[#10172a]'
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
                        className="text-[#8890b8] hover:text-red-500 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addNewQueryTab()}
                  className="px-2 py-1 rounded-lg text-[12px] font-mono text-[#5263a0] hover:text-[#2563eb] hover:bg-white"
                  title="New SQL Buffer"
                >
                  + New Tab
                </button>
              </div>
              <span className="font-mono text-[11px] text-[#8890b8]">
                Isolated Execution
              </span>
            </div>

            {/* SQL Textarea */}
            <div className="p-3.5 bg-[#0f172a]">
              <textarea
                rows={8}
                value={activeTab.sql}
                onChange={(e) => updateActiveQuerySql(e.target.value)}
                placeholder="-- Enter a SQL statement to execute against the connected database branch..."
                aria-label="SQL Query Editor"
                className="w-full bg-transparent text-slate-100 font-mono text-[12px] leading-relaxed focus:outline-none resize-y"
              />
            </div>
          </div>

          {/* Query Results */}
          <div className="vdb-card overflow-hidden">
            <div className="px-4 py-2 bg-[#f8f9ff] border-b border-[#e2e5f6] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {(['rows', 'explain', 'messages'] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setResultSubTab(tabKey)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono uppercase font-semibold transition-all ${resultSubTab === tabKey
                        ? 'bg-white text-[#2563eb] shadow-xs border border-[#e2e5f6]'
                        : 'text-[#5263a0] hover:text-[#10172a]'
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
                <span className="font-mono text-[11px] text-[#8890b8]">
                  {lastQueryResult.executionTimeMs}ms • {lastQueryResult.rowCount} rows
                </span>
              )}
            </div>

            <div className="p-4">
              {isQueryExecuting ? (
                <div className="py-10 text-center space-y-2">
                  <span className="material-symbols-outlined text-[#2563eb] text-[24px] animate-spin">
                    progress_activity
                  </span>
                  <div className="text-[12px] text-[#5263a0]">
                    Executing SQL statement against backend...
                  </div>
                </div>
              ) : !lastQueryResult ? (
                <div className="py-8 text-center space-y-2">
                  <span className="material-symbols-outlined text-[#8890b8] text-[28px]">terminal</span>
                  <div className="text-[13px] font-semibold text-[#10172a]">Ready to Execute Query</div>
                  <p className="text-[12px] text-[#5263a0] max-w-md mx-auto leading-relaxed">
                    Enter a <code className="font-mono text-[11px] bg-[#f1f3fb] px-1 py-0.5 rounded">SELECT</code> query in the editor above and click <strong>Run Query</strong> to inspect version-controlled snapshot rows on branch <span className="font-semibold">{activeBranch || 'main'}</span>.
                  </p>
                </div>
              ) : lastQueryResult.status === 'error' ? (
                <ErrorStateCard
                  title="Query Execution Error"
                  message={
                    lastQueryResult.errorMessage ||
                    'An error occurred while executing the SQL statement against the branch snapshot.'
                  }
                  code={lastQueryResult.errorCode || 'SQL_EXECUTION_ERROR'}
                />
              ) : resultSubTab === 'rows' ? (
                lastQueryResult.rows.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-[#5263a0]">
                    Query executed successfully and returned 0 rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="vdb-table font-mono text-[12px]">
                      <thead>
                        <tr>
                          {lastQueryResult.columns.map((col) => (
                            <th key={col.name}>
                              {col.name}{' '}
                              <span className="text-[10px] opacity-70">({col.type})</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lastQueryResult.rows.map((row, idx) => (
                          <tr key={idx}>
                            {lastQueryResult.columns.map((col) => (
                              <td key={col.name} className="text-[#10172a]">
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
                <pre className="font-mono text-[12px] text-[#10172a] bg-[#f8f9ff] border border-[#e2e5f6] p-3 rounded-lg overflow-x-auto">
                  {lastQueryResult.explainPlan.length > 0
                    ? lastQueryResult.explainPlan.join('\n')
                    : 'No explain plan returned.'}
                </pre>
              ) : (
                <div className="space-y-1 font-mono text-[12px] text-[#5263a0]">
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
