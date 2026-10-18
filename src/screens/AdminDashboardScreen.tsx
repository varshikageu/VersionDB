import React, { useEffect, useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';
import { UserProfile, UserRole } from '../types/versiondb';

export const AdminDashboardScreen: React.FC = () => {
  const {
    portalUsers,
    fetchPortalUsers,
    createPortalUser,
    updatePortalUser,
    resetPortalUserPassword,
    repositories,
    auditLogs,
    adminApprovals,
    currentUser,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    isCatalogLoading,
    isOperationPending,
    refreshWorkspaceCatalog,
    navigateTo,
    setApiContractDrawerOpen,
    setCreateRepoModalOpen,
  } = useVersionDb();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'user'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'deactivated'>('ALL');

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Developer');
  const [createError, setCreateError] = useState<string | null>(null);

  // Credential Disclosure Modal
  const [disclosedCredential, setDisclosedCredential] = useState<{
    email: string;
    username: string;
    role: UserRole;
    password: string;
    isReset?: boolean;
  } | null>(null);

  useEffect(() => {
    void fetchPortalUsers();
  }, [fetchPortalUsers]);

  // Real backend metrics
  const totalUsers = portalUsers.length;
  const activeUsers = portalUsers.filter((u) => !u.disabled).length;
  const deactivatedUsers = portalUsers.filter((u) => u.disabled).length;
  const adminCount = portalUsers.filter((u) => u.role === 'Admin').length;
  const standardUsersCount = totalUsers - adminCount;
  const pendingApprovalsCount = adminApprovals.filter((a) => a.status === 'PENDING').length;

  const filteredUsers = portalUsers.filter((u) => {
    const matchesSearch =
      !search.trim() ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === 'ALL'
        ? true
        : roleFilter === 'admin'
        ? u.role === 'Admin'
        : u.role !== 'Admin';
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'deactivated'
        ? u.disabled
        : !u.disabled;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanName = newUserName.trim();
    const cleanEmail = newUserEmail.trim().toLowerCase();
    if (!cleanName || cleanName.length < 3) {
      setCreateError('Name must be at least 3 characters.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCreateError('Please enter a valid email address.');
      return;
    }

    const res = await createPortalUser({
      username: cleanName,
      email: cleanEmail,
      role: newUserRole,
    });

    if (res.ok && res.data) {
      setIsCreateModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('Developer');
      setDisclosedCredential({
        email: cleanEmail,
        username: cleanName,
        role: newUserRole,
        password: res.data.initialPassword,
        isReset: false,
      });
    } else {
      setCreateError(res.error || 'Failed to provision user.');
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    const res = await resetPortalUserPassword(user.id);
    if (res.ok && res.data) {
      setDisclosedCredential({
        email: user.email,
        username: user.name,
        role: user.role,
        password: res.data.temporaryPassword,
        isReset: true,
      });
    }
  };

  const handleToggleDisabled = async (user: UserProfile) => {
    await updatePortalUser(user.id, { disabled: !user.disabled });
  };

  return (
    <div className="vdb-page space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            <span>Platform Governance</span>
            <span className="text-[#c5c9e4]">/</span>
            <span className="badge badge-blue">Admin Authorized</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Admin Governance & User Management
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Signed in as <strong>{currentUser.email}</strong>. Provision users, govern repository access, and monitor platform audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[15px]">person_add</span>
            Provision User
          </button>
          <button
            type="button"
            onClick={() => setCreateRepoModalOpen(true)}
            className="btn-secondary text-[12px] py-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">add_circle</span>
            New Repository
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

      {/* Admin KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Total Users
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">group</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {totalUsers}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            {activeUsers} active · {deactivatedUsers} deactivated
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Role Distribution
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">admin_panel_settings</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {adminCount} / {standardUsersCount}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            {adminCount} Admin{adminCount === 1 ? '' : 's'} · {standardUsersCount} Standard User{standardUsersCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Repositories
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#2563eb]">dns</span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {repositories.length}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2">
            {repositories.filter((r) => r.connectionMode === 'connected').length} connected instances
          </div>
        </div>

        <div className="vdb-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5263a0] uppercase tracking-wider font-mono">
              Approvals & Logs
            </span>
            <span className={`material-symbols-outlined text-[18px] ${pendingApprovalsCount > 0 ? 'text-amber-500' : 'text-[#2563eb]'}`}>
              {pendingApprovalsCount > 0 ? 'warning' : 'verified_user'}
            </span>
          </div>
          <div className="text-[28px] font-bold text-[#10172a] leading-none">
            {pendingApprovalsCount}
          </div>
          <div className="text-[11px] font-mono text-[#8890b8] mt-2 flex items-center justify-between">
            <span>Pending sign-offs</span>
            <button
              type="button"
              onClick={() => navigateTo('admin-approvals')}
              className="text-[#2563eb] hover:underline"
            >
              Queue →
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: User Management (8 cols) + Governance & Audit (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* User Management Section */}
        <div className="lg:col-span-8 space-y-4">
          <div className="vdb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f1f3fb] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#10172a]">User Management & Role Provisioning</h2>
                <p className="text-[12px] text-[#5263a0]">
                  Admin controls account creation, role assignments, status, and credential resets.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter name or email..."
                  className="vdb-input text-[12px] py-1 px-2.5 w-48 font-mono"
                />

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="vdb-input text-[12px] py-1 px-2 font-mono"
                >
                  <option value="ALL">All Roles</option>
                  <option value="admin">Global Admin</option>
                  <option value="user">Standard User</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="vdb-input text-[12px] py-1 px-2 font-mono"
                >
                  <option value="ALL">All Status</option>
                  <option value="active">Active</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
            </div>

            {isCatalogLoading ? (
              <TableSkeletonLoader rows={5} columns={5} />
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-[#5263a0] text-[13px]">
                No portal users found matching the filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="vdb-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Email</th>
                      <th>Platform Role</th>
                      <th>Account Status</th>
                      <th className="text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === currentUser.id;
                      const isDisabled = u.disabled;

                      return (
                        <tr key={u.id} className="hover:bg-[#f8f9ff]">
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#10172a] text-[13px]">{u.name}</span>
                              {isSelf && <span className="badge badge-blue">You</span>}
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
                              <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold text-[11px] font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Deactivated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px] font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isOperationPending}
                                onClick={() => void handleResetPassword(u)}
                                className="text-[11px] font-mono py-1 px-2.5 rounded-lg text-[#2563eb] hover:bg-[#eff4ff] border border-transparent hover:border-[#b3c5ff] transition-colors disabled:opacity-40"
                              >
                                Reset Credential
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
        </div>

        {/* Governance & Recent Audit Side Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Admin Actions */}
          <div className="vdb-card p-5 space-y-3">
            <h3 className="text-[14px] font-bold text-[#10172a]">Administrative Quick Access</h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => navigateTo('members-and-permissions')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] border border-[#e2e5f6] text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#2563eb]">security</span>
                  <span className="text-[12px] font-medium text-[#10172a]">Manage Repository Roles & RBAC</span>
                </div>
                <span className="material-symbols-outlined text-[15px] text-[#8890b8]">arrow_forward</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('admin-approvals')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] border border-[#e2e5f6] text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#2563eb]">verified_user</span>
                  <span className="text-[12px] font-medium text-[#10172a]">Protected Main Sign-off Queue</span>
                </div>
                <span className="material-symbols-outlined text-[15px] text-[#8890b8]">arrow_forward</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('audit-logs')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] border border-[#e2e5f6] text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#2563eb]">fact_check</span>
                  <span className="text-[12px] font-medium text-[#10172a]">Immutable Governance Ledger</span>
                </div>
                <span className="material-symbols-outlined text-[15px] text-[#8890b8]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Recent Audit Ledger */}
          <div className="vdb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#10172a]">Recent Audit Logs</h3>
              <button
                type="button"
                onClick={() => navigateTo('audit-logs')}
                className="text-[11px] font-semibold text-[#2563eb] hover:underline"
              >
                All Logs →
              </button>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-[12px] text-[#5263a0]">No audit entries recorded.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e5f6] text-[12px]"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#8890b8]">
                      <span>{log.actionType}</span>
                      <span>{log.timestampRelative}</span>
                    </div>
                    <div className="font-semibold text-[#10172a] text-[12px] mt-0.5 truncate">
                      {log.summary}
                    </div>
                    <div className="font-mono text-[10px] text-[#5263a0] mt-1">
                      By {log.actorHandle} ({log.actorRole})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provision User Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isOperationPending) {
              setIsCreateModalOpen(false);
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
                  Provision Platform Account
                </h3>
              </div>
              <button
                type="button"
                disabled={isOperationPending}
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#8890b8] hover:text-[#10172a] rounded-lg p-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-red-500">error</span>
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                  Display Name / Username
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
                  placeholder="sarah@organization.com"
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
                  A cryptographically secure initial password will be generated and shown once.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary text-[12px] py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperationPending}
                  className="btn-primary text-[12px] py-2 px-3.5"
                >
                  {isOperationPending ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disclosed Credentials Modal */}
      {disclosedCredential && (
        <div className="fixed inset-0 z-50 bg-[#10172a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(16,23,42,0.15)] border border-[#e2e5f6] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#f1f3fb] flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <h3 className="text-[15px] font-semibold text-[#10172a]">
                  {disclosedCredential.isReset ? 'Credential Reset' : 'Account Credentials Provisioned'}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-600 mt-0.5 shrink-0">warning</span>
                <span>
                  <strong>Copy now.</strong> Plaintext passwords are never logged or stored in the database.
                </span>
              </div>

              <div className="space-y-2 bg-[#f8f9ff] p-3.5 rounded-lg border border-[#e2e5f6] text-[12px] font-mono">
                <div className="flex justify-between">
                  <span className="text-[#8890b8]">Email:</span>
                  <span className="text-[#10172a] font-semibold">{disclosedCredential.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8890b8]">Assigned Role:</span>
                  <span className="text-[#2563eb] font-semibold">{disclosedCredential.role}</span>
                </div>
                <div className="pt-2 border-t border-[#e2e5f6]">
                  <span className="text-[#8890b8] block mb-1">Temporary Password:</span>
                  <div className="flex items-center justify-between p-2 rounded bg-white border border-[#b3c5ff]">
                    <span className="text-[#10172a] font-bold select-all">{disclosedCredential.password}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(disclosedCredential.password);
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
                  onClick={() => setDisclosedCredential(null)}
                  className="btn-primary text-[12px] py-2 px-4"
                >
                  I have saved these credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
