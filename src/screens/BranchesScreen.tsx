import React from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const BranchesScreen: React.FC = () => {
  const {
    branches,
    activeBranch,
    selectBranch,
    setCompareTargetBranch,
    setCreateBranchModalOpen,
    setCreateMrModalOpen,
    navigateTo,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Copy-on-Write Database Isolation
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">Branches & Divergence</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Checkout isolated database branches, compare schema/row divergence, or open a Merge
            Request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateBranchModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-b from-primary to-primary-container text-on-primary rounded-lg font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">call_split</span>
          New Branch
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
        <TableSkeletonLoader rows={4} columns={5} />
      ) : branches.length === 0 ? (
        <EmptyStateCard
          icon="account_tree"
          title="No Database Branches Available"
          description="No branches are loaded because no backend repository is connected. Connect a VersionDB backend and register a repository to create and compare branches."
          actionLabel="Create Branch"
          onAction={() => setCreateBranchModalOpen(true)}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label-mono text-label-sm uppercase text-secondary border-b border-surface-container">
                <th className="py-3 px-4">Branch Name</th>
                <th className="py-3 px-4">HEAD Commit</th>
                <th className="py-3 px-4">Divergence</th>
                <th className="py-3 px-4">Author & Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
              {branches.map((b) => {
                const isCurrent = b.name === activeBranch;
                return (
                  <tr
                    key={b.name}
                    className={
                      isCurrent ? 'bg-primary-fixed/20' : 'hover:bg-surface-container-low/60'
                    }
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-code-sm font-semibold text-on-surface">{b.name}</span>
                        {b.isProtected && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-[10px] uppercase">
                            Protected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-code-sm text-xs text-on-surface">
                      {b.headCommitHash} — {b.headCommitTitle}
                    </td>
                    <td className="py-3.5 px-4 font-code-sm text-xs text-secondary">
                      +{b.aheadCount} / -{b.behindCount}
                    </td>
                    <td className="py-3.5 px-4 font-code-sm text-xs text-secondary">
                      {b.authorHandle} • {b.updatedRelative}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => selectBranch(b.name)}
                            className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface"
                          >
                            Checkout
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            selectBranch(b.name);
                            setCompareTargetBranch('main');
                            navigateTo('changes-and-diff');
                          }}
                          className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-xs font-medium text-secondary"
                        >
                          Diff
                        </button>
                        {!b.isProtected && (
                          <button
                            type="button"
                            onClick={() => {
                              selectBranch(b.name);
                              setCreateMrModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary"
                          >
                            Open MR
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
    </div>
  );
};
