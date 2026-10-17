import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { ROLE_UI_CAPABILITIES } from '../config/appConfig';
import { useVersionDb } from '../context/VersionDbContext';
import { UserRole } from '../types/versiondb';

export const MembersPermissionsScreen: React.FC = () => {
  const {
    users,
    currentUser,
    activeRepo,
    roleCapabilities,
    updateUserRole,
    addMember,
    removeMember,
    isOperationPending,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const roles: UserRole[] = ['Viewer', 'Developer', 'Reviewer', 'Admin'];

  // Member invitation state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Developer');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Member removal confirmation state
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; email: string; role: UserRole } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const canManageMembers = roleCapabilities.canManageMembers;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    const res = await addMember(cleanEmail, inviteRole);
    if (res.ok) {
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('Developer');
    } else {
      setInviteError(res.error || 'Failed to add member.');
    }
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;
    setRemoveError(null);
    const res = await removeMember(memberToRemove.id);
    if (res.ok) {
      setMemberToRemove(null);
    } else {
      setRemoveError(res.error || 'Failed to remove member.');
    }
  };

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Role-Based Access Control (RBAC) & Governance
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Repository Members & Access
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            {activeRepo
              ? `Manage authorized collaborators and roles for repository "${activeRepo.name}".`
              : 'Select a repository to inspect and manage team access.'}
          </p>
        </div>
        {canManageMembers && activeRepo && (
          <button
            type="button"
            onClick={() => {
              setInviteError(null);
              setIsInviteModalOpen(true);
            }}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[15px]">person_add</span>
            Invite Member
          </button>
        )}
      </div>

      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {/* Role Capabilities Reference Matrix */}
      <div className="vdb-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f1f3fb] flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#10172a]">
            Role Capability Matrix
          </h2>
          <span className="badge badge-neutral">Server-Authoritative</span>
        </div>
        <div className="overflow-x-auto">
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Capability</th>
                {roles.map((r) => (
                  <th key={r}>
                    {r === 'Admin' ? 'Owner / Admin' : r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Execute SELECT Queries & Read Records', 'canExecuteSelect'],
                  ['Stage Row & Working Changes', 'canEditRecordsAndStage'],
                  ['Create Commits & Branches', 'canCreateCommit'],
                  ['Approve Merge Requests', 'canReviewAndApproveMr'],
                  ['Merge Protected Branches', 'canMergeProtectedMain'],
                  ['Manage Members & Repository Deletion', 'canManageMembers'],
                ] as const
              ).map(([label, capKey]) => (
                <tr key={capKey}>
                  <td className="text-[13px] font-medium text-[#10172a]">{label}</td>
                  {roles.map((r) => (
                    <td key={r}>
                      {ROLE_UI_CAPABILITIES[r][capKey] ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[12px]">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Allowed
                        </span>
                      ) : (
                        <span className="text-[#8890b8] font-mono text-[12px]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workspace Members List */}
      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={5} />
      ) : !activeRepo ? (
        <EmptyStateCard
          icon="folder_off"
          title="No Repository Selected"
          description="Select an active database repository from the Repositories screen to inspect authorized collaborators and manage RBAC memberships."
        />
      ) : users.length === 0 ? (
        <EmptyStateCard
          icon="group"
          title="No Repository Members Loaded"
          description="No members found for this repository. Owners can invite collaborators using their registered email address."
        />
      ) : (
        <div className="vdb-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f3fb] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#10172a]">
              Authorized Members for {activeRepo.name}
            </h2>
            <span className="text-[12px] font-mono text-[#8890b8]">
              {users.length} {users.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <table className="vdb-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email</th>
                <th>Repository Role</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;

                return (
                  <tr key={u.id} className="hover:bg-[#f8f9ff]">
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#10172a] text-[13px]">{u.name}</span>
                        {isSelf && (
                          <span className="badge badge-blue">You</span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono text-[12px] text-[#5263a0]">{u.email}</td>
                    <td>
                      {canManageMembers ? (
                        <select
                          value={u.role}
                          disabled={isOperationPending}
                          onChange={(e) => void updateUserRole(u.id, e.target.value as UserRole)}
                          className="rounded-lg border border-[#e2e5f6] bg-white px-2.5 py-1 font-mono text-[12px] text-[#10172a] focus:outline-none focus:border-[#2563eb] disabled:opacity-50"
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {r === 'Admin' ? 'Owner / Admin' : r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge badge-neutral">
                          {u.role === 'Admin' ? 'Owner' : u.role}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {canManageMembers && !isSelf && (
                        <button
                          type="button"
                          disabled={isOperationPending}
                          onClick={() => {
                            setRemoveError(null);
                            setMemberToRemove({ id: u.id, name: u.name, email: u.email, role: u.role });
                          }}
                          className="text-[12px] py-1 px-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-40"
                        >
                          Revoke Access
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isOperationPending) {
              setIsInviteModalOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#2563eb]">
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                </div>
                <h3 className="text-[15px] font-semibold text-[#10172a]">
                  Invite Member to {activeRepo?.name}
                </h3>
              </div>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              {inviteError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{inviteError}</span>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="vdb-input w-full font-mono text-[12px]"
                />
                <p className="text-[11px] text-[#8890b8] mt-1">
                  The user must already be registered with VersionDB.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Repository Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="vdb-input w-full font-mono text-[12px]"
                >
                  <option value="Viewer">Viewer (Read-only)</option>
                  <option value="Developer">Developer / Maintainer (Branching, writes, commits)</option>
                  <option value="Reviewer">Reviewer (Approve merge requests)</option>
                  <option value="Admin">Owner / Admin (Full repository administration)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() => setIsInviteModalOpen(false)}
                  className="btn-secondary text-[12px] py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperationPending}
                  className="btn-primary text-[12px] py-2 px-3.5"
                >
                  {isOperationPending ? 'Inviting...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isOperationPending) {
              setMemberToRemove(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined text-[18px]">person_remove</span>
                </div>
                <h3 className="text-[15px] font-semibold text-[#10172a]">
                  Revoke Member Access
                </h3>
              </div>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() => setMemberToRemove(null)}
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {removeError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{removeError}</span>
                </div>
              )}

              <p className="text-[13px] text-[#10172a] leading-relaxed">
                Are you sure you want to remove <strong className="text-[#10172a]">{memberToRemove.name}</strong> ({memberToRemove.email}) from repository <strong className="text-[#10172a]">{activeRepo?.name}</strong>?
              </p>
              <p className="text-[12px] text-[#5263a0]">
                They will immediately lose all permissions to view or modify this repository.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() => setMemberToRemove(null)}
                  className="btn-secondary text-[12px] py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={handleRemoveConfirm}
                  className="btn-primary text-[12px] py-2 px-3.5 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isOperationPending ? 'Revoking...' : 'Confirm Revoke'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
