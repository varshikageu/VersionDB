import React from 'react';
import { useVersionDb } from '../context/VersionDbContext';

export const NotFound404Screen: React.FC = () => {
  const { navigateTo, navigateBack } = useVersionDb();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary-fixed/40 border border-primary/20 flex items-center justify-center text-primary mb-5 shadow-xs">
        <span className="material-symbols-outlined text-3xl">account_tree</span>
      </div>
      <div className="font-code-sm text-xs font-bold uppercase tracking-widest text-primary mb-1">
        HTTP 404 • Unresolved Route Reference
      </div>
      <h1 className="font-headline text-display-md text-on-surface mb-2">404 — Page not found</h1>
      <p className="font-body-md text-body-md text-secondary leading-relaxed mb-6">
        The requested workspace path does not match any registered VersionDB screen or resource
        route.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={navigateBack}
          className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Previous Page
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">dashboard</span>
          Go to Overview
        </button>
      </div>
    </div>
  );
};

export const AccessDenied403Screen: React.FC = () => {
  const { currentUser, authState, navigateTo, navigateBack } = useVersionDb();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-error-container/40 border border-error/25 flex items-center justify-center text-error mb-5 shadow-xs">
        <span className="material-symbols-outlined text-3xl">gpp_maybe</span>
      </div>
      <div className="font-code-sm text-xs font-bold uppercase tracking-widest text-error mb-1">
        HTTP 403 • Authorization Policy Restriction
      </div>
      <h1 className="font-headline text-headline-lg text-on-surface mb-2">403 — Access Denied</h1>
      <p className="font-body-md text-body-md text-secondary leading-relaxed mb-4">
        Your current session does not have server-verified permission to execute or access this
        resource.
      </p>
      <div className="w-full p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 text-left font-code-sm text-xs text-secondary mb-6 space-y-1">
        <div className="flex justify-between">
          <span>Authentication Session:</span>
          <span className="text-on-surface font-semibold">
            {authState.isAuthenticated ? 'Authenticated' : 'Unauthenticated'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Active UI Role Hint:</span>
          <span className="text-primary font-semibold">{currentUser.role}</span>
        </div>
        <p className="font-body-sm text-[11px] text-secondary pt-1">
          Note: Client-side UI role hints never grant real backend permissions. Authoritative access
          control is enforced by the VersionDB server.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={navigateBack}
          className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Previous Page
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">dashboard</span>
          Go to Overview
        </button>
      </div>
    </div>
  );
};

export const ServerError500Screen: React.FC<{ is503?: boolean }> = ({ is503 = false }) => {
  const {
    lastBackendError,
    apiBaseUrl,
    isCatalogLoading,
    refreshWorkspaceCatalog,
    navigateTo,
    setApiContractDrawerOpen,
  } = useVersionDb();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-[#fffbeb] border border-[#f59e0b]/35 flex items-center justify-center text-[#d97706] mb-5 shadow-xs">
        <span className="material-symbols-outlined text-3xl">cloud_off</span>
      </div>
      <div className="font-code-sm text-xs font-bold uppercase tracking-widest text-[#b45309] mb-1">
        {is503 ? 'HTTP 503 • Service Unavailable' : 'HTTP 500 • Backend Communication Failure'}
      </div>
      <h1 className="font-headline text-headline-lg text-on-surface mb-2">
        {is503 ? '503 — Service Temporarily Unavailable' : '500 — Backend Service Error'}
      </h1>
      <p className="font-body-md text-body-md text-secondary leading-relaxed mb-4">
        {lastBackendError ||
          'The VersionDB frontend could not establish a connection with the backend service.'}
      </p>
      <div className="w-full p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 text-left font-code-sm text-xs text-secondary mb-6 space-y-1">
        <div className="flex justify-between">
          <span>Configured Endpoint:</span>
          <span className="text-on-surface font-semibold">
            {apiBaseUrl || 'VITE_API_BASE_URL unset'}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={isCatalogLoading}
          onClick={() => void refreshWorkspaceCatalog()}
          className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {isCatalogLoading ? 'Retrying...' : 'Retry Connection'}
        </button>
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors"
        >
          View Integration Contract
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors"
        >
          Return to Overview
        </button>
      </div>
    </div>
  );
};
