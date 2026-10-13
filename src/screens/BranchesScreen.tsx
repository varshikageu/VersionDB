import React, { useState } from 'react';
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
    roleCapabilities,
    activeRepo,
    deleteBranch,
    isOperationPending,
  } = useVersionDb();

  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!branchToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await deleteBranch(branchToDelete);
    setIsDeleting(false);
    if (res.ok) {
      setBranchToDelete(null);
    } else {
      setDeleteError(res.error || 'Failed to delete branch.');
    }
  };

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
                const isDefault = b.name === (activeRepo?.defaultBranch || 'main');
                const canDeleteThisBranch = roleCapabilities.canDeleteBranch && !isDefault;

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
                        {isDefault && (
                          <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-secondary font-label-mono text-[10px] uppercase">
                            Default
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
                        {canDeleteThisBranch && (
                          <button
                            type="button"
                            disabled={isCurrent || b.isProtected || isDeleting || isOperationPending}
                            onClick={() => {
                              setDeleteError(null);
                              setBranchToDelete(b.name);
                            }}
                            title={
                              isCurrent
                                ? 'Cannot delete active branch. Checkout another branch first.'
                                : b.isProtected
                                ? 'Protected branch cannot be deleted.'
                                : `Delete branch ${b.name}`
                            }
                            className="px-2.5 py-1 rounded bg-error/10 hover:bg-error/20 text-xs font-semibold text-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

      {/* Delete Branch Confirmation Modal */}
      {branchToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setBranchToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-outline-variant/30 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-surface-container flex items-center justify-between bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-semibold text-on-surface">
                    Delete Branch
                  </h3>
                  <p className="font-body-sm text-xs text-secondary mt-0.5">
                    {activeRepo ? `Repository: ${activeRepo.name}` : 'Permanent branch deletion'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setBranchToDelete(null);
                  setDeleteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors disabled:opacity-40"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3.5 rounded-lg bg-error-container/30 border border-error/30 flex items-start gap-2.5 text-xs text-error">
                  <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">error</span>
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="font-body-sm text-sm text-on-surface">
                Are you sure you want to permanently delete branch{' '}
                <span className="font-code-sm font-bold text-error px-1.5 py-0.5 rounded bg-error/10">
                  {branchToDelete}
                </span>
                ?
              </p>

              <div className="p-3 bg-surface-container-low rounded-lg text-xs text-secondary space-y-1">
                <div className="font-medium text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">info</span>
                  <span>Preservation Notice:</span>
                </div>
                <p>
                  Commits, audit logs, and shared version history will be preserved. Only the branch
                  reference and uncommitted working changes will be removed.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setBranchToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-error text-white text-xs font-semibold shadow-sm hover:bg-error/90 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                    <span>Deleting Branch...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete Branch</span>
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
