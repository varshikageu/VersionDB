import React from 'react';
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
    lastBackendError,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    setApiContractDrawerOpen,
    navigateTo,
  } = useVersionDb();

  return (
    <div className="flex flex-col w-full pb-12 pt-2 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-label-mono text-label-sm uppercase text-primary mb-1">
            Environment & Governance Configuration
          </div>
          <h1 className="font-headline text-headline-lg text-on-surface">
            Repository & Environment Settings
          </h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Inspect backend environment configuration, connection state, and required API contracts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/25"
        >
          Open Backend Contract Drawer
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-4">
          <h2 className="font-headline text-title-md text-on-surface">
            Backend API Environment Configuration
          </h2>
          <div className="space-y-2.5 font-code-sm text-xs">
            <div className="flex justify-between py-2 border-b border-surface-container">
              <span className="text-secondary">Environment Variable:</span>
              <span className="text-on-surface font-semibold">VITE_API_BASE_URL</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-container">
              <span className="text-secondary">Configured Value:</span>
              <span className="text-primary font-semibold">
                {apiBaseUrl || 'Unset (Empty String)'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-container">
              <span className="text-secondary">Backend Configured:</span>
              <span className="text-on-surface font-semibold">
                {isBackendConfigured ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-secondary">Connection State:</span>
              <span className="text-on-surface font-semibold uppercase">
                {backendConnectionState}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-4">
          <h2 className="font-headline text-title-md text-on-surface">
            Active Repository Connection
          </h2>
          {!activeRepo ? (
            <p className="font-body-sm text-xs text-secondary">
              No repository is currently connected. Register or load a repository from a configured
              VersionDB backend to manage connection modes.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="font-code-sm text-xs text-on-surface font-semibold">
                {activeRepo.name} ({activeRepo.engine} {activeRepo.engineVersion})
              </div>
              <div className="flex gap-2">
                {(['connected', 'read-only', 'disconnected'] as DatabaseConnectionMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => void setRepositoryConnectionMode(activeRepo.id, mode)}
                      className={`px-3 py-1.5 rounded-lg font-code-sm text-xs border ${
                        activeRepo.connectionMode === mode
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-container-low text-on-surface border-outline-variant/25'
                      }`}
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-surface-container space-y-2">
            <div className="font-label-mono text-label-sm uppercase text-secondary">
              Application Routes & Boundaries
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigateTo('login')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /login
              </button>
              <button
                type="button"
                onClick={() => navigateTo('forgot-password')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /forgot-password
              </button>
              <button
                type="button"
                onClick={() => navigateTo('reset-password')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /reset-password
              </button>
              <button
                type="button"
                onClick={() => navigateTo('403')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /403
              </button>
              <button
                type="button"
                onClick={() => navigateTo('404')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /404
              </button>
              <button
                type="button"
                onClick={() => navigateTo('500')}
                className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container font-code-sm text-xs text-on-surface"
              >
                /500
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
