import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Lock, Plus, Trash2, Upload } from 'lucide-react';
import { apiRequest, fileToBase64 } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';
import { FilePreviewModal } from '../components/FilePreviewModal';

export function OnboardingProfilePage() {
  const { account, refreshAccount, switchRole } = useAuth();
  const [tab, setTab] = useState<'buyer' | 'seller'>(account?.user.activeRole === 'seller' ? 'seller' : 'buyer');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);

  // Buyer fields
  const [orgName, setOrgName] = useState('');
  const [buyerDesc, setBuyerDesc] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactPref, setContactPref] = useState('Platform messages');
  const [buyerLocation, setBuyerLocation] = useState('');
  const [buyerTimezone, setBuyerTimezone] = useState('UTC');

  // Seller fields
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [languagesText, setLanguagesText] = useState('English');
  const [pricingPreference, setPricingPreference] = useState<'fixed' | 'hourly' | 'both'>('both');
  const [hourlyRate, setHourlyRate] = useState('');
  const [availability, setAvailability] = useState<'available' | 'limited' | 'unavailable'>('available');
  const [sellerLocation, setSellerLocation] = useState('');
  const [sellerTimezone, setSellerTimezone] = useState('UTC');
  const [expRole, setExpRole] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expPeriod, setExpPeriod] = useState('');
  const [expSummary, setExpSummary] = useState('');
  const [experience, setExperience] = useState<Array<{ role: string; company: string; period: string; summary: string }>>([]);
  const [education, setEducation] = useState<Array<{ degree: string; institution: string; year: string }>>([]);
  const [eduDegree, setEduDegree] = useState('');
  const [eduInst, setEduInst] = useState('');
  const [eduYear, setEduYear] = useState('');
  const [portfolioLinkUrl, setPortfolioLinkUrl] = useState('');
  const [portfolioLinkLabel, setPortfolioLinkLabel] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState<Array<{ label: string; url: string }>>([]);

  // New portfolio item
  const [portTitle, setPortTitle] = useState('');
  const [portDesc, setPortDesc] = useState('');
  const [portTools, setPortTools] = useState('');
  const [portRole, setPortRole] = useState('');
  const [portUrl, setPortUrl] = useState('');
  const [cvUploading, setCvUploading] = useState(false);

  useEffect(() => {
    if (!account) return;
    if (account.buyerProfile) {
      setOrgName(account.buyerProfile.organizationName || '');
      setBuyerDesc(account.buyerProfile.description || '');
      setWebsite(account.buyerProfile.website || '');
      setIndustry(account.buyerProfile.industry || '');
      setContactPref(account.buyerProfile.contactPreference || 'Platform messages');
      setBuyerLocation(account.buyerProfile.location || '');
      setBuyerTimezone(account.buyerProfile.timezone || 'UTC');
    }
    if (account.sellerProfile) {
      setHeadline(account.sellerProfile.headline || '');
      setBio(account.sellerProfile.bio || '');
      setSkillsText((account.sellerProfile.skills || []).join(', '));
      setLanguagesText((account.sellerProfile.languages || ['English']).join(', '));
      setPricingPreference(account.sellerProfile.pricingPreference || 'both');
      setHourlyRate(account.sellerProfile.hourlyRate ? String(account.sellerProfile.hourlyRate) : '');
      setAvailability(account.sellerProfile.availability || 'available');
      setSellerLocation(account.sellerProfile.location || '');
      setSellerTimezone(account.sellerProfile.timezone || 'UTC');
      setExperience(account.sellerProfile.experience || []);
      setEducation(account.sellerProfile.education || []);
      setPortfolioLinks(account.sellerProfile.portfolioLinks || []);
    }
  }, [account]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to edit your profile</h1>
        <p className="mt-2 text-sm text-[#475467]">Manage your Buyer organization details, Seller portfolio, private CV, and role switching.</p>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  const handleVerifyEmail = async () => {
    setError(null);
    try {
      await apiRequest('/api/auth/verify-email', { method: 'POST' });
      await refreshAccount();
      setMessage('Email address verified.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  const handleSaveBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/api/profiles/buyer', {
        method: 'PUT',
        body: {
          organizationName: orgName,
          description: buyerDesc,
          website,
          industry,
          contactPreference: contactPref,
          location: buyerLocation,
          timezone: buyerTimezone,
        },
      });
      await refreshAccount();
      setMessage('Buyer profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save buyer profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const languages = languagesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiRequest('/api/profiles/seller', {
        method: 'PUT',
        body: {
          headline,
          bio,
          skills,
          languages,
          pricingPreference,
          hourlyRate: hourlyRate ? Number(hourlyRate) : null,
          availability,
          location: sellerLocation,
          timezone: sellerTimezone,
          experience,
          education,
          portfolioLinks,
        },
      });
      await refreshAccount();
      setMessage('Freelancer profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save freelancer profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvUploading(true);
    setError(null);
    setMessage(null);
    try {
      const contentBase64 = await fileToBase64(file);
      await apiRequest('/api/files/upload', {
        method: 'POST',
        body: {
          scope: 'cv',
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          contentBase64,
        },
      });
      await refreshAccount();
      setMessage(`Private CV "${file.name}" uploaded. It is never publicly downloadable.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CV upload failed.');
    } finally {
      setCvUploading(false);
      e.target.value = '';
    }
  };

  const handleAddPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/profiles/portfolio', {
        method: 'POST',
        body: {
          title: portTitle,
          description: portDesc,
          toolsUsed: portTools
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          rolePerformed: portRole,
          externalUrl: portUrl,
        },
      });
      setPortTitle('');
      setPortDesc('');
      setPortTools('');
      setPortRole('');
      setPortUrl('');
      await refreshAccount();
      setMessage('Portfolio item added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add portfolio item.');
    }
  };

  const handleDeletePortfolio = async (id: number) => {
    try {
      await apiRequest(`/api/profiles/portfolio/${id}`, { method: 'DELETE' });
      await refreshAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove portfolio item.');
    }
  };

  const completion = tab === 'buyer' ? account.buyerCompletion : account.sellerCompletion;

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">
            Account, Roles &amp; Profile
          </h1>
          <p className="mt-1 text-sm text-[#475467]">
            Switch between Buyer and Seller modes anytime without creating a second account.
          </p>
        </div>
        {account.user.canSell && (
          <Link
            to={`/sellers/${account.user.id}`}
            className="text-sm font-semibold text-[#1E40AF] hover:underline whitespace-nowrap"
          >
            View Public Freelancer Profile →
          </Link>
        )}
      </div>

      {/* Email Verification Prompt */}
      {!account.user.emailVerified && (
        <div className="bg-white border border-[#FCD34D] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#101828]">Verify your email address</p>
            <p className="text-xs text-[#475467] mt-0.5">
              Verified accounts display a trust indicator to clients and freelancers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleVerifyEmail}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
          >
            Verify Email Now
          </button>
        </div>
      )}

      {/* Role Capabilities & Active Mode Switcher */}
      <section className="bg-white border border-[#E4E7EC] rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="font-display text-base font-semibold text-[#101828]">Role Capabilities</h2>
            <p className="text-xs text-[#475467] mt-1">
              Enable both roles to post projects as a client and submit proposals as an independent professional.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={account.user.canBuy}
                  onChange={(e) => switchRole({ canBuy: e.target.checked })}
                  className="rounded border-[#D0D5DD]"
                />
                <span>Buyer / Client</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={account.user.canSell}
                  onChange={(e) => switchRole({ canSell: e.target.checked })}
                  className="rounded border-[#D0D5DD]"
                />
                <span>Seller / Freelancer</span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#667085] mb-2">Active workspace view</p>
            <div className="inline-flex p-1 bg-[#F2F4F7] rounded-lg gap-1">
              {account.user.canBuy && (
                <button
                  type="button"
                  onClick={() => {
                    switchRole({ activeRole: 'buyer' });
                    setTab('buyer');
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    account.user.activeRole === 'buyer' ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467]'
                  }`}
                >
                  Buyer Mode
                </button>
              )}
              {account.user.canSell && (
                <button
                  type="button"
                  onClick={() => {
                    switchRole({ activeRole: 'seller' });
                    setTab('seller');
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    account.user.activeRole === 'seller' ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467]'
                  }`}
                >
                  Seller Mode
                </button>
              )}
              {account.user.isAdmin && (
                <button
                  type="button"
                  onClick={() => switchRole({ activeRole: 'admin' })}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    account.user.activeRole === 'admin' ? 'bg-white text-[#101828] shadow-xs' : 'text-[#475467]'
                  }`}
                >
                  Admin Mode
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] text-sm text-[#15803D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Profile Tabs + Completion Guidance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7EC] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('buyer')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'buyer' ? 'bg-[#101828] text-white' : 'text-[#475467] hover:bg-[#F2F4F7]'
            }`}
          >
            Buyer Profile ({account.buyerCompletion.percent}%)
          </button>
          <button
            type="button"
            onClick={() => setTab('seller')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'seller' ? 'bg-[#101828] text-white' : 'text-[#475467] hover:bg-[#F2F4F7]'
            }`}
          >
            Freelancer Profile &amp; Portfolio ({account.sellerCompletion.percent}%)
          </button>
        </div>

        <div className="text-xs text-[#475467]">
          Profile completeness: <strong className="font-mono tabular-nums text-[#101828]">{completion.percent}%</strong>
          {completion.missing.length > 0 && ` · Suggested next: ${completion.missing[0]}`}
        </div>
      </div>

      {tab === 'buyer' ? (
        <form onSubmit={handleSaveBuyer} className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-[#101828]">Client / Organization Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="buyer-org" className="block text-sm font-medium text-[#344054] mb-1">
                Individual or Company Name
              </label>
              <input
                id="buyer-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="buyer-industry" className="block text-sm font-medium text-[#344054] mb-1">
                Industry
              </label>
              <input
                id="buyer-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Financial Software, Healthcare"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="buyer-web" className="block text-sm font-medium text-[#344054] mb-1">
                Website
              </label>
              <input
                id="buyer-web"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="buyer-contact" className="block text-sm font-medium text-[#344054] mb-1">
                Contact Preferences
              </label>
              <input
                id="buyer-contact"
                value={contactPref}
                onChange={(e) => setContactPref(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="buyer-loc" className="block text-sm font-medium text-[#344054] mb-1">
                Location
              </label>
              <input
                id="buyer-loc"
                value={buyerLocation}
                onChange={(e) => setBuyerLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="buyer-tz" className="block text-sm font-medium text-[#344054] mb-1">
                Timezone
              </label>
              <input
                id="buyer-tz"
                value={buyerTimezone}
                onChange={(e) => setBuyerTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
          </div>
          <div>
            <label htmlFor="buyer-desc" className="block text-sm font-medium text-[#344054] mb-1">
              Company / Client Overview
            </label>
            <textarea
              id="buyer-desc"
              rows={4}
              value={buyerDesc}
              onChange={(e) => setBuyerDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
          >
            {saving ? 'Saving...' : 'Save Buyer Profile'}
          </button>
        </form>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleSaveSeller} className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-6">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Freelancer Credentials &amp; Availability</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="seller-headline" className="block text-sm font-medium text-[#344054] mb-1">
                  Professional Headline
                </label>
                <input
                  id="seller-headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior Product Designer & TypeScript Engineer"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="seller-bio" className="block text-sm font-medium text-[#344054] mb-1">
                  Biography
                </label>
                <textarea
                  id="seller-bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="seller-skills" className="block text-sm font-medium text-[#344054] mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  id="seller-skills"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Figma, React, PostgreSQL, Design Systems"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="seller-langs" className="block text-sm font-medium text-[#344054] mb-1">
                  Languages (comma-separated)
                </label>
                <input
                  id="seller-langs"
                  value={languagesText}
                  onChange={(e) => setLanguagesText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="seller-pricing" className="block text-sm font-medium text-[#344054] mb-1">
                  Pricing Preference
                </label>
                <select
                  id="seller-pricing"
                  value={pricingPreference}
                  onChange={(e) => setPricingPreference(e.target.value as 'fixed' | 'hourly' | 'both')}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="both">Fixed &amp; Hourly</option>
                  <option value="fixed">Fixed Price Only</option>
                  <option value="hourly">Hourly Only</option>
                </select>
              </div>
              <div>
                <label htmlFor="seller-rate" className="block text-sm font-medium text-[#344054] mb-1">
                  Indicative Hourly Rate (USD)
                </label>
                <input
                  id="seller-rate"
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="seller-avail" className="block text-sm font-medium text-[#344054] mb-1">
                  Availability
                </label>
                <select
                  id="seller-avail"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as 'available' | 'limited' | 'unavailable')}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="available">Available for new projects</option>
                  <option value="limited">Limited capacity</option>
                  <option value="unavailable">Currently booked</option>
                </select>
              </div>
              <div>
                <label htmlFor="seller-loc" className="block text-sm font-medium text-[#344054] mb-1">
                  Location &amp; Timezone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="seller-loc"
                    value={sellerLocation}
                    onChange={(e) => setSellerLocation(e.target.value)}
                    placeholder="City, Country"
                    className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                  <input
                    aria-label="Timezone"
                    value={sellerTimezone}
                    onChange={(e) => setSellerTimezone(e.target.value)}
                    placeholder="UTC / GMT"
                    className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Experience List */}
            <div className="pt-4 border-t border-[#E4E7EC] space-y-3">
              <h3 className="text-sm font-semibold text-[#101828]">Experience</h3>
              {experience.map((exp, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 py-2 border-b border-[#F2F4F7] text-sm">
                  <div>
                    <p className="font-medium text-[#101828]">
                      {exp.role} · {exp.company} <span className="text-xs text-[#667085]">({exp.period})</span>
                    </p>
                    <p className="text-xs text-[#475467] mt-0.5">{exp.summary}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove experience ${exp.role}`}
                    onClick={() => setExperience((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-[#667085] hover:text-[#B91C1C]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  placeholder="Role title"
                  value={expRole}
                  onChange={(e) => setExpRole(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="Company / Studio"
                  value={expCompany}
                  onChange={(e) => setExpCompany(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="Period (e.g. 2022–2026)"
                  value={expPeriod}
                  onChange={(e) => setExpPeriod(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Concise summary of deliverables or impact"
                  value={expSummary}
                  onChange={(e) => setExpSummary(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!expRole.trim()) return;
                    setExperience((p) => [...p, { role: expRole, company: expCompany, period: expPeriod, summary: expSummary }]);
                    setExpRole('');
                    setExpCompany('');
                    setExpPeriod('');
                    setExpSummary('');
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg"
                >
                  Add Entry
                </button>
              </div>
            </div>

            {/* Education & External Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E4E7EC]">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#101828]">Education</h3>
                {education.map((ed, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-[#344054]">
                    <span>{ed.degree}, {ed.institution} ({ed.year})</span>
                    <button
                      type="button"
                      onClick={() => setEducation((p) => p.filter((_, i) => i !== idx))}
                      className="text-[#B91C1C]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-1.5">
                  <input placeholder="Degree" value={eduDegree} onChange={(e) => setEduDegree(e.target.value)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-lg" />
                  <input placeholder="Institution" value={eduInst} onChange={(e) => setEduInst(e.target.value)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-lg" />
                  <input placeholder="Year" value={eduYear} onChange={(e) => setEduYear(e.target.value)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-lg" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!eduDegree.trim()) return;
                    setEducation((p) => [...p, { degree: eduDegree, institution: eduInst, year: eduYear }]);
                    setEduDegree('');
                    setEduInst('');
                    setEduYear('');
                  }}
                  className="text-xs font-semibold text-[#1E40AF]"
                >
                  + Add Education
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#101828]">External Portfolio Links</h3>
                {portfolioLinks.map((lnk, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-[#344054]">
                    <span className="truncate">{lnk.label}: {lnk.url}</span>
                    <button
                      type="button"
                      onClick={() => setPortfolioLinks((p) => p.filter((_, i) => i !== idx))}
                      className="text-[#B91C1C] ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-1.5">
                  <input placeholder="Label (e.g. GitHub)" value={portfolioLinkLabel} onChange={(e) => setPortfolioLinkLabel(e.target.value)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-lg" />
                  <input placeholder="https://..." value={portfolioLinkUrl} onChange={(e) => setPortfolioLinkUrl(e.target.value)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-lg" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!portfolioLinkUrl.trim()) return;
                    setPortfolioLinks((p) => [...p, { label: portfolioLinkLabel || 'Link', url: portfolioLinkUrl }]);
                    setPortfolioLinkLabel('');
                    setPortfolioLinkUrl('');
                  }}
                  className="text-xs font-semibold text-[#1E40AF]"
                >
                  + Add Link
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
            >
              {saving ? 'Saving...' : 'Save Freelancer Profile'}
            </button>
          </form>

          {/* Private CV Upload */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#101828] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#1E40AF]" aria-hidden="true" />
                  Private CV / Resume
                </h2>
                <p className="text-xs text-[#475467] mt-1">
                  Access-controlled storage: your CV is never publicly downloadable and is shared only with clients when you attach it to a proposal.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#101828] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg cursor-pointer whitespace-nowrap">
                <Upload className="w-4 h-4" />
                {cvUploading ? 'Uploading...' : 'Upload CV (PDF, DOCX, TXT)'}
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  onChange={handleCvUpload}
                  className="sr-only"
                />
              </label>
            </div>
            {account.cvFile && (
              <div className="mt-4 pt-4 border-t border-[#E4E7EC] flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 text-[#101828]">
                  <FileText className="w-4 h-4 text-[#475467]" />
                  <span className="font-medium">{account.cvFile.fileName}</span>
                  <span className="text-xs text-[#667085] font-mono">
                    ({Math.max(1, Math.round(account.cvFile.sizeBytes / 1024))} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFileId(account.cvFile!.id)}
                  className="text-xs font-semibold text-[#1E40AF] hover:underline"
                >
                  Preview Private CV
                </button>
              </div>
            )}
          </section>

          {/* Portfolio Manager */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#101828]">Portfolio Work Samples</h2>
              <p className="text-xs text-[#475467] mt-1">
                Specify your exact role and tools used so clients can evaluate your direct contribution.
              </p>
            </div>

            {account.portfolio.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {account.portfolio.map((item) => (
                  <div key={item.id} className="border border-[#E4E7EC] rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[#101828]">{item.title}</h3>
                        <button
                          type="button"
                          aria-label={`Delete portfolio item ${item.title}`}
                          onClick={() => handleDeletePortfolio(item.id)}
                          className="text-[#667085] hover:text-[#B91C1C]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-[#667085] mt-1">
                        {item.rolePerformed || 'Contributor'} · {item.toolsUsed.join(', ')}
                      </p>
                      <p className="text-xs text-[#475467] mt-2 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddPortfolio} className="pt-5 border-t border-[#E4E7EC] space-y-3">
              <h3 className="text-sm font-semibold text-[#101828] flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Portfolio Case Study
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Project title"
                  value={portTitle}
                  onChange={(e) => setPortTitle(e.target.value)}
                  className="px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="Exact role performed (e.g. Lead Frontend Engineer)"
                  value={portRole}
                  onChange={(e) => setPortRole(e.target.value)}
                  className="px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="Tools used (comma-separated)"
                  value={portTools}
                  onChange={(e) => setPortTools(e.target.value)}
                  className="px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="External case study URL (optional)"
                  value={portUrl}
                  onChange={(e) => setPortUrl(e.target.value)}
                  className="px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <textarea
                required
                rows={3}
                placeholder="Describe the problem, your specific contribution, and the measurable outcome."
                value={portDesc}
                onChange={(e) => setPortDesc(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg"
              >
                Add to Portfolio
              </button>
            </form>
          </section>
        </div>
      )}

      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
}
