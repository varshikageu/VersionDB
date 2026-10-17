import React from 'react';
import { BackendConnectionState } from '../../types/versiondb';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyStateCard: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="vdb-card p-12 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-[#f1f3fb] border border-[#e2e5f6] flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[24px] text-[#8890b8]">{icon}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-[#10172a] mb-1.5">{title}</h3>
      <p className="text-[13px] text-[#5263a0] max-w-md leading-relaxed mb-5">{description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <button type="button" onClick={onAction} className="btn-primary">
              <span className="material-symbols-outlined text-[15px]">add</span>
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button type="button" onClick={onSecondaryAction} className="btn-secondary">
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface BackendStatusBannerProps {
  connectionState: BackendConnectionState;
  apiBaseUrl: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  onViewContract?: () => void;
  isLoading?: boolean;
}

export const BackendStatusBanner: React.FC<BackendStatusBannerProps> = ({
  connectionState,
  apiBaseUrl,
  errorMessage,
  onRetry,
  onViewContract,
  isLoading,
}) => {
  if (connectionState === 'connected' && !errorMessage) {
    return null;
  }

  const isUnconfigured = connectionState === 'unconfigured';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
        isUnconfigured
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined text-[18px] mt-0.5 ${isUnconfigured ? 'text-amber-500' : 'text-red-500'}`}>
          {isUnconfigured ? 'cloud_off' : 'report_problem'}
        </span>
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-2 flex-wrap">
            <span>
              {isUnconfigured
                ? 'Backend Not Configured'
                : connectionState === 'unauthorized'
                  ? 'Authentication Required'
                  : 'Backend Service Unavailable'}
            </span>
            <code className="px-2 py-0.5 rounded bg-white/80 border border-current/20 text-[10px] font-mono opacity-70">
              {apiBaseUrl ? `VITE_API_BASE_URL=${apiBaseUrl}` : 'VITE_API_BASE_URL unset'}
            </code>
          </div>
          <p className="text-[12px] opacity-80 mt-0.5 max-w-xl leading-relaxed">
            {errorMessage ||
              (isUnconfigured
                ? 'No backend API endpoint is configured. Operational repositories, schemas, commits, and metrics are not loaded until a real VersionDB server is connected.'
                : 'The frontend could not complete the request against the configured backend endpoint.')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onViewContract && (
          <button
            type="button"
            onClick={onViewContract}
            className="btn-secondary text-[12px] py-1.5"
          >
            View Contract
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            className="btn-primary text-[12px] py-1.5"
          >
            <span className={`material-symbols-outlined text-[13px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            {isLoading ? 'Checking...' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeletonLoader: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div
      className="vdb-card overflow-hidden animate-pulse"
      aria-busy="true"
      aria-label="Loading data from backend"
    >
      <div className="bg-[#f1f3fb] px-4 py-3 border-b border-[#e2e5f6] grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className="h-3 bg-[#e2e5f6] rounded-full w-20" />
        ))}
      </div>
      <div className="divide-y divide-[#f1f3fb]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="px-4 py-3.5 grid gap-4 items-center"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((__, cIdx) => (
              <div
                key={cIdx}
                className={`h-3 bg-[#e8ebf8] rounded-full ${
                  cIdx === 0 ? 'w-32' : cIdx === columns - 1 ? 'w-14' : 'w-20'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ErrorStateCardProps {
  title: string;
  message: string;
  code?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorStateCard: React.FC<ErrorStateCardProps> = ({
  title,
  message,
  code = 'ERR_BACKEND_UNAVAILABLE',
  onRetry,
  onDismiss,
}) => {
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-red-500 text-[20px] mt-0.5">error</span>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[13px] font-semibold text-[#10172a]">{title}</h4>
            <span className="badge badge-red">{code}</span>
          </div>
          <p className="text-[12px] text-[#5263a0]">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry}
            className="btn-primary text-[12px] py-1.5 bg-red-600 hover:bg-red-700">
            <span className="material-symbols-outlined text-[13px]">refresh</span>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="btn-secondary text-[12px] py-1.5">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
