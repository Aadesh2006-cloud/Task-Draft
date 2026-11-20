import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Plus, RefreshCw } from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';
import { StatusText } from '../components/Layout';
import { formatCurrency } from '../utils/domain';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  canBuy: boolean;
  canSell: boolean;
  activeRole: string;
  isAdmin: boolean;
  emailVerified: boolean;
  isRestricted: boolean;
  restrictionReason: string | null;
  isDemo: boolean;
  createdAt: string;
}

interface AdminProjectRow {
  id: number;
  title: string;
  status: string;
  budgetMin: number;
  budgetMax: number | null;
  currency: string;
  visibility: string;
  isDemo: boolean;
  buyerName: string;
  createdAt: string;
}

interface AdminReportRow {
  id: number;
  reporterId: number;
  reporterName: string;
  targetType: string;
  targetId: number;
  reason: string;
  details: string;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
}

interface AdminCategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  subcategories: string[] | null;
  suggestedSkills: string[] | null;
}

interface AdminAuditRow {
  id: number;
  adminName: string;
  action: string;
  targetType: string;
  targetId: number | null;
  details: string;
  createdAt: string;
}

interface AdminOverviewData {
  metrics: {
    totalUsers: number;
    totalProjects: number;
    openProjects: number;
    totalApplications: number;
    totalHires: number;
    completionRate: number;
    openReports: number;
  };
  users: AdminUserRow[];
  projects: AdminProjectRow[];
  reports: AdminReportRow[];
  categories: AdminCategoryRow[];
  auditLogs: AdminAuditRow[];
}

type AdminTab = 'overview' | 'users' | 'projects' | 'reports' | 'categories';

export function AdminPage() {
  const { account, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');

  // Resolution notes keyed by report id
  const [resolutionNotes, setResolutionNotes] = useState<Record<number, string>>({});

  // New category form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSubs, setCatSubs] = useState('');
  const [catSkills, setCatSkills] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && account?.user.isAdmin) {
      fetchOverview();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, account?.user.isAdmin, fetchOverview]);

  async function toggleUserRestriction(user: AdminUserRow) {
    setActionMsg(null);
    setError(null);
    const nextRestricted = !user.isRestricted;
    try {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: {
          isRestricted: nextRestricted,
          restrictionReason: nextRestricted ? 'Restricted by administrator pending compliance review.' : null,
        },
      });
      setActionMsg(`${user.name} ${nextRestricted ? 'restricted' : 'reinstated'}.`);
      await fetchOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user status.');
    }
  }

  async function moderateProject(projectId: number, status: 'open' | 'paused' | 'closed' | 'cancelled') {
    setActionMsg(null);
    setError(null);
    try {
      await apiRequest(`/api/admin/projects/${projectId}`, {
        method: 'PATCH',
        body: { status },
      });
      setActionMsg(`Project #${projectId} status updated to ${status}.`);
      await fetchOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to moderate project.');
    }
  }

  async function updateReport(report: AdminReportRow, status: 'investigating' | 'resolved' | 'dismissed', hideReview = false) {
    setActionMsg(null);
    setError(null);
    try {
      await apiRequest(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        body: {
          status,
          resolutionNote: resolutionNotes[report.id] || `Marked ${status} by administrator.`,
          hideReview,
        },
      });
      setActionMsg(`Report #${report.id} marked ${status}.`);
      await fetchOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update report.');
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setActionMsg(null);
    setError(null);
    setCreatingCat(true);
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: {
          name: catName.trim(),
          description: catDesc.trim(),
          subcategories: catSubs
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          suggestedSkills: catSkills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setCatName('');
      setCatDesc('');
      setCatSubs('');
      setCatSkills('');
      setActionMsg('Category created and recorded in audit log.');
      await fetchOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category.');
    } finally {
      setCreatingCat(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-8 w-56 bg-[#E4E7EC] rounded animate-pulse" />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-8 h-8 text-[#B45309] mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold text-[#101828]">Admin Sign-In Required</h1>
        <p className="mt-2 text-sm text-[#475467]">
          Sign in with an authorized administrator account to access platform governance controls.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (!account.user.isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-8 h-8 text-[#B91C1C] mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold text-[#101828]">Administrator Access Only</h1>
        <p className="mt-2 text-sm text-[#475467]">
          Your account ({account.user.email}) does not have administrator permissions. All admin endpoints reject unauthorized requests with HTTP 403.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#101828]">
            Admin Governance Console
          </h1>
          <p className="mt-1 text-sm text-[#475467]">
            Manage platform accounts, moderate projects, adjudicate reports, configure categories, and review audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#344054] bg-white border border-[#D0D5DD] hover:bg-[#F9FAFB] rounded-lg self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#15803D]">
          {actionMsg}
        </div>
      )}

      {/* Metrics Strip — flat crisp 1px white cards, tabular numerals */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Users</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101828] tabular-nums">
              {data.metrics.totalUsers}
            </p>
            <p className="mt-1 text-xs text-[#475467] tabular-nums">
              {data.metrics.totalApplications} proposals submitted
            </p>
          </div>
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Projects</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101828] tabular-nums">
              {data.metrics.totalProjects}
            </p>
            <p className="mt-1 text-xs text-[#475467] tabular-nums">
              {data.metrics.openProjects} currently open
            </p>
          </div>
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Hires &amp; Completion</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101828] tabular-nums">
              {data.metrics.totalHires}
            </p>
            <p className="mt-1 text-xs text-[#475467] tabular-nums">
              {data.metrics.completionRate}% workspace completion rate
            </p>
          </div>
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
            <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Open Reports</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#101828] tabular-nums">
              {data.metrics.openReports}
            </p>
            <p className="mt-1 text-xs text-[#475467] tabular-nums">
              {data.reports.length} total records
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E4E7EC] flex flex-wrap gap-6 text-sm font-medium">
        {(
          [
            { id: 'overview', label: 'Audit Log' },
            { id: 'users', label: `Users (${data?.users.length ?? 0})` },
            { id: 'projects', label: `Projects (${data?.projects.length ?? 0})` },
            { id: 'reports', label: `Reports & Disputes (${data?.reports.length ?? 0})` },
            { id: 'categories', label: `Categories (${data?.categories.length ?? 0})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'border-[#1E40AF] text-[#101828]'
                : 'border-transparent text-[#475467] hover:text-[#101828]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Audit Log */}
      {data && tab === 'overview' && (
        <section className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EC]">
            <h2 className="font-display text-base font-semibold text-[#101828]">Recent Administrative Audit Trail</h2>
          </div>
          {data.auditLogs.length === 0 ? (
            <p className="p-6 text-sm text-[#667085]">No administrative events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8F9FB] text-xs font-medium text-[#667085] border-b border-[#E4E7EC]">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Admin</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {data.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-3.5 text-xs font-mono text-[#667085] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#101828] whitespace-nowrap">
                        {log.adminName}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-[#344054] whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-6 py-3.5 text-[#475467]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Users */}
      {data && tab === 'users' && (
        <section className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F9FB] text-xs font-medium text-[#667085] border-b border-[#E4E7EC]">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Capabilities</th>
                  <th className="px-6 py-3">Account Status</th>
                  <th className="px-6 py-3 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {data.users.map((u) => {
                  const roles = [
                    u.canBuy ? 'Buyer' : null,
                    u.canSell ? 'Seller' : null,
                    u.isAdmin ? 'Admin' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <tr key={u.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#101828]">
                          {u.name}
                          {u.isDemo && <span className="ml-2 text-xs font-normal text-[#B45309]">Demo</span>}
                        </p>
                        <p className="text-xs text-[#667085]">{u.email}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#475467]">
                        {roles || 'Standard'} · Active: <span className="capitalize">{u.activeRole}</span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {u.isRestricted ? (
                          <span className="font-medium text-[#B91C1C]">Restricted</span>
                        ) : (
                          <span className="font-medium text-[#15803D]">Active</span>
                        )}
                        <span className="mx-1.5 text-[#D0D5DD]">·</span>
                        <span className="text-[#667085]">{u.emailVerified ? 'Verified' : 'Unverified'}</span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {u.id !== account.user.id ? (
                          <button
                            type="button"
                            onClick={() => toggleUserRestriction(u)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              u.isRestricted
                                ? 'border-[#D0D5DD] text-[#15803D] hover:bg-[#F0FDF4]'
                                : 'border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                            }`}
                          >
                            {u.isRestricted ? 'Reinstate' : 'Restrict Account'}
                          </button>
                        ) : (
                          <span className="text-xs text-[#667085]">Current session</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 3: Projects */}
      {data && tab === 'projects' && (
        <section className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F9FB] text-xs font-medium text-[#667085] border-b border-[#E4E7EC]">
                <tr>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Budget</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {data.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4">
                      <Link to={`/projects/${p.id}`} className="font-medium text-[#101828] hover:text-[#1E40AF]">
                        {p.title}
                      </Link>
                      <p className="text-xs text-[#667085] capitalize">
                        #{p.id} · {p.visibility}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-[#475467]">{p.buyerName}</td>
                    <td className="px-6 py-4 text-[#344054] tabular-nums whitespace-nowrap">
                      {formatCurrency(p.budgetMin, p.currency)}
                      {p.budgetMax ? `–${formatCurrency(p.budgetMax, p.currency)}` : ''}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <StatusText status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                      {p.status !== 'open' && (
                        <button
                          type="button"
                          onClick={() => moderateProject(p.id, 'open')}
                          className="px-2.5 py-1 text-xs font-medium text-[#15803D] border border-[#BBF7D0] rounded hover:bg-[#F0FDF4]"
                        >
                          Open
                        </button>
                      )}
                      {p.status !== 'paused' && (
                        <button
                          type="button"
                          onClick={() => moderateProject(p.id, 'paused')}
                          className="px-2.5 py-1 text-xs font-medium text-[#B45309] border border-[#FDE68A] rounded hover:bg-[#FFFBEB]"
                        >
                          Pause
                        </button>
                      )}
                      {p.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => moderateProject(p.id, 'closed')}
                          className="px-2.5 py-1 text-xs font-medium text-[#B91C1C] border border-[#FECACA] rounded hover:bg-[#FEF2F2]"
                        >
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 4: Reports & Disputes */}
      {data && tab === 'reports' && (
        <section className="space-y-4">
          {data.reports.length === 0 ? (
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-8 text-sm text-[#667085]">
              No reports or disputes in the queue.
            </div>
          ) : (
            data.reports.map((r) => (
              <div key={r.id} className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#667085]">
                      Report #{r.id} · Target: <span className="font-mono text-[#344054]">{r.targetType} #{r.targetId}</span> · Reporter: {r.reporterName}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-[#101828]">
                      {r.reason}
                    </h3>
                  </div>
                  <div className="text-xs">
                    <StatusText status={r.status} />
                  </div>
                </div>
                <p className="text-sm text-[#475467] leading-relaxed">{r.details}</p>
                {r.resolutionNote && (
                  <p className="text-xs text-[#344054] bg-[#F8F9FB] border border-[#E4E7EC] rounded-lg px-3.5 py-2">
                    Resolution note: {r.resolutionNote}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#E4E7EC]">
                  <input
                    type="text"
                    placeholder="Add moderation resolution note..."
                    value={resolutionNotes[r.id] ?? ''}
                    onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateReport(r, 'investigating')}
                      className="px-3 py-2 text-xs font-medium text-[#B45309] border border-[#FDE68A] rounded-lg hover:bg-[#FFFBEB]"
                    >
                      Investigating
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReport(r, 'resolved', r.targetType === 'review')}
                      className="px-3 py-2 text-xs font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                    >
                      {r.targetType === 'review' ? 'Resolve & Hide Review' : 'Resolve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReport(r, 'dismissed')}
                      className="px-3 py-2 text-xs font-medium text-[#475467] border border-[#D0D5DD] rounded-lg hover:bg-[#F9FAFB]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Tab 5: Categories */}
      {data && tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#E4E7EC] rounded-xl divide-y divide-[#E4E7EC]">
            {data.categories.map((cat) => (
              <div key={cat.id} className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-[#101828]">{cat.name}</h3>
                  <span className="font-mono text-xs text-[#667085]">{cat.slug}</span>
                </div>
                {cat.description && <p className="mt-1 text-xs text-[#475467]">{cat.description}</p>}
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <p className="mt-2 text-xs text-[#667085]">
                    Subcategories: {cat.subcategories.join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateCategory}
            className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4 self-start"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#1E40AF]" />
              <h2 className="font-display text-base font-semibold text-[#101828]">Add Category</h2>
            </div>
            <div>
              <label htmlFor="cat-name" className="block text-xs font-medium text-[#344054] mb-1">
                Name
              </label>
              <input
                id="cat-name"
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g., Security & Compliance"
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="cat-desc" className="block text-xs font-medium text-[#344054] mb-1">
                Description
              </label>
              <input
                id="cat-desc"
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Short scope summary"
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="cat-subs" className="block text-xs font-medium text-[#344054] mb-1">
                Subcategories (comma-separated)
              </label>
              <input
                id="cat-subs"
                type="text"
                value={catSubs}
                onChange={(e) => setCatSubs(e.target.value)}
                placeholder="SOC 2 Readiness, AppSec Audits"
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="cat-skills" className="block text-xs font-medium text-[#344054] mb-1">
                Suggested Skills (comma-separated)
              </label>
              <input
                id="cat-skills"
                type="text"
                value={catSkills}
                onChange={(e) => setCatSkills(e.target.value)}
                placeholder="OWASP, Threat Modeling, IAM"
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={creatingCat}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 rounded-lg"
            >
              {creatingCat ? 'Creating...' : 'Create Category'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
