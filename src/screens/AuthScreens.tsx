import React, { useState } from 'react';
import { VERSIONDB_LOGO_URL } from '../config/appConfig';
import { useVersionDb } from '../context/VersionDbContext';

export const LoginScreen: React.FC = () => {
  const {
    signInWithBackend,
    isOperationPending,
    isBackendConfigured,
    apiBaseUrl,
    navigateTo,
    setApiContractDrawerOpen,
  } = useVersionDb();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Enter a valid organization email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    const result = await signInWithBackend(trimmedEmail, password);
    if (!result.ok) {
      setErrorMessage(
        result.error ||
          'Authentication failed. The VersionDB authentication backend is not configured or unreachable.'
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column — Brand Identity & Architecture Summary */}
      <div className="lg:col-span-5 bg-surface-container-low border-b lg:border-b-0 lg:border-r border-outline-variant/25 p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigateTo('overview')}
            className="flex items-center gap-2.5 text-left group"
          >
            <img
              src={VERSIONDB_LOGO_URL}
              alt="VersionDB Logo"
              className="w-8 h-8 rounded-lg object-cover border border-primary/20 shadow-xs"
            />
            <span className="font-headline text-xl font-bold tracking-tight text-on-surface">
              VersionDB
            </span>
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-[10px] uppercase">
              SQL Engine
            </span>
          </button>

          <div className="mt-12 space-y-4 max-w-md">
            <div className="font-label-mono text-label-sm uppercase text-primary tracking-wider">
              Database Version Control Platform
            </div>
            <h1 className="font-headline text-display-md text-on-surface leading-tight">
              Git-style branching, diffs, and governance for relational databases.
            </h1>
            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              Isolate schema and record mutations in copy-on-write branches, inspect row-level
              primary-key diffs, resolve merge collisions, and enforce Lead DBA approvals with
              point-in-time WAL rollback.
            </p>
          </div>

          <div className="mt-10 space-y-3 max-w-md">
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                account_tree
              </span>
              <div>
                <div className="font-headline text-body-sm font-semibold text-on-surface">
                  Isolated Database Branches & 3-Way Diffs
                </div>
                <p className="font-body-sm text-xs text-secondary mt-0.5">
                  Stage DDL and DML mutations safely before opening a Merge Request.
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                verified_user
              </span>
              <div>
                <div className="font-headline text-body-sm font-semibold text-on-surface">
                  Server-Enforced RBAC & Immutable Audit Ledger
                </div>
                <p className="font-body-sm text-xs text-secondary mt-0.5">
                  Protected branch merges and WAL checkpoint rollbacks require authoritative backend
                  verification.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-outline-variant/20 flex items-center justify-between text-xs text-secondary font-code-sm">
          <span>Precision Engineering Design System</span>
          <button
            type="button"
            onClick={() => setApiContractDrawerOpen(true)}
            className="text-primary hover:underline"
          >
            Backend Contract
          </button>
        </div>
      </div>

      {/* Right Column — Authentication Form */}
      <div className="lg:col-span-7 bg-surface-container-lowest flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="font-headline text-headline-md text-on-surface">
              Sign in to your workspace
            </h2>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              Authenticate against your organization&apos;s VersionDB server to access repositories.
            </p>
          </div>

          {/* Backend Integration Status Notice */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              isBackendConfigured
                ? 'bg-primary-fixed/20 border-primary/25'
                : 'bg-[#fffbeb] border-[#f59e0b]/35'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-label-mono text-[10px] uppercase font-semibold ${
                  isBackendConfigured ? 'text-primary' : 'text-[#b45309]'
                }`}
              >
                {isBackendConfigured
                  ? `Backend Endpoint: ${apiBaseUrl}`
                  : 'Authentication Backend Not Configured'}
              </span>
              <span className="font-code-sm text-[10px] text-secondary">
                {isBackendConfigured ? 'Configured' : 'VITE_API_BASE_URL unset'}
              </span>
            </div>
            <p className="font-body-sm text-xs text-secondary leading-relaxed">
              {isBackendConfigured
                ? 'Credentials will be submitted to the configured authentication service.'
                : 'No authentication backend is configured. Submitting this form will report the unconfigured service state rather than creating a fake session.'}
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 rounded-lg bg-error-container/30 border border-error/30 flex items-start gap-2.5 text-error"
            >
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              <span className="font-body-sm text-xs font-medium">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5"
              >
                Work Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block font-label-mono text-label-sm uppercase text-secondary"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigateTo('forgot-password')}
                  className="font-body-sm text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest pl-3.5 pr-10 py-2.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                <span className="font-body-sm text-xs text-secondary">
                  Remember session preference
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isOperationPending}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {isOperationPending ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    progress_activity
                  </span>
                  Authenticating with Backend...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">login</span>
                  Sign In to VersionDB
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-secondary">
            <span>Need access to your organization&apos;s workspace?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo('overview')}
                className="font-medium text-on-surface hover:underline"
              >
                Inspect Workspace UI →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordScreen: React.FC = () => {
  const { requestPasswordReset, isOperationPending, isBackendConfigured, navigateTo } =
    useVersionDb();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittedOk, setSubmittedOk] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittedOk(false);

    const res = await requestPasswordReset(email);
    if (res.ok) {
      setSubmittedOk(true);
    } else {
      setError(
        res.error ||
          'Password reset could not be processed because no authentication backend is configured.'
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant/25 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={VERSIONDB_LOGO_URL}
              alt="VersionDB Logo"
              className="w-7 h-7 rounded-md object-cover border border-primary/20"
            />
            <span className="font-headline text-lg font-bold text-on-surface">VersionDB</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono text-[10px] uppercase">
            Account Recovery
          </span>
        </div>

        <div>
          <h1 className="font-headline text-title-lg text-on-surface">Reset your password</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Enter your work email address to request a password reset token from your organization&apos;s
            authentication server.
          </p>
        </div>

        {!isBackendConfigured && (
          <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#f59e0b]/35 font-body-sm text-xs text-[#92400e]">
            <strong>Backend Not Configured:</strong> No email delivery or authentication backend is
            connected (`VITE_API_BASE_URL` is unset). No reset email will be sent.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error"
          >
            {error}
          </div>
        )}

        {submittedOk && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-[#f0fdf4] border border-[#16a34a]/30 font-body-sm text-xs text-[#15803d]"
          >
            Password reset request accepted by the configured backend server.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="forgot-email"
              className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5"
            >
              Work Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isOperationPending}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 transition-all"
          >
            {isOperationPending ? 'Submitting Request...' : 'Request Password Reset'}
          </button>
        </form>

        <div className="pt-4 border-t border-surface-container flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className="font-medium text-secondary hover:text-on-surface flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Return to Sign In
          </button>
          <button
            type="button"
            onClick={() => navigateTo('reset-password')}
            className="font-code-sm text-[11px] text-primary hover:underline"
          >
            Have a reset token?
          </button>
        </div>
      </div>
    </div>
  );
};

export const ResetPasswordScreen: React.FC = () => {
  const { resetPasswordWithToken, isOperationPending, isBackendConfigured, navigateTo } =
    useVersionDb();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Reset token is missing or invalid.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    const res = await resetPasswordWithToken(token, newPassword);
    if (res.ok) {
      setCompleted(true);
    } else {
      setError(
        res.error ||
          'Cannot complete password reset because the authentication backend is not configured.'
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant/25 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={VERSIONDB_LOGO_URL}
              alt="VersionDB Logo"
              className="w-7 h-7 rounded-md object-cover border border-primary/20"
            />
            <span className="font-headline text-lg font-bold text-on-surface">VersionDB</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-mono text-[10px] uppercase">
            Token Verification
          </span>
        </div>

        <div>
          <h1 className="font-headline text-title-lg text-on-surface">Set a new password</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Provide a valid password reset token issued by your VersionDB authentication service.
          </p>
        </div>

        {!isBackendConfigured && (
          <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#f59e0b]/35 font-body-sm text-xs text-[#92400e]">
            <strong>Backend Not Configured:</strong> Token verification requires a live
            authentication backend (`VITE_API_BASE_URL`).
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-error-container/30 border border-error/30 font-body-sm text-xs text-error"
          >
            {error}
          </div>
        )}

        {completed && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-[#f0fdf4] border border-[#16a34a]/30 font-body-sm text-xs text-[#15803d]"
          >
            Password updated on the authentication server. You may now sign in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="reset-token"
              className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5"
            >
              Reset Token
            </label>
            <input
              id="reset-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste server-issued reset token"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest pl-3.5 pr-10 py-2.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-base">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block font-label-mono text-label-sm uppercase text-secondary mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isOperationPending}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-b from-primary to-primary-container text-on-primary font-body-sm text-body-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 transition-all"
          >
            {isOperationPending ? 'Verifying Token...' : 'Submit Password Reset'}
          </button>
        </form>

        <div className="pt-4 border-t border-surface-container flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className="font-medium text-secondary hover:text-on-surface flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Return to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
