import React from 'react';
import { useVersionDb } from '../context/VersionDbContext';

export const NotFound404Screen: React.FC = () => {
  const { navigateTo, navigateBack } = useVersionDb();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-[#eff4ff] border border-[#e2e5f6] flex items-center justify-center text-[#2563eb] mb-5 shadow-[0_2px_8px_rgba(37,99,235,0.08)]">
        <span className="material-symbols-outlined text-[32px]">account_tree</span>
      </div>
      <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-1">
        HTTP 404 • Unresolved Route
      </div>
      <h1 className="text-[26px] font-bold text-[#10172a] mb-2 tracking-tight">404 — Page not found</h1>
      <p className="text-[13px] text-[#5263a0] leading-relaxed mb-6">
        The requested workspace path does not match any registered VersionDB screen or resource route.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={navigateBack}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          Back to Previous Page
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">dashboard</span>
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
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-5 shadow-xs">
        <span className="material-symbols-outlined text-[32px]">gpp_maybe</span>
      </div>
      <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-red-600 mb-1">
        HTTP 403 • Authorization Policy Restriction
      </div>
      <h1 className="text-[26px] font-bold text-[#10172a] mb-2 tracking-tight">403 — Access Denied</h1>
      <p className="text-[13px] text-[#5263a0] leading-relaxed mb-4">
        Your current session does not have server-verified permission to execute or access this resource.
      </p>
      <div className="w-full p-4 rounded-xl bg-white border border-[#e2e5f6] text-left font-mono text-[12px] text-[#5263a0] mb-6 space-y-1.5 shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex justify-between">
          <span>Authentication Session:</span>
          <span className="text-[#10172a] font-semibold">
            {authState.isAuthenticated ? 'Authenticated' : 'Unauthenticated'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Active UI Role Hint:</span>
          <span className="text-[#2563eb] font-semibold">{currentUser.role}</span>
        </div>
        <p className="text-[11px] text-[#8890b8] pt-1">
          Note: Client-side UI role hints never grant real backend permissions. Authoritative access control is enforced by the VersionDB server.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={navigateBack}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          Back to Previous Page
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">dashboard</span>
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
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
        <span className="material-symbols-outlined text-[32px]">cloud_off</span>
      </div>
      <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1">
        {is503 ? 'HTTP 503 • Service Unavailable' : 'HTTP 500 • Backend Communication Failure'}
      </div>
      <h1 className="text-[26px] font-bold text-[#10172a] mb-2 tracking-tight">
        {is503 ? '503 — Service Temporarily Unavailable' : '500 — Backend Service Error'}
      </h1>
      <p className="text-[13px] text-[#5263a0] leading-relaxed mb-4">
        {lastBackendError ||
          'The VersionDB frontend could not establish a connection with the backend service.'}
      </p>
      <div className="w-full p-4 rounded-xl bg-white border border-[#e2e5f6] text-left font-mono text-[12px] text-[#5263a0] mb-6 shadow-[0_1px_3px_rgba(16,23,42,0.04)]">
        <div className="flex justify-between">
          <span>Configured Endpoint:</span>
          <span className="text-[#10172a] font-semibold">
            {apiBaseUrl || 'VITE_API_BASE_URL unset'}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          disabled={isCatalogLoading}
          onClick={() => void refreshWorkspaceCatalog()}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          {isCatalogLoading ? 'Retrying...' : 'Retry Connection'}
        </button>
        <button
          type="button"
          onClick={() => setApiContractDrawerOpen(true)}
          className="btn-secondary"
        >
          View Contract
        </button>
        <button
          type="button"
          onClick={() => navigateTo('overview')}
          className="btn-secondary"
        >
          Return to Overview
        </button>
      </div>
    </div>
  );
};
