import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatCurrency } from '../utils/domain';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  openProjectsCount: number;
}

interface FeaturedProject {
  id: number;
  title: string;
  brief: string;
  categoryName: string;
  buyerOrganization: string;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  currency: string;
  deadline: string;
  experienceLevel: string;
  requiredSkills: string[];
  proposalCount: number;
  isDemo: boolean;
}

export function LandingPage() {
  const { account } = useAuth();
  const { navigate } = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [featured, setFeatured] = useState<FeaturedProject[]>([]);
  const [heroImgError, setHeroImgError] = useState(false);

  useEffect(() => {
    apiRequest<CategoryItem[]>('/api/categories').then(setCategories).catch(() => {});
    apiRequest<{ items: FeaturedProject[] }>('/api/projects?limit=4&sort=newest')
      .then((d) => setFeatured(d.items))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero Section — Balanced 2-column stretch with single primary focal anchor */}
      <section className="bg-white border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#1E40AF] mb-4">
                Scoped freelance marketplace and private delivery workspace
              </p>
              <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight leading-[1.08] text-[#101828]">
                From project brief to final delivery — all in one place.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-[#475467] leading-relaxed max-w-xl">
                Publish a structured brief, compare independent specialists side by side with verified portfolios and private CVs, agree on scope and milestones, then deliver the work together inside a dedicated project room.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={account ? '/post-project' : '/auth?mode=register&role=buyer'}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors whitespace-nowrap"
                >
                  Post a Project
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-[#101828] bg-white hover:bg-[#F2F4F7] border border-[#D0D5DD] rounded-lg transition-colors whitespace-nowrap"
                >
                  Explore Open Projects
                </Link>
              </div>
              <p className="mt-5 text-xs text-[#667085]">
                Work as a client, freelancer, or both under one account · Private workspace isolation enforced server-side
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-xl overflow-hidden border border-[#E4E7EC] bg-[#EEF2F6]">
                {!heroImgError ? (
                  <img
                    src="/src/assets/images/hero_studio_collab_1795195344055.jpg"
                    alt="Independent product designer reviewing wireframes and project milestones inside a modern daylight studio"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8 text-sm text-[#475467]">
                    Briefline — Structured Project Delivery Studio
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-column structured platform highlights directly below hero split */}
          <div className="mt-12 pt-8 border-t border-[#E4E7EC] grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#101828]">100%</p>
              <p className="mt-1 text-xs text-[#475467]">Dual-party scope acceptance before workspace activation</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#101828]">Private</p>
              <p className="mt-1 text-xs text-[#475467]">CVs, samples, and project rooms locked to authorized participants</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#101828]">4-Stage</p>
              <p className="mt-1 text-xs text-[#475467]">Kanban tasks, milestones, change requests, and handover approvals</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#101828]">6 Core</p>
              <p className="mt-1 text-xs text-[#475467]">Focused product, engineering, brand, docs, data, and mobile categories</p>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Sided Workflow */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#101828] tracking-tight">
            Built for clarity on both sides of the brief
          </h2>
          <p className="mt-3 text-base text-[#475467]">
            Replace scattered emails, vague quotes, and unmanaged folders with one continuous workflow from discovery through handover.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01. Define the Brief',
              audience: 'For Clients',
              body: 'Capture scope, deliverables, acceptance criteria, budget, and screening questions with completeness warnings before publishing.',
            },
            {
              step: '02. Compare Proposals',
              audience: 'For Selection',
              body: 'Inspect structured bids, milestone plans, portfolios, and permission-protected CVs side by side. Shortlist, message, or decline privately.',
            },
            {
              step: '03. Agree on Terms',
              audience: 'Dual Sign-Off',
              body: 'Summarize deliverables, price, timeline, and revision rules. Once both parties confirm, Briefline creates a private workspace automatically.',
            },
            {
              step: '04. Deliver Together',
              audience: 'Private Room',
              body: 'Track tasks, versioned files, scope change requests, milestone reviews, and final handover — followed by verified mutual reviews.',
            },
          ].map((item) => (
            <div key={item.step} className="bg-white border border-[#E4E7EC] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085]">{item.audience}</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-[#101828]">{item.step}</h3>
                <p className="mt-2.5 text-sm text-[#475467] leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Featured Projects & Categories */}
      <section className="bg-white border-y border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#101828] tracking-tight">
                Live open briefs on the marketplace
              </h2>
              <p className="mt-2 text-sm text-[#475467]">
                Seeded preview briefs are clearly labeled so you can explore real end-to-end proposals and workspaces immediately.
              </p>
            </div>
            <Link to="/marketplace" className="text-sm font-semibold text-[#1E40AF] hover:underline whitespace-nowrap">
              View all open projects →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featured.map((proj) => (
              <article
                key={proj.id}
                className="border border-[#E4E7EC] rounded-xl p-6 bg-[#F8F9FB]/50 hover:bg-white transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                    <span>{proj.categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{proj.experienceLevel} level</span>
                    <span aria-hidden="true">·</span>
                    <span>Deadline {proj.deadline || 'Flexible'}</span>
                    {proj.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#B45309] font-medium">Demo Preview</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-[#101828]">
                    <Link to={`/projects/${proj.id}`} className="hover:text-[#1E40AF] transition-colors">
                      {proj.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm text-[#475467] line-clamp-2 leading-relaxed">{proj.brief}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E4E7EC] flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono tabular-nums text-sm font-semibold text-[#101828]">
                    {formatCurrency(proj.budgetMin, proj.currency)}–{formatCurrency(proj.budgetMax, proj.currency)}
                    {proj.budgetType === 'hourly' ? '/hr' : ' fixed'}
                  </div>
                  <div className="text-xs text-[#667085]">
                    {proj.buyerOrganization} · {proj.proposalCount} {proj.proposalCount === 1 ? 'proposal' : 'proposals'}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Focused Categories */}
          <div className="mt-12 pt-10 border-t border-[#E4E7EC]">
            <h3 className="font-display text-lg font-semibold text-[#101828]">Focused launch categories</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/marketplace?categoryId=${cat.id}`)}
                  className="text-left p-4 rounded-lg border border-[#E4E7EC] hover:border-[#1E40AF]/40 hover:bg-[#F8F9FB] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#101828]">{cat.name}</span>
                    <span className="font-mono tabular-nums text-xs text-[#667085]">
                      {cat.openProjectsCount} open
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#475467] line-clamp-2">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust, Safety & Testimonials */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#101828] tracking-tight">
              Trust and scope protection built into the data model
            </h2>
            <p className="text-sm text-[#475467] leading-relaxed">
              Every project safeguard is enforced on the server, not just hidden in the interface.
            </p>
            <ul className="space-y-4 text-sm text-[#344054]">
              <li className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>Private CVs &amp; Workspaces:</strong> Only the owner, proposing buyer, hired participants, and authorized admins can retrieve private files or workspace messages.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>Explicit Scope Change Control:</strong> Out-of-scope additions require written terms and mutual approval on revised cost or deadlines.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>Paid Sample Guidance:</strong> Briefs disclose upfront whether a sample test is requested and encourage fair compensation for substantial work.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <figure className="bg-white border border-[#E4E7EC] rounded-xl p-6 flex flex-col justify-between">
              <blockquote className="text-sm text-[#344054] leading-relaxed">
                “Before switching to structured briefs and private rooms, we lost days reconciling email threads with design deliverables. Having milestones, change requests, and final handover in one place cut our review cycle in half.”
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-[#E4E7EC]">
                <p className="text-sm font-semibold text-[#101828]">Hannah Lindqvist</p>
                <p className="text-xs text-[#667085]">VP of Product, Kestrel Maritime · Illustrative Client Testimonial</p>
              </figcaption>
            </figure>

            <figure className="bg-white border border-[#E4E7EC] rounded-xl p-6 flex flex-col justify-between">
              <blockquote className="text-sm text-[#344054] leading-relaxed">
                “Clients answer scope questions before I bid, my CV stays private until I apply, and scope additions are logged cleanly as change requests instead of silent extras.”
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-[#E4E7EC]">
                <p className="text-sm font-semibold text-[#101828]">Daniel Okafor</p>
                <p className="text-xs text-[#667085]">Independent Staff Frontend Engineer · Illustrative Freelancer Testimonial</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Final CTA Band */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-[#101828] text-white rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to run your next project in one place?
            </h2>
            <p className="mt-2 text-sm text-[#D0D5DD] max-w-xl">
              Sign in with Google, create an email account, or step right into a clearly labeled Buyer, Seller, or Admin preview account to test the full lifecycle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/auth"
              className="px-5 py-3 text-sm font-semibold bg-white text-[#101828] hover:bg-[#F2F4F7] rounded-lg transition-colors whitespace-nowrap"
            >
              Sign In or Try Demo Accounts
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
