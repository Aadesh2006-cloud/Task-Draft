import React, { useEffect, useState } from 'react';
import { FileText, Lock, Star } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Link } from '../lib/router';
import { Avatar, StatusText } from '../components/Layout';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatCurrency } from '../utils/domain';

interface TalentCard {
  id: number;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  isDemo: boolean;
  headline: string;
  skills: string[];
  hourlyRate: number | null;
  currency: string;
  availability: string;
  location: string;
}

export function TalentsPage() {
  const [talents, setTalents] = useState<TalentCard[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<TalentCard[]>('/api/talents')
      .then(setTalents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = talents.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${t.name} ${t.headline} ${t.skills.join(' ')} ${t.location}`.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E4E7EC]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">Independent Specialists</h1>
          <p className="mt-1 text-sm text-[#475467]">
            Explore verified portfolios, skills, and client ratings. Private CVs remain access-protected until a freelancer applies to your brief.
          </p>
        </div>
        <input
          aria-label="Search freelancers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, skill, or specialty..."
          className="sm:w-72 px-3.5 py-2 text-sm bg-white border border-[#D0D5DD] rounded-lg"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-48 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((t) => (
            <article key={t.id} className="bg-white border border-[#E4E7EC] rounded-xl p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} src={t.avatarUrl} />
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold text-[#101828] truncate">
                      <Link to={`/sellers/${t.id}`} className="hover:text-[#1E40AF]">
                        {t.name}
                      </Link>
                    </h2>
                    <p className="text-xs text-[#667085]">
                      {t.location || 'Remote'} · <StatusText status={t.availability} />
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-[#101828]">{t.headline || 'Independent Specialist'}</p>
                <p className="mt-2 text-xs text-[#475467]">
                  {t.skills.length > 0 ? t.skills.slice(0, 6).join(' · ') : 'Skills being updated'}
                </p>
              </div>
              <div className="pt-4 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[#101828]">
                  {t.hourlyRate ? `${formatCurrency(t.hourlyRate, t.currency)}/hr` : 'Fixed / Quote'}
                </span>
                <Link to={`/sellers/${t.id}`} className="font-semibold text-[#1E40AF] hover:underline">
                  View Portfolio →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

interface SellerProfilePayload {
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    isDemo: boolean;
  };
  profile: {
    headline: string;
    bio: string;
    skills: string[];
    experience: Array<{ role: string; company: string; period: string; summary: string }>;
    education: Array<{ degree: string; institution: string; year: string }>;
    languages: string[];
    pricingPreference: string;
    hourlyRate: number | null;
    currency: string;
    availability: string;
    location: string;
    timezone: string;
    portfolioLinks: Array<{ label: string; url: string }>;
  } | null;
  hasPrivateCv: boolean;
  canViewCv: boolean;
  cvMeta: { id: number; fileName: string; sizeBytes: number } | null;
  portfolio: Array<{
    id: number;
    title: string;
    description: string;
    toolsUsed: string[];
    rolePerformed: string;
    externalUrl: string;
    imageUrl: string;
    verifiedContribution: boolean;
  }>;
  reviews: Array<{
    id: number;
    projectTitle: string;
    reviewerName: string;
    ratingOverall: number;
    ratingCommunication: number;
    ratingQuality: number;
    ratingReliability: number;
    ratingProfessionalism: number;
    comment: string;
  }>;
  completedCount: number;
  avgRating: number | null;
}

export function SellerProfilePage({ sellerId }: { sellerId: number }) {
  const [data, setData] = useState<SellerProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);

  useEffect(() => {
    apiRequest<SellerProfilePayload>(`/api/sellers/${sellerId}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load profile.'))
      .finally(() => setLoading(false));
  }, [sellerId]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-sm text-[#475467]">Loading freelancer profile...</div>;
  if (error || !data) return <div className="max-w-xl mx-auto px-4 py-16 text-center text-sm text-[#B91C1C]">{error || 'Profile not found.'}</div>;

  const { seller, profile, portfolio, reviews } = data;

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start gap-5">
          <Avatar name={seller.name} src={seller.avatarUrl} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
              <span>{seller.emailVerified ? 'Verified email' : 'Member'}</span>
              <span aria-hidden="true">·</span>
              <StatusText status={profile?.availability || 'available'} />
              <span aria-hidden="true">·</span>
              <span>{profile?.location || 'Remote'}{profile?.timezone ? ` (${profile.timezone})` : ''}</span>
              {seller.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#B45309] font-medium">Demo Profile</span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#101828]">{seller.name}</h1>
            <p className="mt-1 text-base text-[#344054] font-medium">{profile?.headline}</p>
            <p className="mt-3 text-sm text-[#475467] max-w-2xl leading-relaxed">{profile?.bio}</p>
          </div>
        </div>

        <div className="md:w-64 shrink-0 space-y-3 border-t md:border-t-0 md:border-l border-[#E4E7EC] pt-4 md:pt-0 md:pl-6 text-sm">
          <div>
            <p className="text-xs text-[#667085]">Indicative Rate</p>
            <p className="font-mono text-xl font-bold text-[#101828]">
              {profile?.hourlyRate ? `${formatCurrency(profile.hourlyRate, profile.currency)}/hr` : 'Project quote'}
            </p>
          </div>
          <div className="text-xs text-[#475467] space-y-1">
            <p>Completed platform projects: <strong className="font-mono text-[#101828]">{data.completedCount}</strong></p>
            <p>
              Verified rating:{' '}
              <strong className="font-mono text-[#101828]">
                {data.avgRating ? `${data.avgRating}/5 (${reviews.length})` : 'No reviews yet'}
              </strong>
            </p>
          </div>
          {data.hasPrivateCv && (
            <div className="pt-2 border-t border-[#E4E7EC]">
              {data.canViewCv && data.cvMeta ? (
                <button
                  type="button"
                  onClick={() => setPreviewFileId(data.cvMeta!.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF] hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" /> View Authorized CV
                </button>
              ) : (
                <p className="text-xs text-[#667085] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Private CV on file (shared only upon proposal)
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Skills, Experience & Education */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Portfolio &amp; Verified Contributions</h2>
            {portfolio.length === 0 ? (
              <p className="text-sm text-[#667085]">No public portfolio items added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {portfolio.map((item) => (
                  <article key={item.id} className="border border-[#E4E7EC] rounded-xl overflow-hidden flex flex-col">
                    {item.imageUrl && (
                      <div className="aspect-[4/3] bg-[#F2F4F7] overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <p className="text-xs text-[#667085]">
                          {item.rolePerformed || 'Contributor'}
                          {item.verifiedContribution ? ' · Verified contribution' : ''}
                        </p>
                        <h3 className="mt-1 font-display text-base font-semibold text-[#101828]">{item.title}</h3>
                        <p className="mt-1.5 text-xs text-[#475467] leading-relaxed">{item.description}</p>
                      </div>
                      <p className="pt-2 text-xs text-[#667085]">{item.toolsUsed.join(' · ')}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Verified Platform Reviews</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-[#667085]">Reviews appear automatically once projects complete on Briefline.</p>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="pb-4 border-b border-[#F2F4F7] last:border-b-0 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#101828]">
                      {rev.reviewerName} · <span className="font-normal text-[#667085]">{rev.projectTitle}</span>
                    </span>
                    <span className="font-mono font-semibold text-[#1E40AF] inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-current" /> {rev.ratingOverall}/5
                    </span>
                  </div>
                  <p className="text-sm text-[#344054]">{rev.comment}</p>
                </div>
              ))
            )}
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#101828]">Skills &amp; Languages</h2>
            <p className="text-sm text-[#344054]">{(profile?.skills || []).join(' · ') || '—'}</p>
            <p className="text-xs text-[#667085] pt-2 border-t border-[#F2F4F7]">
              Languages: {(profile?.languages || ['English']).join(', ')}
            </p>
          </div>

          {(profile?.experience?.length || 0) > 0 && (
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#101828]">Experience</h2>
              {profile!.experience.map((e, idx) => (
                <div key={idx} className="text-xs space-y-0.5 pb-2 border-b border-[#F2F4F7] last:border-b-0">
                  <p className="font-semibold text-[#101828]">{e.role}</p>
                  <p className="text-[#667085]">{e.company} · {e.period}</p>
                  <p className="text-[#475467]">{e.summary}</p>
                </div>
              ))}
            </div>
          )}

          {(profile?.education?.length || 0) > 0 && (
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-2">
              <h2 className="font-display text-base font-semibold text-[#101828]">Education</h2>
              {profile!.education.map((ed, idx) => (
                <p key={idx} className="text-xs text-[#344054]">
                  <strong>{ed.degree}</strong> · {ed.institution} ({ed.year})
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>

      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
}
