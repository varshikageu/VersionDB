import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const AdminApprovalsScreen: React.FC = () => {
  const {
    adminApprovals,
    currentUser,
    roleCapabilities,
    decideAdminApproval,
    isOperationPending,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [reasonByApproval, setReasonByApproval] = useState<Record<string, string>>({});

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Protected Branch Governance
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Admin Approvals & Escalation Queue
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Lead DBA sign-off queue for protected production merges and escalated conflicts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-code-sm text-code-sm">
          <span className="px-2.5 py-1 rounded bg-surface-container text-secondary">
            UI Role Hint: <strong className="text-on-surface">{currentUser.role}</strong>
          </span>
          {!roleCapabilities.canAdminApproveEscalation && (
            <button
              type="button"
              onClick={() => navigateTo('403')}
              className="px-2.5 py-1 rounded bg-error-container/30 hover:bg-error-container/50 text-error font-medium transition-colors"
            >
              Inspect 403 Policy View →
            </button>
          )}
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

      {isCatalogLoading ? (
        <TableSkeletonLoader rows={3} columns={4} />
      ) : adminApprovals.length === 0 ? (
        <EmptyStateCard
          icon="verified_user"
          title="No Pending Admin Escalations"
          description="There are 0 pending Lead DBA escalation items. Escalation items appear when protected branch merges or schema/record conflicts require administrative sign-off on a connected backend."
          actionLabel="View Merge Requests"
          onAction={() => navigateTo('merge-requests')}
        />
      ) : (
        <div className="space-y-4">
          {adminApprovals.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-headline text-title-md text-on-surface">
                  MR #{item.mrNumber} — {item.mrTitle}
                </div>
                <span className="font-code-sm text-xs text-secondary">{item.status}</span>
              </div>
              <p className="font-body-sm text-xs text-secondary">{item.blockerSummary}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={reasonByApproval[item.id] || ''}
                  onChange={(e) =>
                    setReasonByApproval((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Enter Lead DBA decision reason..."
                  className="flex-1 rounded-lg border border-outline-variant/40 px-3 py-1.5 font-body-sm text-xs"
                />
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void decideAdminApproval(item.id, 'APPROVED', reasonByApproval[item.id] || '')
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-white font-body-sm text-xs font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void decideAdminApproval(item.id, 'REJECTED', reasonByApproval[item.id] || '')
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-error text-white font-body-sm text-xs font-semibold disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
