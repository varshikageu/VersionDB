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
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Protected Branch Governance
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Admin Approvals & Escalation Queue
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Lead DBA sign-off queue for protected production merges and escalated conflicts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-neutral">
            Role: <strong className="text-[#10172a] font-semibold">{currentUser.role}</strong>
          </span>
          {!roleCapabilities.canAdminApproveEscalation && (
            <button
              type="button"
              onClick={() => navigateTo('403')}
              className="text-[12px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
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
        <div className="space-y-3.5">
          {adminApprovals.map((item) => (
            <div
              key={item.id}
              className="vdb-card p-5 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f3fb]">
                <div className="text-[15px] font-semibold text-[#10172a]">
                  MR #{item.mrNumber} — {item.mrTitle}
                </div>
                <span className="badge badge-amber">{item.status}</span>
              </div>
              <p className="text-[13px] text-[#5263a0] leading-relaxed">{item.blockerSummary}</p>
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <input
                  type="text"
                  value={reasonByApproval[item.id] || ''}
                  onChange={(e) =>
                    setReasonByApproval((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Enter Lead DBA decision reason..."
                  className="vdb-input flex-1 text-[12px] py-1.5"
                />
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void decideAdminApproval(item.id, 'APPROVED', reasonByApproval[item.id] || '')
                  }
                  className="btn-primary text-[12px] py-1.5"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isOperationPending}
                  onClick={() =>
                    void decideAdminApproval(item.id, 'REJECTED', reasonByApproval[item.id] || '')
                  }
                  className="btn-primary text-[12px] py-1.5 bg-red-600 hover:bg-red-700 text-white"
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
