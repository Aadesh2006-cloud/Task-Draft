import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';
import { formatCurrency } from '../utils/domain';

interface Category {
  id: number;
  name: string;
  openProjectsCount: number;
}

interface MarketProject {
  id: number;
  title: string;
  brief: string;
  categoryName: string;
  subcategory: string;
  buyerOrganization: string;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  currency: string;
  deadline: string;
  proposalDeadline: string;
  experienceLevel: string;
  workMode: string;
  location: string;
  requiredSkills: string[];
  sampleRequested: boolean;
  samplePaid: boolean;
  proposalCount: number;
  isSaved: boolean;
  isDemo: boolean;
  createdAt: string;
}

export function MarketplacePage() {
  const { search } = useRouter();
  const { account } = useAuth();
  const urlParams = new URLSearchParams(search);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MarketProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(urlParams.get('q') || '');
  const [categoryId, setCategoryId] = useState(urlParams.get('categoryId') || '');
  const [skill, setSkill] = useState('');
  const [budgetType, setBudgetType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [sort, setSort] = useState('newest');
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => {
    apiRequest<Category[]>('/api/categories').then(setCategories).catch(() => {});
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (categoryId) params.set('categoryId', categoryId);
      if (skill.trim()) params.set('skill', skill.trim());
      if (budgetType) params.set('budgetType', budgetType);
      if (experienceLevel) params.set('experienceLevel', experienceLevel);
      if (workMode) params.set('workMode', workMode);
      if (savedOnly && account) params.set('saved', 'true');
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '12');

      const data = await apiRequest<{ items: MarketProject[]; total: number; totalPages: number }>(
        `/api/projects?${params.toString()}`
      );
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace projects.');
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, skill, budgetType, experienceLevel, workMode, sort, page, savedOnly, account]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const toggleSave = async (projectId: number) => {
    if (!account) return;
    try {
      const res = await apiRequest<{ saved: boolean }>(`/api/projects/${projectId}/save`, { method: 'POST' });
      setItems((prev) => prev.map((p) => (p.id === projectId ? { ...p, isSaved: res.saved } : p)));
    } catch {
      // ignore
    }
  };

  const resetFilters = () => {
    setQ('');
    setCategoryId('');
    setSkill('');
    setBudgetType('');
    setExperienceLevel('');
    setWorkMode('');
    setSort('newest');
    setSavedOnly(false);
    setPage(1);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E4E7EC]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">Project Marketplace</h1>
          <p className="mt-1 text-sm text-[#475467]">
            Discover scoped client briefs with clear deliverables, deadlines, and transparent sample-task policies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {account && (
            <button
              type="button"
              onClick={() => {
                setSavedOnly((v) => !v);
                setPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                savedOnly
                  ? 'bg-[#101828] text-white border-[#101828]'
                  : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F8F9FB]'
              }`}
            >
              {savedOnly ? 'Showing Saved Projects' : 'Saved Projects'}
            </button>
          )}
          <Link
            to="/post-project"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
          >
            Post a Project
          </Link>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-6 bg-white border border-[#E4E7EC] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              aria-label="Search projects"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search titles, briefs, skills, or organizations..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
            />
          </div>
          <div className="md:col-span-3">
            <select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.openProjectsCount})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              aria-label="Filter by skill"
              value={skill}
              onChange={(e) => {
                setSkill(e.target.value);
                setPage(1);
              }}
              placeholder="Skill (e.g. Figma)"
              className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <select
              aria-label="Sort projects"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg bg-white"
            >
              <option value="newest">Sort: Newest</option>
              <option value="budget_desc">Budget: High to Low</option>
              <option value="budget_asc">Budget: Low to High</option>
              <option value="deadline">Earliest Deadline</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#F2F4F7]">
          <select
            aria-label="Budget type"
            value={budgetType}
            onChange={(e) => {
              setBudgetType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-lg bg-white"
          >
            <option value="">Any pricing model</option>
            <option value="fixed">Fixed Price</option>
            <option value="hourly">Hourly Rate</option>
          </select>

          <select
            aria-label="Experience level"
            value={experienceLevel}
            onChange={(e) => {
              setExperienceLevel(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-lg bg-white"
          >
            <option value="">Any experience level</option>
            <option value="entry">Entry</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>

          <select
            aria-label="Work mode"
            value={workMode}
            onChange={(e) => {
              setWorkMode(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-[#D0D5DD] rounded-lg bg-white"
          >
            <option value="">Remote / Hybrid / On-site</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>

          <span className="ml-auto text-xs text-[#667085] font-mono tabular-nums">
            {total} {total === 1 ? 'project' : 'projects'}
          </span>

          {(q || categoryId || skill || budgetType || experienceLevel || workMode || savedOnly) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#1E40AF] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {error && (
        <div role="alert" className="mt-6 p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-36 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 bg-white border border-[#E4E7EC] rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-[#101828]">No matching projects found</h2>
          <p className="mt-1 text-sm text-[#475467]">
            Try widening your filters or clearing the search query.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((proj) => (
            <article
              key={proj.id}
              className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#98A2B3] transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                    <span className="font-medium text-[#344054]">{proj.categoryName}</span>
                    {proj.subcategory && (
                      <>
                        <span aria-hidden="true">/</span>
                        <span>{proj.subcategory}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{proj.experienceLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{proj.workMode}</span>
                    <span aria-hidden="true">·</span>
                    <span>By {proj.buyerOrganization}</span>
                    {proj.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#B45309] font-medium">Demo Brief</span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-2 font-display text-lg font-semibold text-[#101828]">
                    <Link to={`/projects/${proj.id}`} className="hover:text-[#1E40AF]">
                      {proj.title}
                    </Link>
                  </h2>

                  <p className="mt-2 text-sm text-[#475467] leading-relaxed line-clamp-2">{proj.brief}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475467]">
                    <span className="text-[#667085]">Skills:</span>
                    <span>{proj.requiredSkills.length > 0 ? proj.requiredSkills.join(' · ') : 'Open'}</span>
                  </div>

                  {proj.sampleRequested && (
                    <p className="mt-2 text-xs text-[#475467]">
                      Sample task disclosure:{' '}
                      <strong className={proj.samplePaid ? 'text-[#15803D]' : 'text-[#B45309]'}>
                        {proj.samplePaid ? 'Paid sample exercise' : 'Unpaid sample requested'}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="lg:w-56 shrink-0 flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-[#F2F4F7]">
                  <div className="lg:text-right">
                    <p className="font-mono tabular-nums text-base font-semibold text-[#101828]">
                      {formatCurrency(proj.budgetMin, proj.currency)}–{formatCurrency(proj.budgetMax, proj.currency)}
                    </p>
                    <p className="text-xs text-[#667085]">
                      {proj.budgetType === 'hourly' ? 'Hourly rate' : 'Fixed price'} · Due {proj.deadline || 'TBD'}
                    </p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      {proj.proposalCount} {proj.proposalCount === 1 ? 'proposal' : 'proposals'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {account && (
                      <button
                        type="button"
                        aria-label={proj.isSaved ? `Unsave ${proj.title}` : `Save ${proj.title}`}
                        onClick={() => toggleSave(proj.id)}
                        className={`p-2 rounded-lg border transition-colors ${
                          proj.isSaved
                            ? 'border-[#1E40AF] text-[#1E40AF] bg-[#EEF2FF]'
                            : 'border-[#D0D5DD] text-[#475467] hover:bg-[#F8F9FB]'
                        }`}
                      >
                        <Bookmark className="w-4 h-4" fill={proj.isSaved ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    <Link
                      to={`/projects/${proj.id}`}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg whitespace-nowrap"
                    >
                      View Brief
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3.5 py-2 border border-[#D0D5DD] rounded-lg bg-white disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-mono tabular-nums text-xs text-[#475467]">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3.5 py-2 border border-[#D0D5DD] rounded-lg bg-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
