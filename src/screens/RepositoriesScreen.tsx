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
  } = useVersionDb();

  const [envFilter, setEnvFilter] = useState<'ALL' | 'Production' | 'Staging' | 'Development'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Cluster Fleet & Snapshot Storage
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">Database Repositories</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Select an active database repository, inspect WAL replication telemetry, or register a
            new PostgreSQL cluster.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateRepoModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-b from-primary to-primary-container text-on-primary rounded-lg font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low p-2 rounded-lg">
        <div className="flex items-center gap-1.5">
          {(['ALL', 'Production', 'Staging', 'Development'] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setEnvFilter(env)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                envFilter === env
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pr-2">
          <div className="relative">
            <span className="material-symbols-outlined text-xs text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              aria-label="Search repositories"
              className="pl-7 pr-3 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 font-body-sm text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <span className="font-code-sm text-code-sm text-secondary">
            Showing {filteredRepos.length} of {repositories.length} repositories
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label-mono text-label-sm uppercase text-secondary border-b border-surface-container">
                <th className="py-3 px-4">Repository & Engine</th>
                <th className="py-3 px-4">Environment</th>
                <th className="py-3 px-4">Default Branch</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Connection Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
              {filteredRepos.map((repo) => {
                const isSelected = repo.id === activeRepo?.id;
                return (
                  <tr
                    key={repo.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-primary-fixed/20' : 'hover:bg-surface-container-low/60'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-code-sm font-semibold text-on-surface">{repo.name}</div>
                      <div className="font-body-sm text-[11px] text-secondary mt-0.5">
                        {repo.engine} {repo.engineVersion} • {repo.region}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded font-label-mono text-[10px] uppercase font-bold bg-surface-container text-secondary">
                        {repo.environment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-code-sm text-code-sm text-on-surface">
                      {repo.defaultBranch}
                    </td>
                    <td className="py-3.5 px-4 font-code-sm text-code-sm text-secondary">
                      {repo.activeBranchesCount} branches • {repo.openMrCount} MRs
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={repo.connectionMode}
                        onChange={(e) =>
                          void setRepositoryConnectionMode(
                            repo.id,
                            e.target.value as DatabaseConnectionMode
                          )
                        }
                        className="rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-1 font-code-sm text-xs text-on-surface"
                      >
                        <option value="connected">Connected ({repo.latencyMs}ms)</option>
                        <option value="read-only">Read-Only Replica</option>
                        <option value="disconnected">Disconnected</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          selectRepository(repo.id);
                          navigateTo('overview');
                        }}
                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high font-body-sm text-xs font-medium text-on-surface"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
