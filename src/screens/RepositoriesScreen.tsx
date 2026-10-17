import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';
import { DatabaseConnectionMode } from '../types/versiondb';

export const RepositoriesScreen: React.FC = () => {
  const {
    repositories,
    activeRepo,
    selectRepository,
    setRepositoryConnectionMode,
    setCreateRepoModalOpen,
    navigateTo,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    deleteRepository,
    roleCapabilities,
    isOperationPending,
  } = useVersionDb();

  const [envFilter, setEnvFilter] = useState<'ALL' | 'Production' | 'Staging' | 'Development'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [repoToDelete, setRepoToDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!repoToDelete || isDeletingRepo) return;
    if (confirmationInput.trim() !== repoToDelete.name) {
      setDeleteError(`Please type "${repoToDelete.name}" exactly to confirm deletion.`);
      return;
    }
    setIsDeletingRepo(true);
    setDeleteError(null);
    const res = await deleteRepository(repoToDelete.id, confirmationInput.trim());
    setIsDeletingRepo(false);
    if (res.ok) {
      setRepoToDelete(null);
      setConfirmationInput('');
    } else {
      setDeleteError(res.error || 'Failed to delete repository.');
    }
  };

  const filteredRepos = repositories.filter((r) => {
    const matchesEnv = envFilter === 'ALL' ? true : r.environment === envFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.engine.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEnv && matchesSearch;
  });

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Cluster Fleet & Snapshot Storage
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">Database Repositories</h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Select an active database repository, inspect WAL replication telemetry, or register a new PostgreSQL cluster.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateRepoModalOpen(true)}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">add_circle</span>
          Register Repository
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

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#e2e5f6] p-2.5 rounded-xl shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex items-center gap-1">
          {(['ALL', 'Production', 'Staging', 'Development'] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setEnvFilter(env)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                envFilter === env
                  ? 'bg-[#10172a] text-white font-semibold shadow-xs'
                  : 'text-[#5263a0] hover:text-[#10172a] hover:bg-[#f1f3fb]'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-[15px] text-[#8890b8] absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              aria-label="Search repositories"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px] text-[#10172a] placeholder-[#8890b8] focus:outline-none focus:border-[#2563eb] focus:bg-white w-56 transition-all"
            />
          </div>
          <span className="text-[12px] font-mono text-[#8890b8]">
            {filteredRepos.length} of {repositories.length} repos
          </span>
        </div>
      </div>

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={6} />
      ) : filteredRepos.length === 0 ? (
        <EmptyStateCard
          icon="database"
          title={
            repositories.length === 0
              ? 'No Database Repositories Registered'
              : `No repositories match "${searchQuery || envFilter}"`
          }
          description={
            repositories.length === 0
              ? 'No repositories are loaded. Connect a VersionDB backend server via VITE_API_BASE_URL and register a PostgreSQL database.'
              : 'Adjust your environment filter or search query.'
          }
          actionLabel={repositories.length === 0 ? 'Register Repository' : 'Reset Filters'}
          onAction={() => {
            if (repositories.length === 0) {
              setCreateRepoModalOpen(true);
            } else {
              setEnvFilter('ALL');
              setSearchQuery('');
            }
          }}
        />
      ) : (
        <div className="vdb-card overflow-hidden">
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Repository & Engine</th>
                <th>Environment</th>
                <th>Default Branch</th>
                <th>Activity</th>
                <th>Connection Mode</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepos.map((repo) => {
                const isSelected = repo.id === activeRepo?.id;
                const canDelete = roleCapabilities.canManageMembers;

                return (
                  <tr
                    key={repo.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#eff4ff]/60' : 'hover:bg-[#f8f9ff]'
                    }`}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[13px] font-semibold ${isSelected ? 'text-[#2563eb]' : 'text-[#10172a]'}`}>
                          {repo.name}
                        </span>
                        {isSelected && <span className="badge badge-blue">Active</span>}
                      </div>
                      <div className="text-[11px] text-[#5263a0] mt-0.5 font-mono">
                        {repo.engine} {repo.engineVersion} • {repo.region}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        repo.environment === 'Production'
                          ? 'badge-red'
                          : repo.environment === 'Staging'
                          ? 'badge-amber'
                          : 'badge-neutral'
                      }`}>
                        {repo.environment}
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-[#10172a] font-medium">
                      {repo.defaultBranch}
                    </td>
                    <td className="text-[12px] font-mono text-[#5263a0]">
                      {repo.activeBranchesCount} branches • {repo.openMrCount} MRs
                    </td>
                    <td>
                      <select
                        value={repo.connectionMode}
                        onChange={(e) =>
                          void setRepositoryConnectionMode(
                            repo.id,
                            e.target.value as DatabaseConnectionMode
                          )
                        }
                        className="rounded-lg border border-[#e2e5f6] bg-white px-2.5 py-1 text-[12px] font-mono text-[#10172a] focus:outline-none focus:border-[#2563eb]"
                      >
                        <option value="connected">Connected ({repo.latencyMs}ms)</option>
                        <option value="read-only">Read-Only Replica</option>
                        <option value="disconnected">Disconnected</option>
                      </select>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            selectRepository(repo.id);
                            navigateTo('overview');
                          }}
                          className={`btn-secondary text-[12px] py-1 px-3 ${
                            isSelected ? 'bg-[#eff4ff] text-[#2563eb] border-[#c2d4ff]' : ''
                          }`}
                        >
                          {isSelected ? 'Active' : 'Select'}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            disabled={isDeletingRepo || isOperationPending}
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmationInput('');
                              setRepoToDelete({ id: repo.id, name: repo.name });
                            }}
                            title={`Delete repository ${repo.name}`}
                            className="text-[12px] py-1 px-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-40"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Repository Modal */}
      {repoToDelete && (
        <div
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingRepo) {
              setRepoToDelete(null);
              setConfirmationInput('');
              setDeleteError(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#10172a]">
                    Delete Repository
                  </h3>
                  <p className="text-[12px] text-[#5263a0] mt-0.5">
                    Permanent deletion: {repoToDelete.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingRepo}
                onClick={() => {
                  setRepoToDelete(null);
                  setConfirmationInput('');
                  setDeleteError(null);
                }}
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[12px] text-red-700">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-[13px] text-[#10172a] leading-relaxed">
                This action <strong className="text-red-600">cannot be undone</strong>. This will permanently delete the repository{' '}
                <span className="font-mono font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-50 border border-red-100">
                  {repoToDelete.name}
                </span>{' '}
                and all its branch references and member associations.
              </p>

              <div className="p-3.5 bg-[#f5f6ff] border border-[#e2e5f6] rounded-xl text-[12px] text-[#5263a0] space-y-1">
                <div className="font-medium text-[#10172a] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#2563eb]">info</span>
                  <span>Audit Trail Preservation:</span>
                </div>
                <p>
                  System-level audit records, global security ledgers, and shared history are permanently preserved.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Type <span className="font-mono text-[#2563eb] select-all">{repoToDelete.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => {
                    setConfirmationInput(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  placeholder={repoToDelete.name}
                  className="vdb-input w-full font-mono text-[12px]"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#fbfbfe] border-t border-[#f1f3fb] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingRepo}
                onClick={() => {
                  setRepoToDelete(null);
                  setConfirmationInput('');
                  setDeleteError(null);
                }}
                className="btn-secondary text-[12px] py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRepo || confirmationInput.trim() !== repoToDelete.name}
                onClick={handleDeleteConfirm}
                className="btn-primary text-[12px] py-2 px-3.5 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                {isDeletingRepo ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">
                      progress_activity
                    </span>
                    <span>Deleting Repository...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>Delete Repository</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
