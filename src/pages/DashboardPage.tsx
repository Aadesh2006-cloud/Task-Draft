import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';
import { StatusText } from '../components/Layout';
import { formatCurrency } from '../utils/domain';

interface DashboardData {
  buyer: {
    projects: Array<{
      id: number;
      title: string;
      status: string;
      categoryName: string;
      budgetMin: number;
      budgetMax: number;
      currency: string;
      deadline: string;
      proposalCount: number;
      shortlistedCount: number;
    }>;
    recentApplications: Array<{
      id: number;
      projectId: number;
      status: string;
      proposedPrice: number;
      currency: string;
      sellerName: string;
    }>;
    workspaces: Array<{
      id: number;
      projectTitle: string;
      status: string;
      agreedPrice: number;
      currency: string;
      deadline: string;
      seller: { id: number; name: string } | null;
      needsMyReview: boolean;
    }>;
    pendingContracts: Array<{ contract: { id: number; agreedPrice: number; currency: string }; projectTitle: string }>;
  };
  seller: {
    proposals: Array<{
      id: number;
      projectId: number;
      projectTitle: string;
      buyerName: string;
      proposedPrice: number;
      currency: string;
      status: string;
      infoRequestNote: string | null;
    }>;
    savedProjects: Array<{
      id: number;
      title: string;
      categoryName: string;
      budgetMin: number;
      budgetMax: number;
      currency: string;
      deadline: string;
    }>;
    recommendedProjects: Array<{
      id: number;
      title: string;
      categoryName: string;
      buyerName: string;
      budgetMin: number;
      budgetMax: number;
      currency: string;
      deadline: string;
    }>;
    workspaces: Array<{
      id: number;
      projectTitle: string;
      status: string;
      agreedPrice: number;
      currency: string;
      deadline: string;
      buyer: { id: number; name: string } | null;
      needsMyReview: boolean;
    }>;
    pendingContracts: Array<{ contract: { id: number; agreedPrice: number; currency: string }; projectTitle: string }>;
  };
}

export function DashboardPage() {
  const { account, switchRole } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, [account]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to view your dashboard</h1>
        <p className="mt-2 text-sm text-[#475467]">Track briefs, proposals, pending offers, private workspaces, and reviews.</p>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In or Try Demo Accounts
        </Link>
      </div>
    );
  }

  const activeView: 'buyer' | 'seller' =
    account.user.activeRole === 'seller' && account.user.canSell ? 'seller' : account.user.canBuy ? 'buyer' : 'seller';

  const completion = activeView === 'buyer' ? account.buyerCompletion : account.sellerCompletion;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header + Dual-Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E4E7EC]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">
            {activeView === 'buyer' ? 'Client Dashboard' : 'Freelancer Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-[#475467]">
            Welcome back, {account.user.name}.
            {account.user.isDemo ? ' You are previewing a seeded demo account.' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {account.user.canBuy && account.user.canSell && (
            <div className="inline-flex p-1 bg-[#F2F4F7] rounded-lg gap-1" role="group" aria-label="Role view switch">
              <button
                type="button"
                onClick={() => switchRole({ activeRole: 'buyer' })}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeView === 'buyer' ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467]'
                }`}
              >
                Buyer View
              </button>
              <button
                type="button"
                onClick={() => switchRole({ activeRole: 'seller' })}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeView === 'seller' ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467]'
                }`}
              >
                Seller View
              </button>
            </div>
          )}

          {activeView === 'buyer' ? (
            <Link
              to="/post-project"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
            >
              Post New Project
            </Link>
          ) : (
            <Link
              to="/marketplace"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
            >
              Browse Open Projects
            </Link>
          )}
        </div>
      </div>

      {/* Non-blocking Profile Completion Banner */}
      {completion.percent < 100 && (
        <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-[#101828]">
              Profile completion: <span className="font-mono tabular-nums">{completion.percent}%</span>
            </span>
            <span className="text-[#475467] ml-2">
              Missing: {completion.missing.slice(0, 3).join(', ')}
            </span>
          </div>
          <Link to="/onboarding" className="text-xs font-semibold text-[#1E40AF] hover:underline whitespace-nowrap">
            Complete Profile →
          </Link>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activeView === 'buyer' ? (
        <div className="space-y-8">
          {/* Buyer KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Open Briefs</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.buyer.projects.filter((p) => p.status === 'open').length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Drafts</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.buyer.projects.filter((p) => p.status === 'draft').length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Applications Received</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.buyer.recentApplications.length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Active Workspaces</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.buyer.workspaces.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').length}
              </p>
            </div>
          </div>

          {/* Pending Offers awaiting Seller acceptance */}
          {data.buyer.pendingContracts.length > 0 && (
            <section className="bg-white border border-[#FCD34D] rounded-xl p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#101828]">Pending Project Offers</h2>
              {data.buyer.pendingContracts.map((item) => (
                <div key={item.contract.id} className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <strong>{item.projectTitle}</strong> ·{' '}
                    <span className="font-mono">{formatCurrency(item.contract.agreedPrice, item.contract.currency)}</span>
                  </span>
                  <Link to={`/contracts/${item.contract.id}`} className="text-xs font-semibold text-[#1E40AF] hover:underline">
                    View Agreement →
                  </Link>
                </div>
              ))}
            </section>
          )}

          {/* Active & Completed Workspaces */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#101828]">Private Project Workspaces</h2>
              <Link to="/workspaces" className="text-xs font-semibold text-[#1E40AF] hover:underline">
                View All
              </Link>
            </div>
            {data.buyer.workspaces.length === 0 ? (
              <p className="text-sm text-[#667085]">Hire a freelancer on one of your briefs to spin up a private workspace.</p>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {data.buyer.workspaces.map((ws) => (
                  <div key={ws.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-[#101828]">{ws.projectTitle}</p>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Freelancer: {ws.seller?.name || 'Assigned'} · <StatusText status={ws.status} /> · Due{' '}
                        <span className="font-mono">{ws.deadline || 'TBD'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono tabular-nums text-sm font-semibold text-[#101828]">
                        {formatCurrency(ws.agreedPrice, ws.currency)}
                      </span>
                      <Link
                        to={`/workspace/${ws.id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg whitespace-nowrap"
                      >
                        {ws.needsMyReview ? 'Leave Review' : 'Open Room'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Buyer Projects Table (Open, Drafts, Paused, Hired, Closed) */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Your Project Briefs &amp; Drafts</h2>
            {data.buyer.projects.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[#475467]">You have not posted any briefs yet.</p>
                <Link to="/post-project" className="mt-3 inline-block px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg">
                  Create Your First Project Brief
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] text-xs text-[#667085]">
                      <th className="py-2.5 pr-4 font-semibold">Project</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Budget</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Proposals</th>
                      <th className="py-2.5 pl-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {data.buyer.projects.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4">
                          <Link to={`/projects/${p.id}`} className="font-semibold text-[#101828] hover:text-[#1E40AF]">
                            {p.title}
                          </Link>
                          <p className="text-xs text-[#667085]">{p.categoryName} · Due {p.deadline || 'TBD'}</p>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <StatusText status={p.status} />
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-[#101828]">
                          {formatCurrency(p.budgetMin, p.currency)}–{formatCurrency(p.budgetMax, p.currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-[#344054]">
                          {p.proposalCount} ({p.shortlistedCount} shortlisted)
                        </td>
                        <td className="py-3 pl-3 text-right text-xs whitespace-nowrap space-x-3">
                          {p.status === 'draft' ? (
                            <Link to={`/post-project?edit=${p.id}`} className="font-semibold text-[#1E40AF] hover:underline">
                              Continue Draft
                            </Link>
                          ) : (
                            <Link
                              to={`/projects/${p.id}/applications`}
                              className="font-semibold text-[#1E40AF] hover:underline"
                            >
                              Applications
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Seller KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Submitted Proposals</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.seller.proposals.length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Active Workspaces</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.seller.workspaces.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Saved Briefs</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {data.seller.savedProjects.length}
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
              <p className="text-xs text-[#667085]">Pending Offers</p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#1E40AF]">
                {data.seller.pendingContracts.length}
              </p>
            </div>
          </div>

          {/* Pending Offers requiring Seller Sign-Off */}
          {data.seller.pendingContracts.length > 0 && (
            <section className="bg-white border border-[#1E40AF] rounded-xl p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#101828]">Action Required: Pending Hiring Offers</h2>
              {data.seller.pendingContracts.map((item) => (
                <div key={item.contract.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <span>
                    <strong>{item.projectTitle}</strong> ·{' '}
                    <span className="font-mono">{formatCurrency(item.contract.agreedPrice, item.contract.currency)}</span>
                  </span>
                  <Link
                    to={`/contracts/${item.contract.id}`}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg whitespace-nowrap"
                  >
                    Review &amp; Accept Terms
                  </Link>
                </div>
              ))}
            </section>
          )}

          {/* Seller Active Workspaces */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Your Private Workspaces</h2>
            {data.seller.workspaces.length === 0 ? (
              <p className="text-sm text-[#667085]">Once a client selects your proposal and both sides accept terms, your workspace appears here.</p>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {data.seller.workspaces.map((ws) => (
                  <div key={ws.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-[#101828]">{ws.projectTitle}</p>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Client: {ws.buyer?.name || 'Client'} · <StatusText status={ws.status} /> · Due{' '}
                        <span className="font-mono">{ws.deadline || 'TBD'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono tabular-nums text-sm font-semibold text-[#101828]">
                        {formatCurrency(ws.agreedPrice, ws.currency)}
                      </span>
                      <Link
                        to={`/workspace/${ws.id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg"
                      >
                        {ws.needsMyReview ? 'Leave Review' : 'Open Room'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Submitted Proposals */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Submitted Proposals</h2>
            {data.seller.proposals.length === 0 ? (
              <p className="text-sm text-[#667085]">You haven&apos;t submitted any proposals yet.</p>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {data.seller.proposals.map((prop) => (
                  <div key={prop.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <Link to={`/projects/${prop.projectId}`} className="font-semibold text-[#101828] hover:text-[#1E40AF]">
                        {prop.projectTitle}
                      </Link>
                      <p className="text-xs text-[#667085]">
                        Client: {prop.buyerName} · Bid <span className="font-mono">{formatCurrency(prop.proposedPrice, prop.currency)}</span>
                      </p>
                      {prop.infoRequestNote && (
                        <p className="text-xs text-[#B45309] mt-1">Client request: {prop.infoRequestNote}</p>
                      )}
                    </div>
                    <span className="text-xs">
                      <StatusText status={prop.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Saved & Recommended Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#101828]">Saved Projects</h2>
              {data.seller.savedProjects.length === 0 ? (
                <p className="text-xs text-[#667085]">Bookmark briefs in the marketplace to shortlist work for later.</p>
              ) : (
                data.seller.savedProjects.map((p) => (
                  <div key={p.id} className="py-2 border-b border-[#F2F4F7] last:border-b-0 flex items-center justify-between gap-2">
                    <Link to={`/projects/${p.id}`} className="text-sm font-medium text-[#101828] hover:text-[#1E40AF] truncate">
                      {p.title}
                    </Link>
                    <span className="font-mono text-xs text-[#475467] shrink-0">
                      {formatCurrency(p.budgetMin, p.currency)}–{formatCurrency(p.budgetMax, p.currency)}
                    </span>
                  </div>
                ))
              )}
            </section>

            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#101828]">Recommended Open Projects</h2>
              {data.seller.recommendedProjects.map((p) => (
                <div key={p.id} className="py-2 border-b border-[#F2F4F7] last:border-b-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/projects/${p.id}`} className="text-sm font-medium text-[#101828] hover:text-[#1E40AF] block truncate">
                      {p.title}
                    </Link>
                    <p className="text-xs text-[#667085]">{p.categoryName} · Due {p.deadline || 'TBD'}</p>
                  </div>
                  <span className="font-mono text-xs text-[#101828] shrink-0">
                    {formatCurrency(p.budgetMax, p.currency)}
                  </span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
