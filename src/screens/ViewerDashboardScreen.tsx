import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const ViewerDashboardScreen: React.FC = () => {
  const {
    activeRepo,
    activeBranch,
    repositories,
    branches,
    tables,
    commits,
    mergeRequests,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    navigateTo,
    selectRepository,
    selectBranch,
    setSelectedTableName,
    setApiContractDrawerOpen,
  } = useVersionDb();

  return (
    <div className="vdb-page space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5263a0] mb-1">
            <span>Repository Explorer</span>
            <span className="text-[#c5c9e4]">/</span>
            <span className="badge badge-neutral text-[10px] font-mono">Read-Only Viewer</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Viewer Dashboard
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Read-only exploration of database repositories, schema definitions, tables, commit timelines, and merge request statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('sql-workspace')}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">terminal</span>
            Read-Only Query Console
          </button>
          <button
            type="button"
            onClick={() => navigateTo('changes-and-diff')}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">difference</span>
            View Version Diffs
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

      {/* Viewer Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Authorized Repos
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">dns</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {repositories.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Permitted by repository membership
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Branches
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">account_tree</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {branches.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Default: {activeRepo?.defaultBranch || 'main'}
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Database Tables
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">table_rows</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {tables.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Collections in current snapshot
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Commit History
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">commit</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {commits.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            Version history entries
          </div>
        </div>
      </div>

      {/* Main Grid: Authorized Repositories & Tables (8 cols) + Commits & MRs (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          {/* Authorized Repositories Table */}
          <div className="vdb-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f3fb] flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#10172a]">Authorized Repositories</h2>
                <p className="text-[11px] text-[#5263a0]">
                  Repositories you have been granted read or viewer access to.
                </p>
              </div>
              <span className="text-[12px] font-mono text-[#8890b8]">
                {repositories.length} permitted
              </span>
            </div>

            {repositories.length === 0 ? (
              <div className="p-8 text-center text-[#5263a0] text-[13px]">
                No repositories available. An administrator or repository owner must grant you membership.
              </div>
            ) : (
              <table className="vdb-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Default Branch</th>
                    <th>Engine</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {repositories.map((repo) => {
                    const isActive = repo.id === activeRepo?.id;

                    return (
                      <tr key={repo.id} className="hover:bg-[#f8f9ff]">
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[17px] text-[#2563eb]">dns</span>
                            <span className="font-semibold text-[#10172a] text-[13px]">{repo.name}</span>
                            {isActive && <span className="badge badge-blue">Active</span>}
                          </div>
                          {repo.instanceDesc && (
                            <div className="text-[11px] text-[#5263a0] mt-0.5">{repo.instanceDesc}</div>
                          )}
                        </td>
                        <td className="font-mono text-[12px] text-[#5263a0]">{repo.defaultBranch}</td>
                        <td className="text-[12px] text-[#5263a0]">{repo.engine} {repo.engineVersion}</td>
                        <td>
                          <span className="badge badge-emerald">Available</span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              selectRepository(repo.id);
                              navigateTo('schema-explorer');
                            }}
                            className="btn-secondary text-[11px] py-1 px-2.5"
                          >
                            Explore Schema →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Database Collections / Tables */}
          <div className="vdb-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f3fb] flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#10172a]">
                  Schema Tables ({activeRepo?.name ?? 'No Repo'})
                </h2>
                <p className="text-[11px] text-[#5263a0]">
                  Branch: <strong className="font-mono text-[#2563eb]">{activeBranch || 'main'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('table-data')}
                className="text-[12px] font-semibold text-[#2563eb] hover:underline"
              >
                Table Data View →
              </button>
            </div>

            {tables.length === 0 ? (
              <div className="p-8 text-center text-[#5263a0] text-[13px]">
                No tables defined on this branch.
              </div>
            ) : (
              <div className="divide-y divide-[#f1f3fb]">
                {tables.map((t) => (
                  <div
                    key={t.name}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#f8f9ff] transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-[#10172a] text-[13px] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#8890b8]">table_chart</span>
                        <span>{t.schema}.{t.name}</span>
                        <span className="text-[11px] font-mono text-[#8890b8]">
                          ({t.columns.length} columns)
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#5263a0] mt-0.5">
                        PK: {t.primaryKey} · {t.rowCountLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTableName(t.name);
                        navigateTo('table-data');
                      }}
                      className="text-[11px] font-mono text-[#2563eb] hover:underline"
                    >
                      Browse Rows →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Recent Timeline & Merge Status (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Read-Only Notice Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-[13px]">
              <span className="material-symbols-outlined text-[18px] text-[#2563eb]">visibility</span>
              <span>Read-Only Viewer Access</span>
            </div>
            <p className="text-[12px] text-blue-800 leading-relaxed">
              Your account is authorized to view data, commits, schema definitions, and diffs. Staging edits, branch creation, and merge approvals require elevated permissions.
            </p>
          </div>

          {/* Recent Commits */}
          <div className="vdb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#10172a]">Recent Commits</h3>
              <button
                type="button"
                onClick={() => navigateTo('commits-and-history')}
                className="text-[11px] font-semibold text-[#2563eb] hover:underline"
              >
                All →
              </button>
            </div>
            {commits.length === 0 ? (
              <p className="text-[12px] text-[#5263a0]">No commits found.</p>
            ) : (
              <div className="space-y-2">
                {commits.slice(0, 5).map((c) => (
                  <div
                    key={c.hash}
                    className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px]"
                  >
                    <div className="font-semibold text-[#10172a] truncate">{c.message}</div>
                    <div className="font-mono text-[10px] text-[#5263a0] mt-1 flex justify-between">
                      <span className="text-[#2563eb]">{c.hash}</span>
                      <span>{c.timestampRelative}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merge Requests Status */}
          <div className="vdb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#10172a]">Merge Request Status</h3>
              <button
                type="button"
                onClick={() => navigateTo('merge-requests')}
                className="text-[11px] font-semibold text-[#2563eb] hover:underline"
              >
                View →
              </button>
            </div>
            {mergeRequests.length === 0 ? (
              <p className="text-[12px] text-[#5263a0]">No open merge requests.</p>
            ) : (
              <div className="space-y-1.5">
                {mergeRequests.slice(0, 4).map((mr) => (
                  <div
                    key={mr.id}
                    className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-[#2563eb]">#{mr.number}</span>
                      <span className="badge badge-neutral text-[10px]">{mr.status}</span>
                    </div>
                    <div className="font-medium text-[#10172a] text-[12px] mt-0.5 truncate">{mr.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
