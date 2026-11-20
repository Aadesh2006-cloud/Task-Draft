import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../lib/authContext';

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  const sizeClass =
    size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-base' : 'w-10 h-10 text-sm';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-[#E4E7EC] shrink-0`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} rounded-full bg-[#EEF2FF] text-[#1E40AF] font-semibold inline-flex items-center justify-center border border-[#D0D5DD] shrink-0`}
    >
      {initials || 'U'}
    </span>
  );
}

export function StatusText({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const label = normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let color = 'text-[#475467]';
  if (['open', 'active', 'approved', 'completed', 'accepted', 'shortlisted', 'available', 'demo_released'].includes(normalized)) {
    color = 'text-[#15803D]';
  } else if (['pending', 'pending_acceptance', 'pending_review', 'submitted', 'submitted_for_review', 'in_review', 'info_requested', 'offer_sent', 'limited', 'paused', 'investigating', 'demo_authorized'].includes(normalized)) {
    color = 'text-[#B45309]';
  } else if (['revision_requested', 'declined', 'cancelled', 'disputed', 'unavailable', 'closed'].includes(normalized)) {
    color = 'text-[#B91C1C]';
  }
  return <span className={`font-medium ${color}`}>{label}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { path, navigate } = useRouter();
  const { account, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Marketplace', to: '/marketplace' },
    { label: 'Freelancers', to: '/talents' },
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Workspaces', to: '/workspaces' },
    ...(account?.user.isAdmin
      ? [{ label: 'Admin', to: '/admin' }]
      : [{ label: 'Trust & Help', to: '/trust' }]),
  ];

  const primaryCta = account
    ? account.user.isAdmin && account.user.activeRole === 'admin'
      ? { label: 'Admin Console', to: '/admin' }
      : account.user.activeRole === 'seller'
      ? { label: 'Find Projects', to: '/marketplace' }
      : { label: 'Post a Project', to: '/post-project' }
    : { label: 'Get Started', to: '/auth' };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FB] text-[#101828]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-[#101828] whitespace-nowrap shrink-0"
          >
            Briefline
          </Link>

          {/* Zone 2: 5 clean single-line text links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navLinks.map((item) => {
              const active = path === item.to || (item.to !== '/' && path.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-[#101828] border-[#1E40AF]'
                      : 'text-[#475467] border-transparent hover:text-[#101828]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action (+ mobile menu trigger on narrow viewports) */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={primaryCta.to}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {primaryCta.label}
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#E4E7EC] bg-white px-4 py-4 space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-sm font-medium text-[#344054] hover:text-[#101828]"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-[#E4E7EC] flex flex-col gap-2">
              <Link
                to={primaryCta.to}
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-4 py-2.5 text-sm font-medium text-white bg-[#1E40AF] rounded-lg"
              >
                {primaryCta.label}
              </Link>
              {account ? (
                <>
                  <Link
                    to="/onboarding"
                    onClick={() => setMobileOpen(false)}
                    className="block py-2 text-sm text-[#475467]"
                  >
                    Account &amp; Profile ({account.user.name})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout().then(() => navigate('/'));
                    }}
                    className="text-left py-2 text-sm text-[#B91C1C]"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-sm text-[#475467]"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Secondary authenticated utility strip (below header so Top Bar stays strictly 3-zone) */}
      {account && (
        <div className="bg-white border-b border-[#E4E7EC]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#475467]">
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap min-w-0">
              <span className="font-medium text-[#101828] shrink-0">
                {account.user.name}
              </span>
              <span aria-hidden="true" className="shrink-0">·</span>
              <span className="capitalize shrink-0">Mode: {account.user.activeRole}</span>
              {account.user.isDemo && (
                <>
                  <span aria-hidden="true" className="shrink-0">·</span>
                  <span className="text-[#B45309] font-medium shrink-0">
                    <span className="sm:hidden">Demo Account</span>
                    <span className="hidden sm:inline">Demo Preview Account</span>
                  </span>
                </>
              )}
              {!account.user.emailVerified && (
                <>
                  <span aria-hidden="true" className="shrink-0">·</span>
                  <Link to="/onboarding" className="text-[#1E40AF] underline shrink-0">
                    Verify email
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap shrink-0">
              <Link to="/inbox" className="hover:text-[#101828] shrink-0">
                Inbox{account.unreadNotifications > 0 ? ` (${account.unreadNotifications})` : ''}
              </Link>
              <Link to="/reviews" className="hover:text-[#101828] shrink-0">
                Reviews
              </Link>
              <Link to="/onboarding" className="hover:text-[#101828] shrink-0">
                Profile
              </Link>
              <Link to="/auth" className="hover:text-[#101828] shrink-0">
                Switch Account
              </Link>
              <button
                type="button"
                onClick={() => logout().then(() => navigate('/'))}
                className="text-[#475467] hover:text-[#B91C1C] shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-[#E4E7EC] mt-16">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
            <div className="md:col-span-2">
              <p className="font-display font-bold text-[#101828] text-base">Briefline</p>
              <p className="mt-2 text-[#475467] max-w-md leading-relaxed">
                From project brief to final delivery — post scoped work, compare independent specialists, agree on milestones, and collaborate inside a private workspace.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#101828] mb-3">Platform</p>
              <ul className="space-y-2 text-[#475467]">
                <li><Link to="/marketplace" className="hover:text-[#101828]">Browse Projects</Link></li>
                <li><Link to="/talents" className="hover:text-[#101828]">Freelancer Directory</Link></li>
                <li><Link to="/post-project" className="hover:text-[#101828]">Post a Project</Link></li>
                <li><Link to="/dashboard" className="hover:text-[#101828]">Dashboards</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[#101828] mb-3">Trust &amp; Policies</p>
              <ul className="space-y-2 text-[#475467]">
                <li><Link to="/trust" className="hover:text-[#101828]">Trust &amp; Safety</Link></li>
                <li><Link to="/trust?tab=terms" className="hover:text-[#101828]">Terms of Service</Link></li>
                <li><Link to="/trust?tab=privacy" className="hover:text-[#101828]">Privacy &amp; File Access</Link></li>
                <li><Link to="/trust?tab=contact" className="hover:text-[#101828]">Contact &amp; Disputes</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-[#E4E7EC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#667085]">
            <p>© {new Date().getFullYear()} Briefline. Independent project marketplace &amp; delivery workspace.</p>
            <p>Payments run in development demo mode until a compliant provider is configured.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
