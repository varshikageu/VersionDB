import React, { useState } from 'react';
import { BackendStatusBanner } from '../components/common/StateViews';
import { useVersionDb } from '../context/VersionDbContext';
import { DatabaseConnectionMode } from '../types/versiondb';

export const SettingsScreen: React.FC = () => {
  const {
    activeRepo,
    setRepositoryConnectionMode,
    apiBaseUrl,
    isBackendConfigured,
    backendConnectionState,
    connectionDiagnostics,
    checkBackendHealth,
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    setCreateRepoModalOpen,
    uiPreferences,
    updateUiPreferences,
  } = useVersionDb();

  const [isProbing, setIsProbing] = useState(false);

  const handleManualProbe = async () => {
    setIsProbing(true);
    await checkBackendHealth();
    setIsProbing(false);
  };

  const getDiagnosticsStatusBadge = () => {
    switch (connectionDiagnostics.status) {
      case 'connected':
        return (
          <span className="badge badge-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="badge badge-amber">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            High Latency
          </span>
        );
      case 'checking':
        return (
          <span className="badge badge-blue">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Probing…
          </span>
        );
      case 'unconfigured':
        return (
          <span className="badge badge-neutral">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Not Configured
          </span>
        );
      default:
        return (
          <span className="badge badge-red">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="vdb-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-[#2563eb] font-semibold uppercase tracking-wider mb-1">
            System Configuration & Health
          </div>
          <h1 className="text-[22px] font-bold text-[#10172a] tracking-tight">
            Repository & Environment Settings
          </h1>
          <p className="text-[13px] text-[#5263a0] mt-0.5">
            Configure database connection modes, monitor real-time backend health, and adjust workspace display preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isProbing}
            onClick={() => void handleManualProbe()}
            className="btn-primary"
          >
            <span className={`material-symbols-outlined text-[15px] ${isProbing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Check Health</span>
          </button>
          <button
            type="button"
            onClick={() => setApiContractDrawerOpen(true)}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-[15px] text-[#2563eb]">description</span>
            Contract Drawer
          </button>
        </div>
      </div>

      {/* Backend Status Banner */}
      <BackendStatusBanner
        connectionState={backendConnectionState}
        apiBaseUrl={apiBaseUrl}
        errorMessage={lastBackendError}
        onRetry={() => void refreshWorkspaceCatalog()}
        onViewContract={() => setApiContractDrawerOpen(true)}
        isLoading={isCatalogLoading}
      />

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Live Diagnostics & Environment */}
        <div className="vdb-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#f1f3fb] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#2563eb]">
                <span className="material-symbols-outlined text-[18px]">pulse_alert</span>
              </div>
              <h2 className="text-[14px] font-semibold text-[#10172a]">
                Backend Service Diagnostics
              </h2>
            </div>
            {getDiagnosticsStatusBadge()}
          </div>

          <div className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
              <span className="text-[#5263a0]">API Base URL:</span>
              <span className="font-mono text-[11px] font-medium text-[#10172a] bg-[#f8f9ff] px-2 py-0.5 rounded border border-[#e2e5f6]">
                {apiBaseUrl || 'Unconfigured (Empty string)'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
              <span className="text-[#5263a0]">Measured Round-Trip Latency:</span>
              <span className="font-mono text-[12px] font-semibold text-[#10172a]">
                {connectionDiagnostics.latencyMs !== null ? `${connectionDiagnostics.latencyMs} ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
              <span className="text-[#5263a0]">Backend Integration Configured:</span>
              <span className={`font-semibold ${isBackendConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isBackendConfigured ? 'Yes (VITE_API_BASE_URL set)' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
              <span className="text-[#5263a0]">Session Auth State:</span>
              <span className="font-mono text-[11px] uppercase font-semibold text-[#10172a]">
                {backendConnectionState}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#5263a0]">Last Health Probe:</span>
              <span className="text-[#8890b8] font-mono text-[11px]">
                {connectionDiagnostics.lastCheckedAt
                  ? new Date(connectionDiagnostics.lastCheckedAt).toLocaleTimeString()
                  : 'Awaiting initial probe'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Repository Settings */}
        <div className="vdb-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#f1f3fb] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#2563eb]">
                <span className="material-symbols-outlined text-[18px]">database</span>
              </div>
              <h2 className="text-[14px] font-semibold text-[#10172a]">
                Active Repository Governance
              </h2>
            </div>
            {activeRepo && (
              <span className="badge badge-blue">
                {activeRepo.defaultBranch || 'main'}
              </span>
            )}
          </div>

          {!activeRepo ? (
            <div className="py-6 text-center space-y-3">
              <span className="material-symbols-outlined text-[32px] text-[#8890b8]">dns</span>
              <p className="text-[12px] text-[#5263a0] max-w-sm mx-auto">
                No repository is currently connected. Register or select a repository from the top navigation to configure connection mode.
              </p>
              <button
                type="button"
                onClick={() => setCreateRepoModalOpen(true)}
                className="btn-primary inline-flex text-[12px] py-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Register Repository</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
                  <span className="text-[#5263a0]">Repository Identifier:</span>
                  <span className="font-mono text-[12px] font-semibold text-[#10172a]">
                    {activeRepo.name}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
                  <span className="text-[#5263a0]">Engine & Version:</span>
                  <span className="text-[#10172a] font-medium font-mono">
                    {activeRepo.engine} {activeRepo.engineVersion}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
                  <span className="text-[#5263a0]">Environment:</span>
                  <span className="text-[#10172a] font-medium">{activeRepo.environment}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#f8f9ff]">
                  <span className="text-[#5263a0]">Cloud Region:</span>
                  <span className="font-mono text-[12px] text-[#10172a]">{activeRepo.region}</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#10172a] mb-2">
                  Database Connection Mode:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['connected', 'read-only', 'disconnected'] as DatabaseConnectionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => void setRepositoryConnectionMode(activeRepo.id, mode)}
                      className={`px-3 py-2 rounded-lg text-[12px] font-medium text-center capitalize transition-all border ${
                        activeRepo.connectionMode === mode
                          ? 'bg-[#10172a] text-white border-[#10172a] shadow-xs'
                          : 'bg-[#f8f9ff] hover:bg-[#f1f3fb] text-[#5263a0] border-[#e2e5f6]'
                      }`}
                    >
                      {mode === 'read-only' ? 'Read-Only' : mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Workspace Display Preferences */}
        <div className="vdb-card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-[#f1f3fb] pb-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#2563eb]">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <h2 className="text-[14px] font-semibold text-[#10172a]">
              Client Workspace Display Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[12px] font-semibold text-[#10172a] mb-1.5">
                Table Row Density
              </label>
              <div className="flex rounded-lg border border-[#e2e5f6] p-0.5 bg-[#f8f9ff]">
                {(['compact', 'comfortable'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => updateUiPreferences({ tableDensity: density })}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-md capitalize transition-all ${
                      uiPreferences.tableDensity === density
                        ? 'bg-white text-[#10172a] shadow-xs font-semibold'
                        : 'text-[#5263a0] hover:text-[#10172a]'
                    }`}
                  >
                    {density}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[#8890b8]">
                Vertical padding applied in table data and schema browser views.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#e2e5f6] bg-[#f8f9ff]">
              <div>
                <span className="block text-[12px] font-semibold text-[#10172a]">
                  Show Line Numbers
                </span>
                <span className="text-[11px] text-[#8890b8]">
                  Display gutters in SQL editor and diff viewer.
                </span>
              </div>
              <input
                type="checkbox"
                checked={uiPreferences.showLineNumbers}
                onChange={(e) => updateUiPreferences({ showLineNumbers: e.target.checked })}
                className="w-4 h-4 rounded text-[#2563eb] focus:ring-[#2563eb]/20 border-[#c5c9e4]"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#e2e5f6] bg-[#f8f9ff]">
              <div>
                <span className="block text-[12px] font-semibold text-[#10172a]">
                  Destructive Action Guard
                </span>
                <span className="text-[11px] text-[#8890b8]">
                  Prompt confirmation dialogs before drops or resets.
                </span>
              </div>
              <input
                type="checkbox"
                checked={uiPreferences.confirmDestructiveActions}
                onChange={(e) =>
                  updateUiPreferences({ confirmDestructiveActions: e.target.checked })
                }
                className="w-4 h-4 rounded text-[#2563eb] focus:ring-[#2563eb]/20 border-[#c5c9e4]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
