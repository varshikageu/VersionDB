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
    stagedRowMutations,
    stagedDdlChanges,
    discardAllStaged,
  } = useVersionDb();

  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [discardUncommittedConfirmed, setDiscardUncommittedConfirmed] = useState(false);

  const hasUncommittedChanges =
    branchToDelete === activeBranch &&
    (stagedRowMutations.length > 0 || stagedDdlChanges.length > 0);

  const handleDeleteConfirm = async () => {
    if (!branchToDelete || isDeleting) return;
    if (hasUncommittedChanges && !discardUncommittedConfirmed) {
      setDeleteError('This branch has uncommitted changes. Please check the discard confirmation box below to proceed.');
      return;
    }
    if (hasUncommittedChanges && discardUncommittedConfirmed) {
      discardAllStaged();
    }
    setIsDeleting(true);
    setDeleteError(null);
    const res = await deleteBranch(branchToDelete);
    setIsDeleting(false);
    if (res.ok) {
      setBranchToDelete(null);
      setDiscardUncommittedConfirmed(false);
    } else {
      setDeleteError(res.error || 'Failed to delete branch.');
    }
  };

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Copy-on-Write Database Isolation
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">Branches & Divergence</h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Checkout isolated database branches, compare schema/row divergence, or open a Merge Request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateBranchModalOpen(true)}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">call_split</span>
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
        <div className="vdb-card overflow-hidden">
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>HEAD Commit</th>
                <th>Divergence</th>
                <th>Author & Updated</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const isCurrent = b.name === activeBranch;
                const isDefault = b.name === (activeRepo?.defaultBranch || 'main');
                const canDeleteThisBranch = roleCapabilities.canDeleteBranch && !isDefault;

                return (
                  <tr
                    key={b.name}
                    className={
                      isCurrent ? 'bg-[#eff4ff]/60' : 'hover:bg-[#f8f9ff]'
                    }
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[13px] font-semibold ${isCurrent ? 'text-[#2563eb]' : 'text-[#10172a]'}`}>
                          {b.name}
                        </span>
                        {isCurrent && (
                          <span className="badge badge-blue">Active</span>
                        )}
                        {b.isProtected && (
                          <span className="badge badge-neutral">Protected</span>
                        )}
                        {isDefault && (
                          <span className="badge badge-neutral">Default</span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono text-[12px] text-[#5263a0]">
                      <span className="text-[#10172a] font-medium">{b.headCommitHash}</span> — {b.headCommitTitle}
                    </td>
                    <td className="font-mono text-[12px] text-[#5263a0]">
                      <span className="text-emerald-600 font-semibold">+{b.aheadCount}</span> / <span className="text-red-500 font-semibold">-{b.behindCount}</span>
                    </td>
                    <td className="text-[12px] text-[#5263a0]">
                      <span className="font-medium text-[#10172a]">{b.authorHandle}</span> • {b.updatedRelative}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => selectBranch(b.name)}
                            className="btn-secondary text-[12px] py-1 px-2.5"
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
                          className="btn-secondary text-[12px] py-1 px-2.5"
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
                            className="btn-secondary text-[12px] py-1 px-2.5 text-[#2563eb] border-[#c2d4ff] hover:bg-[#eff4ff]"
                          >
                            Open MR
                          </button>
                        )}
                        {canDeleteThisBranch && (
                          <button
                            type="button"
                            disabled={b.isProtected || isDeleting || isOperationPending}
                            onClick={() => {
                              setDeleteError(null);
                              setDiscardUncommittedConfirmed(false);
                              setBranchToDelete(b.name);
                            }}
                            title={
                              b.isProtected
                                ? 'Protected branch cannot be deleted.'
                                : isCurrent
                                ? `Delete active branch ${b.name} (will automatically switch to default branch)`
                                : `Delete branch ${b.name}`
                            }
                            className="text-[12px] py-1 px-2 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setBranchToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#10172a]">
                    Delete Branch
                  </h3>
                  <p className="text-[12px] text-[#5263a0] mt-0.5">
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
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[12px] text-red-700">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-[13px] text-[#10172a] leading-relaxed">
                Are you sure you want to permanently delete branch{' '}
                <span className="font-mono font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-50 border border-red-100">
                  {branchToDelete}
                </span>
                ?
              </p>

              {branchToDelete === activeBranch && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">swap_horiz</span>
                    <span>Active Branch Switch:</span>
                  </div>
                  <p className="opacity-90">
                    Branch <code className="font-mono font-bold">{branchToDelete}</code> is currently checked out.
                    Deleting it will automatically switch your active branch to default (<code className="font-mono font-bold">{activeRepo?.defaultBranch || 'main'}</code>).
                  </p>
                </div>
              )}

              {hasUncommittedChanges && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="font-semibold text-[12px] text-red-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-red-600">warning</span>
                    <span>Uncommitted Working Changes Detected</span>
                  </div>
                  <p className="text-[12px] text-[#5263a0]">
                    You have uncommitted staged rows or DDL mutations on this branch. Deleting will permanently discard them.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={discardUncommittedConfirmed}
                      onChange={(e) => {
                        setDiscardUncommittedConfirmed(e.target.checked);
                        if (e.target.checked) setDeleteError(null);
                      }}
                      className="rounded border-[#c5c9e4] text-[#2563eb] focus:ring-[#2563eb]"
                    />
                    <span className="text-[12px] font-semibold text-red-700">
                      I understand and confirm discarding all uncommitted changes
                    </span>
                  </label>
                </div>
              )}

              <div className="p-3.5 bg-[#f5f6ff] border border-[#e2e5f6] rounded-xl text-[12px] text-[#5263a0] space-y-1">
                <div className="font-medium text-[#10172a] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#2563eb]">info</span>
                  <span>Preservation Notice:</span>
                </div>
                <p>
                  Commits, audit logs, and shared version history will be preserved. Only the branch
                  reference and uncommitted working changes will be removed.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#fbfbfe] border-t border-[#f1f3fb] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setBranchToDelete(null);
                  setDeleteError(null);
                }}
                className="btn-secondary text-[12px] py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="btn-primary text-[12px] py-2 px-3.5 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">
                      progress_activity
                    </span>
                    <span>Deleting Branch...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">delete</span>
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
