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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            High Latency
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Probing…
          </span>
        );
      case 'unconfigured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Not Configured
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
            Repository & Environment Settings
          </h1>
          <p className="font-body-sm text-xs text-secondary mt-1">
            Configure database connection modes, monitor real-time backend health, and adjust workspace display preferences.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isProbing}
            onClick={() => void handleManualProbe()}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-body-sm text-xs font-medium border border-slate-200 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isProbing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Check Health</span>
          </button>
          <button
            type="button"
            onClick={() => setApiContractDrawerOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-medium border border-outline-variant/25 transition-colors"
          >
            Backend Contract Drawer
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Live Diagnostics & Environment */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-xl">pulse_alert</span>
              <h2 className="font-headline text-sm font-semibold text-on-surface">
                Backend Service Diagnostics
              </h2>
            </div>
            {getDiagnosticsStatusBadge()}
          </div>

          <div className="space-y-3 font-body-sm text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-secondary">API Base URL:</span>
              <span className="font-code-sm text-xs font-medium text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                {apiBaseUrl || 'Unconfigured (Empty string)'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-secondary">Measured Round-Trip Latency:</span>
              <span className="font-code-sm text-xs font-semibold text-slate-800">
                {connectionDiagnostics.latencyMs !== null ? `${connectionDiagnostics.latencyMs} ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-secondary">Backend Integration Configured:</span>
              <span className={`font-medium ${isBackendConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isBackendConfigured ? 'Yes (VITE_API_BASE_URL set)' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-secondary">Session Auth State:</span>
              <span className="font-code-sm text-xs uppercase font-medium text-slate-700">
                {backendConnectionState}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-secondary">Last Health Probe:</span>
              <span className="text-slate-500 text-[11px]">
                {connectionDiagnostics.lastCheckedAt
                  ? new Date(connectionDiagnostics.lastCheckedAt).toLocaleTimeString()
                  : 'Awaiting initial probe'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Repository Settings */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-xl">database</span>
              <h2 className="font-headline text-sm font-semibold text-on-surface">
                Active Repository Governance
              </h2>
            </div>
            {activeRepo && (
              <span className="font-code-sm text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {activeRepo.defaultBranch || 'main'}
              </span>
            )}
          </div>

          {!activeRepo ? (
            <div className="py-6 text-center space-y-3">
              <span className="material-symbols-outlined text-3xl text-slate-300">dns</span>
              <p className="font-body-sm text-xs text-secondary max-w-sm mx-auto">
                No repository is currently connected. Register or select a repository from the top navigation to configure connection mode.
              </p>
              <button
                type="button"
                onClick={() => setCreateRepoModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Register Repository</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 font-body-sm text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-secondary">Repository Identifier:</span>
                  <span className="font-code-sm text-xs font-semibold text-slate-800">
                    {activeRepo.name}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-secondary">Engine & Version:</span>
                  <span className="text-slate-800 font-medium">
                    {activeRepo.engine} {activeRepo.engineVersion}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-secondary">Environment:</span>
                  <span className="text-slate-800 font-medium">{activeRepo.environment}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-secondary">Cloud Region / Placement:</span>
                  <span className="font-code-sm text-xs text-slate-700">{activeRepo.region}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Database Connection Mode:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['connected', 'read-only', 'disconnected'] as DatabaseConnectionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => void setRepositoryConnectionMode(activeRepo.id, mode)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-center capitalize transition-all border ${
                        activeRepo.connectionMode === mode
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
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
        <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-primary text-xl">tune</span>
            <h2 className="font-headline text-sm font-semibold text-on-surface">
              Client Workspace Display Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Table Row Density
              </label>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {(['compact', 'comfortable'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => updateUiPreferences({ tableDensity: density })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                      uiPreferences.tableDensity === density
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {density}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Vertical padding applied in table data and schema browser views.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <div>
                <span className="block text-xs font-medium text-slate-800">
                  Show Line Numbers
                </span>
                <span className="text-[11px] text-slate-500">
                  Display gutters in SQL editor and diff viewer.
                </span>
              </div>
              <input
                type="checkbox"
                checked={uiPreferences.showLineNumbers}
                onChange={(e) => updateUiPreferences({ showLineNumbers: e.target.checked })}
                className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-slate-300"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <div>
                <span className="block text-xs font-medium text-slate-800">
                  Destructive Action Guard
                </span>
                <span className="text-[11px] text-slate-500">
                  Prompt confirmation dialogs before drops or resets.
                </span>
              </div>
              <input
                type="checkbox"
                checked={uiPreferences.confirmDestructiveActions}
                onChange={(e) =>
                  updateUiPreferences({ confirmDestructiveActions: e.target.checked })
                }
                className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-slate-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
