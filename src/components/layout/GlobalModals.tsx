import React, { useState } from 'react';
import { useVersionDb } from '../../context/VersionDbContext';
import { ScreenPath } from '../../types/versiondb';

export const GlobalModals: React.FC = () => {
  const {
    activeRepo,
    activeBranch,
    branches,
    stagedRowMutations,
    stagedDdlChanges,
    commitStagedChanges,
    createBranch,
    createMergeRequest,
    createRepository,
    snapshots,
    selectedSnapshotId,
    executeRollbackToSnapshot,
    isOperationPending,
    apiBaseUrl,
    isBackendConfigured,
    isCommitModalOpen,
    setCommitModalOpen,
    isCreateBranchModalOpen,
    setCreateBranchModalOpen,
    isCreateMrModalOpen,
    setCreateMrModalOpen,
    isCreateRepoModalOpen,
    setCreateRepoModalOpen,
    isRollbackModalOpen,
    setRollbackModalOpen,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    isApiContractDrawerOpen,
    setApiContractDrawerOpen,
    apiContracts,
    navigateTo,
    toasts,
    dismissToast,
  } = useVersionDb();

  // Commit Modal State (empty by default, no fake commit messages)
  const [commitMessage, setCommitMessage] = useState('');
  const [commitModalError, setCommitModalError] = useState<string | null>(null);

  // Branch Modal State
  const [newBranchName, setNewBranchName] = useState('');
  const [sourceBranchForNew, setSourceBranchForNew] = useState('');
  const [branchModalError, setBranchModalError] = useState<string | null>(null);

  // MR Modal State
  const [mrTitle, setMrTitle] = useState('');
  const [mrDescription, setMrDescription] = useState('');
  const [mrSourceBranch, setMrSourceBranch] = useState('');
  const [mrTargetBranch, setMrTargetBranch] = useState('');
  const [mrModalError, setMrModalError] = useState<string | null>(null);

  // Repo Modal State
  const [repoName, setRepoName] = useState('');
  const [repoEngine, setRepoEngine] = useState('PostgreSQL');
  const [repoEnv, setRepoEnv] = useState<'Production' | 'Staging' | 'Development'>('Staging');
  const [repoRegion, setRepoRegion] = useState('');
  const [repoDefaultBranch, setRepoDefaultBranch] = useState('main');
  const [repoModalError, setRepoModalError] = useState<string | null>(null);

  // Rollback Modal State
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackConfirmText, setRollbackConfirmText] = useState('');
  const [rollbackModalError, setRollbackModalError] = useState<string | null>(null);

  // Command Palette State
  const [cmdQuery, setCmdQuery] = useState('');

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || snapshots[0];

  const quickNavItems: { label: string; category: string; path: ScreenPath; code?: string }[] = [
    { label: 'Overview Dashboard', category: 'Screen', path: 'overview', code: 'overview' },
    { label: 'Workspace & Project Selector', category: 'Screen', path: 'workspaces', code: 'workspaces' },
    { label: 'Database Repositories', category: 'Screen', path: 'repositories', code: 'repositories' },
    { label: 'SQL Workspace & Query Runner', category: 'Screen', path: 'sql-workspace', code: 'sql-workspace' },
    { label: 'Schema Explorer (Tables & Views)', category: 'Screen', path: 'schema-explorer', code: 'schema-explorer' },
    { label: 'Table Data Browser & Inline Staging', category: 'Screen', path: 'table-data', code: 'table-data' },
    { label: 'Branches & Divergence', category: 'Screen', path: 'branches', code: 'branches' },
    { label: 'Commits & Snapshot History', category: 'Screen', path: 'commits-and-history', code: 'commits' },
    { label: 'Changes & Diff Inspector', category: 'Screen', path: 'changes-and-diff', code: 'diff' },
    { label: 'Merge Requests', category: 'Screen', path: 'merge-requests', code: 'mr' },
    { label: 'Conflict Resolution Workspace', category: 'Screen', path: 'conflict-resolution', code: 'conflicts' },
    { label: 'Admin Approvals Queue', category: 'Governance', path: 'admin-approvals', code: 'approvals' },
    { label: 'Time Machine & Historical Rollback', category: 'Governance', path: 'time-machine', code: 'rollback' },
    { label: 'Data Lineage Graph', category: 'Catalog', path: 'data-lineage', code: 'lineage' },
    { label: 'Schema Versions & Tagging', category: 'Catalog', path: 'schema-versions', code: 'versions' },
    { label: 'Immutable Audit Logs', category: 'Governance', path: 'audit-logs', code: 'audit' },
    { label: 'Members & RBAC Matrix', category: 'Governance', path: 'members-and-permissions', code: 'rbac' },
    { label: 'Notifications Center', category: 'Workspace', path: 'notifications', code: 'notifications' },
    { label: 'User Profile & Account Settings', category: 'Account', path: 'profile', code: 'profile' },
    { label: 'Repository Onboarding Checklist', category: 'Workspace', path: 'onboarding', code: 'onboarding' },
    { label: 'Repository Settings', category: 'Governance', path: 'settings', code: 'settings' },
    { label: 'Authentication — Login Page', category: 'Auth', path: 'login', code: '/login' },
    { label: 'Authentication — Forgot Password', category: 'Auth', path: 'forgot-password', code: '/forgot-password' },
    { label: 'Authentication — Reset Password', category: 'Auth', path: 'reset-password', code: '/reset-password' },
    { label: 'Status — 403 Access Denied', category: 'Status', path: '403', code: '403' },
    { label: 'Status — 404 Page Not Found', category: 'Status', path: '404', code: '404' },
    { label: 'Status — 500 System Error', category: 'Status', path: '500', code: '500' },
  ];

  const filteredCmdItems = quickNavItems.filter(
    (item) =>
      item.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(cmdQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(cmdQuery.toLowerCase()))
  );

  return (
    <>
      {/* 1. Commit Staged Changes Modal */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-outline-variant/30 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">commit</span>
                <h3 className="font-headline text-title-md text-on-surface">
                  Create Database Commit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCommitModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {commitModalError && (
                <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error">
                  {commitModalError}
                </div>
              )}
              <div className="flex items-center justify-between text-xs bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/20">
                <span className="text-secondary">Target Branch:</span>
                <span className="font-code-sm font-semibold text-primary">
                  {activeBranch || 'None'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/15">
                  <div className="font-label-mono text-label-sm uppercase text-secondary">
                    Staged DDL Statements
                  </div>
                  <div className="font-headline text-lg font-bold text-on-surface mt-0.5">
                    {stagedDdlChanges.length}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/15">
                  <div className="font-label-mono text-label-sm uppercase text-secondary">
                    Staged Row Mutations
                  </div>
                  <div className="font-headline text-lg font-bold text-on-surface mt-0.5">
                    {stagedRowMutations.length}
                  </div>
                </div>
              </div>
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5">
                  Commit Message
                </label>
                <textarea
                  rows={3}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe the schema or record changes in this commit..."
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCommitModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={async () => {
                  setCommitModalError(null);
                  const res = await commitStagedChanges(commitMessage);
                  if (!res.ok) {
                    setCommitModalError(res.error || 'Failed to create commit.');
                  } else {
                    setCommitMessage('');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {isOperationPending ? 'Committing...' : 'Commit Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Create Branch Modal */}
      {isCreateBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-outline-variant/30 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">call_split</span>
                <h3 className="font-headline text-title-md text-on-surface">
                  Create Database Branch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateBranchModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {branchModalError && (
                <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error">
                  {branchModalError}
                </div>
              )}
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5">
                  Source Branch (Copy-on-Write Base)
                </label>
                <input
                  type="text"
                  value={sourceBranchForNew || activeBranch}
                  onChange={(e) => setSourceBranchForNew(e.target.value)}
                  placeholder="e.g., main"
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs text-on-surface"
                />
              </div>
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5">
                  New Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feat/branch-name"
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateBranchModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={async () => {
                  setBranchModalError(null);
                  const res = await createBranch(
                    newBranchName,
                    sourceBranchForNew || activeBranch || 'main'
                  );
                  if (!res.ok) {
                    setBranchModalError(res.error || 'Branch creation failed.');
                  } else {
                    setNewBranchName('');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {isOperationPending ? 'Creating...' : 'Create & Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Create Merge Request Modal */}
      {isCreateMrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-outline-variant/30 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">merge</span>
                <h3 className="font-headline text-title-md text-on-surface">
                  Open Merge Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateMrModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {mrModalError && (
                <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error">
                  {mrModalError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Source Branch
                  </label>
                  <input
                    type="text"
                    value={mrSourceBranch || activeBranch}
                    onChange={(e) => setMrSourceBranch(e.target.value)}
                    placeholder="Source branch"
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                  />
                </div>
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Target Branch
                  </label>
                  <input
                    type="text"
                    value={mrTargetBranch}
                    onChange={(e) => setMrTargetBranch(e.target.value)}
                    placeholder="Target branch (e.g., main)"
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                  Merge Request Title
                </label>
                <input
                  type="text"
                  value={mrTitle}
                  onChange={(e) => setMrTitle(e.target.value)}
                  placeholder="Summarize the schema and data migration..."
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
                />
              </div>
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                  Migration Summary & Rollback Plan
                </label>
                <textarea
                  rows={3}
                  value={mrDescription}
                  onChange={(e) => setMrDescription(e.target.value)}
                  placeholder="Document impact and rollback considerations..."
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateMrModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={async () => {
                  setMrModalError(null);
                  const res = await createMergeRequest(
                    mrTitle,
                    mrDescription,
                    mrSourceBranch || activeBranch,
                    mrTargetBranch || 'main'
                  );
                  if (!res.ok) {
                    setMrModalError(res.error || 'Unable to create Merge Request.');
                  } else {
                    setMrTitle('');
                    setMrDescription('');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {isOperationPending ? 'Submitting...' : 'Submit Merge Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Register Repository Modal */}
      {isCreateRepoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-outline-variant/30 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">dns</span>
                <h3 className="font-headline text-title-md text-on-surface">
                  Register Database Repository
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateRepoModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              {repoModalError && (
                <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error">
                  {repoModalError}
                </div>
              )}
              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                  Repository Identifier
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Enter repository identifier"
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Engine
                  </label>
                  <select
                    value={repoEngine}
                    onChange={(e) => setRepoEngine(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
                  >
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="Aurora PG">Aurora PG</option>
                  </select>
                </div>
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Environment
                  </label>
                  <select
                    value={repoEnv}
                    onChange={(e) => setRepoEnv(e.target.value as any)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Cloud Region
                  </label>
                  <input
                    type="text"
                    value={repoRegion}
                    onChange={(e) => setRepoRegion(e.target.value)}
                    placeholder="Region identifier"
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                  />
                </div>
                <div>
                  <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                    Default Protected Branch
                  </label>
                  <input
                    type="text"
                    value={repoDefaultBranch}
                    onChange={(e) => setRepoDefaultBranch(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateRepoModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={async () => {
                  setRepoModalError(null);
                  const res = await createRepository(
                    repoName,
                    repoEngine,
                    repoEnv,
                    repoRegion,
                    repoDefaultBranch
                  );
                  if (!res.ok) {
                    setRepoModalError(res.error || 'Failed to register repository.');
                  } else {
                    setRepoName('');
                    setRepoRegion('');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {isOperationPending ? 'Connecting...' : 'Connect Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Historical Rollback Confirmation Modal */}
      {isRollbackModalOpen && selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-error/30 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-error-container/30 border-b border-error/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined">history</span>
                <h3 className="font-headline text-title-md text-on-surface">
                  Confirm Historical Rollback ({selectedSnapshot.ref})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRollbackModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {rollbackModalError && (
                <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error">
                  {rollbackModalError}
                </div>
              )}
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/25 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-secondary">Target Checkpoint:</span>
                  <span className="font-code-sm font-semibold text-on-surface">
                    {selectedSnapshot.ref} ({selectedSnapshot.commitHash})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">WAL LSN Position:</span>
                  <span className="font-code-sm text-primary">{selectedSnapshot.walLsn}</span>
                </div>
              </div>

              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                  Rollback Justification (Audit Log Required)
                </label>
                <input
                  type="text"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Enter reason for point-in-time rollback..."
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-body-sm text-xs"
                />
              </div>

              <div>
                <label className="block font-label-mono text-label-sm uppercase text-secondary mb-1">
                  Type <span className="text-error font-bold">{selectedSnapshot.ref}</span> to
                  confirm
                </label>
                <input
                  type="text"
                  value={rollbackConfirmText}
                  onChange={(e) => setRollbackConfirmText(e.target.value)}
                  placeholder={selectedSnapshot.ref}
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-code-sm text-xs"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRollbackModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rollbackConfirmText !== selectedSnapshot.ref || isOperationPending}
                onClick={async () => {
                  setRollbackModalError(null);
                  const res = await executeRollbackToSnapshot(selectedSnapshot.id, rollbackReason);
                  if (!res.ok) {
                    setRollbackModalError(res.error || 'Rollback failed.');
                  } else {
                    setRollbackConfirmText('');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-error text-on-error text-xs font-semibold shadow-sm disabled:opacity-40 hover:opacity-95"
              >
                {isOperationPending ? 'Executing...' : 'Execute Audited Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Command Palette Modal (Cmd+K) */}
      {isCommandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-outline-variant/30 w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-surface-container flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary">terminal</span>
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to screen, action, or contract..."
                className="w-full text-sm font-body-md text-on-surface focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-code-sm text-secondary"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-surface-container p-1.5">
              {filteredCmdItems.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="font-headline text-body-md text-on-surface">
                    No matching screens for &ldquo;{cmdQuery}&rdquo;
                  </div>
                  <p className="font-body-sm text-xs text-secondary">
                    Try searching for repositories, sql, commits, merge, conflicts, or login.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCmdQuery('')}
                    className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high font-code-sm text-xs text-primary"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                filteredCmdItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      navigateTo(item.path);
                      setCommandPaletteOpen(false);
                      setCmdQuery('');
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left flex items-center justify-between hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-sm text-primary">
                        arrow_forward
                      </span>
                      <span className="font-body-sm text-xs font-medium text-on-surface">
                        {item.label}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-label-mono uppercase text-secondary">
                      {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Backend Integration Contract Drawer */}
      {isApiContractDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex justify-end"
          onClick={() => setApiContractDrawerOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-outline-variant/30 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between">
              <div>
                <div className="font-label-mono text-label-sm uppercase text-primary">
                  Backend Integration Contract
                </div>
                <h3 className="font-headline text-title-md text-on-surface">
                  Required Capabilities & Service Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApiContractDrawerOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-3 bg-surface-container-low border-b border-surface-container text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-secondary">Configured Base URL (VITE_API_BASE_URL):</span>
                <span className="font-code-sm font-semibold text-on-surface">
                  {apiBaseUrl || 'Unset (Backend Not Configured)'}
                </span>
              </div>
              <p className="text-[11px] text-secondary">
                No fabricated endpoints, database schemas, or fake responses are simulated. Below are the required backend capabilities awaiting server implementation.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {apiContracts.map((contract, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-code-sm text-[10px] font-bold uppercase ${
                          contract.method === 'GET'
                            ? 'bg-primary-fixed text-primary'
                            : 'bg-[#dcfce7] text-[#15803d]'
                        }`}
                      >
                        {contract.method}
                      </span>
                      <span className="font-code-sm text-xs font-semibold text-on-surface">
                        {contract.endpoint}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#fffbeb] text-[#b45309] border border-[#f59e0b]/30 font-label-mono text-[10px] uppercase">
                      {isBackendConfigured ? 'CONFIGURED' : contract.contractStatus || 'PENDING_SPEC'}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-secondary">{contract.description}</p>
                  <div className="font-code-sm text-[11px] text-primary pt-0.5">
                    Contract: {contract.responseSchema} • Min RBAC Role: {contract.requiredRole}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. Floating Toast Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white rounded-xl shadow-lg border border-outline-variant/30 p-3.5 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`material-symbols-outlined text-base mt-0.5 ${
                  t.type === 'success'
                    ? 'text-[#16a34a]'
                    : t.type === 'error'
                      ? 'text-error'
                      : t.type === 'warning'
                        ? 'text-[#d97706]'
                        : 'text-primary'
                }`}
              >
                {t.type === 'success'
                  ? 'check_circle'
                  : t.type === 'error'
                    ? 'error'
                    : t.type === 'warning'
                      ? 'warning'
                      : 'info'}
              </span>
              <div>
                <div className="font-headline text-xs font-semibold text-on-surface">{t.title}</div>
                <div className="font-body-sm text-[11px] text-secondary mt-0.5 leading-snug">
                  {t.message}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-secondary hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
