import React, { useState } from 'react';
import { VersionDbLogo } from '../components/common/VersionDbLogo';
import { useVersionDb } from '../context/VersionDbContext';

export const LoginScreen: React.FC = () => {
  const {
    signInWithBackend,
    registerWithBackend,
    isOperationPending,
    navigateTo,
  } = useVersionDb();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (authMode === 'register') {
      const trimmedUser = username.trim();
      if (!trimmedUser || trimmedUser.length < 3 || trimmedUser.length > 32) {
        setErrorMessage('Username must be between 3 and 32 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUser)) {
        setErrorMessage('Username may only contain letters, digits, "_", ".", or "-".');
        return;
      }
      if (password.length < 10) {
        setErrorMessage('Password must be at least 10 characters long.');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setErrorMessage('Password must contain at least one letter and one digit.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Password confirmation does not match.');
        return;
      }

      const result = await registerWithBackend(trimmedEmail, trimmedUser, password);
      if (!result.ok) {
        // If the error message starts with "Account created." it means registration
        // succeeded but auto-login failed — show it inline without an extra toast
        // (signInWithBackend already pushed a toast for this case).
        setErrorMessage(
          result.error ||
            'Registration failed. The VersionDB authentication backend is not configured or unreachable.'
        );
      }
      // On success (result.ok === true), the context already navigated to #/overview.
      // The component will unmount when authState.isAuthenticated becomes true.
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/30 text-on-surface flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Subtle background decorative blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-200/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-purple-200/25 blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-xl shadow-indigo-950/[0.04] border border-slate-100 p-6 sm:p-8 relative z-10">
        {/* Compact Logo & Brand Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="flex items-center gap-3 mb-2">
            <VersionDbLogo size={36} className="bg-slate-900 shadow-sm" />
            <span className="font-headline text-2xl font-bold tracking-tight text-slate-900">
              VersionDB
            </span>
          </div>
          <p className="font-body-sm text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
            Git-style version control, copy-on-write branching, and RBAC governance for relational databases.
          </p>
        </div>

        {/* Tab switcher: Sign In / Register */}
        <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl mb-4 border border-slate-200/60">
          <button
            type="button"
            id="auth-tab-signin"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg font-body-sm text-xs sm:text-sm font-semibold transition-all ${
              authMode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-register"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg font-body-sm text-xs sm:text-sm font-semibold transition-all ${
              authMode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Register
          </button>
        </div>

        {/* Title shown only for login mode */}
        {authMode === 'login' && (
          <div className="mb-4">
            <h2 className="font-headline text-lg sm:text-xl font-bold text-slate-900">
              Welcome back
            </h2>
            <p className="font-body-sm text-xs text-slate-500 mt-1">
              Enter your credentials to access your database workspaces.
            </p>
          </div>
        )}

        {/* Inline Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 p-3 rounded-xl bg-red-50/90 border border-red-200 flex items-start gap-2.5 text-red-700"
          >
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0 text-red-600">
              error
            </span>
            <span className="font-body-sm text-xs leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="block font-body-sm text-xs font-semibold text-slate-700 mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-code-sm text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all"
            />
          </div>

          {authMode === 'register' && (
            <div>
              <label
                htmlFor="register-username"
                className="block font-body-sm text-xs font-semibold text-slate-700 mb-1.5"
              >
                Display Username
              </label>
              <input
                id="register-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dev_jane"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-code-sm text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block font-body-sm text-xs font-semibold text-slate-700"
              >
                Password
                {authMode === 'register' && (
                  <span className="text-slate-400 font-normal ml-1">
                    (min 10 chars, letter + digit)
                  </span>
                )}
              </label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => navigateTo('forgot-password')}
                  className="font-body-sm text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-10 py-2 font-code-sm text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-base">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <div>
              <label
                htmlFor="register-confirm-password"
                className="block font-body-sm text-xs font-semibold text-slate-700 mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-code-sm text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary focus:bg-white transition-all"
              />
            </div>
          )}

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={isOperationPending}
            className="w-full py-2 px-4 mt-1 rounded-xl bg-slate-900 text-white font-body-sm text-xs sm:text-sm font-semibold hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isOperationPending ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">
                  progress_activity
                </span>
                <span>{authMode === 'register' ? 'Creating account…' : 'Signing in…'}</span>
              </>
            ) : (
              <span>{authMode === 'register' ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Footer switcher note */}
        <p className="mt-4 text-center font-body-sm text-xs text-slate-500">
          {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setErrorMessage(null);
            }}
            className="text-primary font-semibold hover:underline"
          >
            {authMode === 'login' ? 'Create one →' : 'Sign in →'}
          </button>
        </p>
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
          <div className="flex items-center gap-2.5">
            <VersionDbLogo size={28} />
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
          <div className="flex items-center gap-2.5">
            <VersionDbLogo size={28} />
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
