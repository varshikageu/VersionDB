import React from 'react';
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
    switchUserOrRole,
    updateUserRole,
    isOperationPending,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const roles: UserRole[] = ['Viewer', 'Developer', 'Reviewer', 'Admin'];

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Role-Based Access Control (RBAC)
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Members & Permissions Matrix
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect role capability definitions and manage organization member access. Server-side
            authorization is authoritative.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-mono text-xs uppercase text-secondary">
            UI Layout Preview Hint:
          </span>
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => switchUserOrRole(r)}
              className={`px-2.5 py-1 rounded text-xs font-code-sm transition-colors ${
                currentUser.role === r
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-surface-container-low text-secondary hover:text-on-surface'
              }`}
            >
              {r}
            </button>
          ))}
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

      {/* Static Role Capabilities Reference Matrix */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <h2 className="font-headline text-title-md text-on-surface">
            Role Capability Matrix (Enforced by Backend Server)
          </h2>
          <span className="font-code-sm text-xs text-secondary">Static Policy Definition</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-code-sm text-xs">
            <thead>
              <tr className="border-b border-surface-container text-secondary">
                <th className="py-2.5 px-4">Capability</th>
                {roles.map((r) => (
                  <th key={r} className="py-2.5 px-4">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {(
                [
                  ['Execute SELECT Queries', 'canExecuteSelect'],
                  ['Stage Row & DDL Changes', 'canEditRecordsAndStage'],
                  ['Create Commits & Branches', 'canCreateCommit'],
                  ['Approve Merge Requests', 'canReviewAndApproveMr'],
                  ['Merge Protected Branches', 'canMergeProtectedMain'],
                  ['Lead DBA Escalation & Rollback', 'canAdminApproveEscalation'],
                ] as const
              ).map(([label, capKey]) => (
                <tr key={capKey}>
                  <td className="py-2.5 px-4 font-body-sm text-on-surface">{label}</td>
                  {roles.map((r) => (
                    <td key={r} className="py-2.5 px-4">
                      {ROLE_UI_CAPABILITIES[r][capKey] ? (
                        <span className="text-[#16a34a] font-bold">Allowed</span>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workspace Members List (Server-Driven) */}
      {isCatalogLoading ? (
        <TableSkeletonLoader rows={4} columns={4} />
      ) : users.length === 0 ? (
        <EmptyStateCard
          icon="group"
          title="No Workspace Members Loaded"
          description="No organization members are loaded because no backend service is configured (`VITE_API_BASE_URL` is unset). VersionDB does not display fabricated user accounts."
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden">
          <table className="w-full text-left border-collapse font-body-sm text-xs">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-container font-label-mono uppercase text-secondary">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-semibold text-on-surface">{u.name}</td>
                  <td className="py-3 px-4 font-code-sm text-secondary">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      disabled={isOperationPending}
                      onChange={(e) => void updateUserRole(u.id, e.target.value as UserRole)}
                      className="rounded border border-outline-variant/30 px-2 py-1 font-code-sm text-xs"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
