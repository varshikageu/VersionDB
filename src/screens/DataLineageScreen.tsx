import React, { useState } from 'react';
import {
  BackendStatusBanner,
  EmptyStateCard,
  TableSkeletonLoader,
} from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';

export const DataLineageScreen: React.FC = () => {
  const {
    lineageNodes,
    isCatalogLoading,
    backendConnectionState,
    apiBaseUrl,
    lastBackendError,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const activeNode =
    lineageNodes.find((n) => n.id === selectedNodeId) || lineageNodes[0] || null;

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            Catalog Dependency Graph
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Data Lineage & Downstream Impact
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Inspect upstream and downstream table, view, and replica dependencies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('schema-explorer')}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px] text-[#2563eb]">schema</span>
          Schema Explorer
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
        <TableSkeletonLoader rows={4} columns={4} />
      ) : lineageNodes.length === 0 ? (
        <EmptyStateCard
          icon="hub"
          title="No Lineage Graph Introspected"
          description="No dependency nodes are loaded because no backend repository is connected. Connect a VersionDB backend to compute foreign-key, view, and replica lineage."
          actionLabel="Open Schema Explorer"
          onAction={() => navigateTo('schema-explorer')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lineageNodes.map((node) => {
            const isSelected = activeNode?.id === node.id;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`text-left p-5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-white border-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.08)] ring-1 ring-[#2563eb]'
                    : 'bg-white border-[#e2e5f6] hover:border-[#b3c5ff] hover:bg-[#fbfbfe]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[13px] font-bold text-[#10172a]">
                    {node.schema}.{node.name}
                  </span>
                  <span className="badge badge-neutral">
                    {node.type}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#5263a0]">
                  Upstream: <span className="font-semibold text-[#10172a]">{node.upstreamIds.length}</span> • Downstream: <span className="font-semibold text-[#10172a]">{node.downstreamIds.length}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
