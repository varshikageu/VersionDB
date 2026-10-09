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
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Catalog Dependency Graph
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Data Lineage & Downstream Impact
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect upstream and downstream table, view, and replica dependencies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('schema-explorer')}
          className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25"
        >
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
          {lineageNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              className={`text-left p-5 rounded-xl border ${
                activeNode?.id === node.id
                  ? 'bg-surface-container-lowest border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-code-sm text-xs font-bold text-on-surface">
                  {node.schema}.{node.name}
                </span>
                <span className="font-label-mono text-[10px] uppercase text-secondary">
                  {node.type}
                </span>
              </div>
              <div className="font-code-sm text-[11px] text-secondary mt-2">
                Upstream: {node.upstreamIds.length} • Downstream: {node.downstreamIds.length}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
