import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useRouter } from '../lib/router';

const DEMO_ACCOUNTS = [
  {
    email: 'maya@northstar.demo',
    name: 'Maya Lin',
    roleLabel: 'Buyer & Dual-Role · Northstar Telemetry',
    summary: 'Owns open briefs, drafts, received proposals, and active workspace #1.',
  },
  {
    email: 'liam@studiofield.demo',
    name: "Liam O'Connor",
    roleLabel: 'Seller / Freelancer · Principal Designer & Engineer',
    summary: 'Has private CV, verified portfolio, shortlisted proposal, and active workspace #1.',
  },
  {
    email: 'priya@atelier.demo',
    name: 'Priya Nair',
    roleLabel: 'Seller / Freelancer · UX & Brand Strategist',
    summary: 'Non-participant in workspace #1 (ideal for verifying 403 workspace isolation).',
  },
  {
    email: 'admin@briefline.demo',
    name: 'Jordan Reid',
    roleLabel: 'Platform Admin · Trust & Moderation',
    summary: 'Full access to user/project moderation, reports, categories, and audit logs.',
  },
];

export function AuthPage() {
  const { search, navigate } = useRouter();
  const params = new URLSearchParams(search);
  const initialMode = params.get('mode') === 'register' ? 'register' : params.get('mode') === 'reset' ? 'reset' : 'login';
  const initialRole = (params.get('role') as 'buyer' | 'seller' | 'both') || 'buyer';

  const { loginWithEmail, registerWithEmail, loginWithDemo, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleChoice, setRoleChoice] = useState<'buyer' | 'seller' | 'both'>(initialRole);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devResetHint, setDevResetHint] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const acc = await loginWithEmail(email, password);
      navigate(acc.user.isAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerWithEmail({ name, email, password, roleChoice });
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async (demoEmail: string) => {
    setError(null);
    setBusy(true);
    try {
      const acc = await loginWithDemo(demoEmail);
      navigate(acc.user.isAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string; devResetToken?: string }>('/api/auth/request-reset', {
        method: 'POST',
        body: { email },
      });
      setStatusMessage(res.message);
      if (res.devResetToken) {
        setDevResetHint(res.devResetToken);
        setResetToken(res.devResetToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request password reset.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: { email, token: resetToken, newPassword },
      });
      setStatusMessage(res.message);
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Real Sign In / Register / Password Reset */}
        <div className="lg:col-span-6 bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-[#F2F4F7] rounded-lg mb-6">
            {(['login', 'register', 'reset'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setError(null);
                  setStatusMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  mode === tab ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467] hover:text-[#101828]'
                }`}
              >
                {tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Reset Password'}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
              {error}
            </div>
          )}
          {statusMessage && (
            <div className="mb-4 p-3.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-sm text-[#15803D]">
              {statusMessage}
              {devResetHint && (
                <p className="mt-1 font-mono text-xs text-[#101828]">Dev reset token: {devResetHint}</p>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to Briefline</h1>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#344054] mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-[#344054] mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-60 rounded-lg transition-colors"
              >
                {busy ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#101828]">Create your Briefline account</h1>
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-[#344054] mb-1.5">
                  Full name or display name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-[#344054] mb-1.5">
                  Work email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@studio.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-[#344054] mb-1.5">
                  Password (minimum 8 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-[#344054] mb-2">How will you use Briefline?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'buyer', label: 'Client / Buyer' },
                    { value: 'seller', label: 'Freelancer' },
                    { value: 'both', label: 'Both Roles' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRoleChoice(opt.value as 'buyer' | 'seller' | 'both')}
                      className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                        roleChoice === opt.value
                          ? 'border-[#1E40AF] bg-[#EEF2FF] text-[#1E40AF]'
                          : 'border-[#D0D5DD] text-[#344054] hover:bg-[#F8F9FB]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-60 rounded-lg transition-colors"
              >
                {busy ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-bold text-[#101828]">Reset your password</h1>
              <form onSubmit={handleRequestReset} className="space-y-3">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-[#344054] mb-1.5">
                    Account email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-sm font-semibold text-[#101828] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg"
                >
                  Request Reset Token
                </button>
              </form>

              <form onSubmit={handleCompleteReset} className="pt-4 border-t border-[#E4E7EC] space-y-3">
                <div>
                  <label htmlFor="reset-token" className="block text-sm font-medium text-[#344054] mb-1.5">
                    Reset token
                  </label>
                  <input
                    id="reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="reset-new-pw" className="block text-sm font-medium text-[#344054] mb-1.5">
                    New password (min 8 chars)
                  </label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                >
                  Update Password
                </button>
              </form>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="mt-6 pt-6 border-t border-[#E4E7EC]">
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className="w-full py-2.5 px-4 text-sm font-semibold text-[#101828] bg-white hover:bg-[#F8F9FB] border border-[#D0D5DD] rounded-lg transition-colors"
              >
                Continue with Google
              </button>
            </div>
          )}
        </div>

        {/* Right: Clearly Labeled Local Preview Demo Accounts */}
        <div className="lg:col-span-6 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#101828]">
              Preview with seeded test accounts
            </h2>
            <p className="mt-1.5 text-sm text-[#475467]">
              These accounts are clearly marked as Demo Preview data (password: <code className="font-mono text-xs text-[#101828]">DemoPass123!</code>) so you can test the complete Buyer → Seller → Private Workspace → Admin journey immediately.
            </p>
          </div>

          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((demo) => (
              <div
                key={demo.email}
                className="bg-white border border-[#E4E7EC] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#101828]">
                    {demo.name}{' '}
                    <span className="font-normal text-xs text-[#667085]">({demo.email})</span>
                  </p>
                  <p className="text-xs font-medium text-[#1E40AF] mt-0.5">{demo.roleLabel}</p>
                  <p className="text-xs text-[#475467] mt-1">{demo.summary}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemo(demo.email)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#101828] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg whitespace-nowrap shrink-0"
                >
                  Use {demo.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
