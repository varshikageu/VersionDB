import React, { useEffect, useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { ROLE_UI_CAPABILITIES } from '../config/appConfig';
import { useVersionDb } from '../context/VersionDbContext';
import { UserProfile, UserRole } from '../types/versiondb';

export const MembersPermissionsScreen: React.FC = () => {
  const {
    users,
    portalUsers,
    fetchPortalUsers,
    createPortalUser,
    updatePortalUser,
    resetPortalUserPassword,
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

  const isGlobalAdmin = currentUser.role === 'Admin';
  const roles: UserRole[] = ['Viewer', 'Developer', 'Reviewer', 'Admin'];

  // Tab state: 'repo-members' vs 'portal-users' (Admin only)
  const [activeTab, setActiveTab] = useState<'repo-members' | 'portal-users'>(
    isGlobalAdmin ? 'portal-users' : 'repo-members'
  );

  // Admin user provisioning modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Developer');
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // One-time credential disclosure modal
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    username: string;
    role: UserRole;
    password: string;
    isReset?: boolean;
  } | null>(null);

  // Member invitation state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Developer');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Member removal confirmation state
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; email: string; role: UserRole } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Load portal users when Admin views the portal tab
  useEffect(() => {
    if (isGlobalAdmin) {
      void fetchPortalUsers();
    }
  }, [isGlobalAdmin, fetchPortalUsers]);

  const canManageMembers = roleCapabilities.canManageMembers;

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanName = newUserName.trim();
    if (!cleanName || cleanName.length < 3) {
      setCreateUserError('Name/username must be at least 3 characters.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCreateUserError('Please enter a valid email address.');
      return;
    }

    const res = await createPortalUser({
      username: cleanName,
      email: cleanEmail,
      role: newUserRole,
    });

    if (res.ok && res.data) {
      setIsCreateUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('Developer');
      setCreatedCredential({
        email: cleanEmail,
        username: cleanName,
        role: newUserRole,
        password: res.data.initialPassword,
        isReset: false,
      });
    } else {
      setCreateUserError(res.error || 'Failed to provision user account.');
    }
  };

  const handleResetPassword = async (targetUser: UserProfile) => {
    const res = await resetPortalUserPassword(targetUser.id);
    if (res.ok && res.data) {
      setCreatedCredential({
        email: targetUser.email,
        username: targetUser.name,
        role: targetUser.role,
        password: res.data.temporaryPassword,
        isReset: true,
      });
    }
  };

  const handleToggleDisabled = async (targetUser: UserProfile) => {
    const willDisable = !targetUser.disabled;
    await updatePortalUser(targetUser.id, { disabled: willDisable });
  };

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
            {isGlobalAdmin ? 'User Management & Repository Access' : 'Repository Members & Access'}
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            {isGlobalAdmin
              ? 'Admin-controlled user provisioning, platform roles, and repository collaborator access.'
              : activeRepo
              ? `Authorized collaborators and roles for repository "${activeRepo.name}".`
              : 'Inspect and manage collaborator access.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isGlobalAdmin && (
            <button
              type="button"
              onClick={() => {
                setCreateUserError(null);
                setIsCreateUserModalOpen(true);
              }}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[15px]">person_add</span>
              Provision User
            </button>
          )}

          {activeTab === 'repo-members' && canManageMembers && activeRepo && (
            <button
              type="button"
              onClick={() => {
                setInviteError(null);
                setIsInviteModalOpen(true);
              }}
              className="btn-secondary text-[12px] py-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">group_add</span>
              Add Collaborator
            </button>
          )}
        </div>
      </div>

      {/* Admin Tab Switcher */}
      {isGlobalAdmin && (
        <div className="flex items-center gap-2 border-b border-[#e2e5f6] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('portal-users')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === 'portal-users'
                ? 'bg-white text-[#2563eb] shadow-xs border border-[#e2e5f6] font-semibold'
                : 'text-[#5263a0] hover:text-[#10172a]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              Portal Users ({portalUsers.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('repo-members')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === 'repo-members'
                ? 'bg-white text-[#2563eb] shadow-xs border border-[#e2e5f6] font-semibold'
                : 'text-[#5263a0] hover:text-[#10172a]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">dns</span>
              Repository Members {activeRepo ? `(${activeRepo.name})` : ''}
            </span>
          </button>
        </div>
      )}

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

      {/* Tab: Portal Users (Admin Only) */}
      {isGlobalAdmin && activeTab === 'portal-users' && (
        <div className="vdb-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f1f3fb] flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[#10172a]">
                Platform Accounts & Global Roles
              </h2>
              <p className="text-[12px] text-[#5263a0] mt-0.5">
                Admin-controlled user accounts, global access tier, account activation, and credential renewal.
              </p>
            </div>
            <span className="text-[12px] font-mono text-[#8890b8]">
              {portalUsers.length} {portalUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>

          {portalUsers.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#5263a0]">
              No portal users loaded. Click "Provision User" to create an account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="vdb-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Global Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portalUsers.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isDisabled = u.disabled;

                    return (
                      <tr key={u.id} className="hover:bg-[#f8f9ff]">
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#10172a] text-[13px]">{u.name}</span>
                            {isSelf && (
                              <span className="badge badge-blue">You</span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-[12px] text-[#5263a0]">{u.email}</td>
                        <td>
                          <span className={`badge ${u.role === 'Admin' ? 'badge-blue' : 'badge-neutral'}`}>
                            {u.role === 'Admin' ? 'Global Admin' : 'Standard User'}
                          </span>
                        </td>
                        <td>
                          {isDisabled ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px] font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px] font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="font-mono text-[11px] text-[#8890b8]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isOperationPending}
                              onClick={() => void handleResetPassword(u)}
                              className="text-[11px] font-mono py-1 px-2.5 rounded-lg text-[#2563eb] hover:bg-[#eff4ff] border border-transparent hover:border-[#b3c5ff] transition-colors disabled:opacity-40"
                              title="Generate temporary credential"
                            >
                              Reset Password
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={isOperationPending}
                                onClick={() => void handleToggleDisabled(u)}
                                className={`text-[11px] font-mono py-1 px-2.5 rounded-lg border transition-colors disabled:opacity-40 ${
                                  isDisabled
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                    : 'text-red-600 hover:bg-red-50 border-transparent hover:border-red-200'
                                }`}
                              >
                                {isDisabled ? 'Reactivate' : 'Deactivate'}
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
      )}

      {/* Tab: Repository Members List */}
      {(!isGlobalAdmin || activeTab === 'repo-members') && (
        isCatalogLoading ? (
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
        )
      )}

      {/* Admin User Provisioning Modal */}
      {isCreateUserModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isOperationPending) {
              setIsCreateUserModalOpen(false);
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
                  Provision User Account
                </h3>
              </div>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4">
              {createUserError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{createUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Full Name / Username
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. dev_sarah"
                  className="vdb-input w-full font-mono text-[12px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@organization.com"
                  className="vdb-input w-full font-mono text-[12px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Assigned Platform Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="vdb-input w-full font-mono text-[12px]"
                >
                  <option value="Developer">Developer (Work with repositories, stage data, commits)</option>
                  <option value="Reviewer">Reviewer (Inspect diffs, approve merge requests)</option>
                  <option value="Viewer">Viewer (Read-only browsing and history)</option>
                  <option value="Admin">Admin (Full administrative and user management control)</option>
                </select>
                <p className="text-[11px] text-[#8890b8] mt-1.5">
                  Initial password will be securely generated and displayed once. Email delivery is currently direct via token.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="btn-secondary text-[12px] py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperationPending}
                  className="btn-primary text-[12px] py-2 px-3.5"
                >
                  {isOperationPending ? 'Provisioning...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Credential Disclosure Modal */}
      {createdCredential && (
        <div className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <h3 className="text-[15px] font-semibold text-[#10172a]">
                  {createdCredential.isReset ? 'Credentials Reset' : 'Initial Credentials Provisioned'}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-600 mt-0.5 shrink-0">warning</span>
                <span>
                  <strong>Copy now.</strong> For security, this temporary password will never be displayed again or stored in plaintext.
                </span>
              </div>

              <div className="space-y-2 bg-[#f8f9ff] p-3.5 rounded-lg border border-[#e2e5f6] text-[12px] font-mono">
                <div className="flex justify-between">
                  <span className="text-[#8890b8]">Email:</span>
                  <span className="text-[#10172a] font-semibold">{createdCredential.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8890b8]">Assigned Role:</span>
                  <span className="text-[#2563eb] font-semibold">{createdCredential.role}</span>
                </div>
                <div className="pt-2 border-t border-[#e2e5f6]">
                  <span className="text-[#8890b8] block mb-1">Temporary Password:</span>
                  <div className="flex items-center justify-between p-2 rounded bg-white border border-[#b3c5ff]">
                    <span className="text-[#10172a] font-bold select-all">{createdCredential.password}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(createdCredential.password);
                      }}
                      className="text-[#2563eb] hover:text-[#1d4ed8] text-[11px] font-semibold uppercase"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCreatedCredential(null)}
                  className="btn-primary text-[12px] py-2 px-4"
                >
                  I have securely saved these credentials
                </button>
              </div>
            </div>
          </div>
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
