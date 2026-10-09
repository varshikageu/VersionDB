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
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/25 p-10 text-center flex flex-col items-center justify-center shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center text-secondary mb-4">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <h3 className="font-headline text-title-md text-on-surface mb-1.5">{title}</h3>
      <p className="font-body-sm text-body-sm text-secondary max-w-md leading-relaxed mb-5">
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="px-4 py-2 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/25 transition-colors"
            >
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
          ? 'bg-[#fffbeb] border-[#f59e0b]/35 text-[#92400e]'
          : 'bg-error-container/25 border-error/25 text-on-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined text-lg mt-0.5 ${
            isUnconfigured ? 'text-[#d97706]' : 'text-error'
          }`}
        >
          {isUnconfigured ? 'cloud_off' : 'report_problem'}
        </span>
        <div>
          <div className="font-headline text-body-sm font-semibold flex items-center gap-2">
            <span>
              {isUnconfigured
                ? 'Backend Not Configured'
                : connectionState === 'unauthorized'
                  ? 'Authentication Required (HTTP 401)'
                  : 'Backend Service Unavailable'}
            </span>
            <span className="px-2 py-0.5 rounded bg-white/80 border border-outline-variant/30 font-code-sm text-[10px] text-secondary">
              {apiBaseUrl ? `VITE_API_BASE_URL=${apiBaseUrl}` : 'VITE_API_BASE_URL unset'}
            </span>
          </div>
          <p className="font-body-sm text-xs opacity-90 mt-0.5">
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
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-surface-container-low text-on-surface font-body-sm text-xs font-medium border border-outline-variant/30 transition-colors"
          >
            Inspect Integration Contract
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-on-surface text-white hover:opacity-90 disabled:opacity-50 font-body-sm text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className={`material-symbols-outlined text-xs ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            {isLoading ? 'Checking...' : 'Retry Connection'}
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
      className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm animate-pulse"
      aria-busy="true"
      aria-label="Loading data from backend"
    >
      <div className="bg-surface-container-low px-4 py-3 border-b border-surface-container grid grid-cols-5 gap-4">
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className="h-3 bg-surface-container-high rounded w-24" />
        ))}
      </div>
      <div className="divide-y divide-surface-container">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-4 py-3.5 grid grid-cols-5 gap-4 items-center">
            {Array.from({ length: columns }).map((__, cIdx) => (
              <div
                key={cIdx}
                className={`h-3.5 bg-surface-container rounded ${
                  cIdx === 0 ? 'w-32' : cIdx === columns - 1 ? 'w-16 justify-self-end' : 'w-24'
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
      className="bg-error-container/30 border border-error/30 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-error text-xl mt-0.5">error</span>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-headline text-body-md font-semibold text-on-surface">{title}</h4>
            <span className="px-2 py-0.5 rounded bg-error/10 text-error font-code-sm text-[11px]">
              {code}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3.5 py-1.5 rounded-lg bg-error text-white font-body-sm text-body-sm font-semibold hover:opacity-95 transition-opacity flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Retry Request
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-secondary font-body-sm text-body-sm font-medium border border-outline-variant/25"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
