import React, { useEffect, useState } from 'react';
import { Lock, Plus, Trash2, Upload } from 'lucide-react';
import { apiRequest, fileToBase64 } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';
import { computeMilestoneSum, formatCurrency } from '../utils/domain';

interface BriefSummary {
  id: number;
  title: string;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  currency: string;
  deadline: string;
  screeningQuestions: string[];
  sampleRequested: boolean;
  samplePaid: boolean;
  sampleDetails: string;
}

export function SubmitProposalPage({ projectId }: { projectId: number }) {
  const { account } = useAuth();
  const { navigate } = useRouter();
  const [project, setProject] = useState<BriefSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [coverLetter, setCoverLetter] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [pricingType, setPricingType] = useState<'fixed' | 'hourly'>('fixed');
  const [estimatedTimeline, setEstimatedTimeline] = useState('4 weeks');
  const [availability, setAvailability] = useState('Available to start immediately (20–30 hrs/week)');
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [milestonePlan, setMilestonePlan] = useState<
    Array<{ title: string; deliverables: string; amount: number; dueOffsetDays: number }>
  >([
    { title: 'Milestone 1: Discovery & Initial Architecture', deliverables: '', amount: 0, dueOffsetDays: 14 },
    { title: 'Milestone 2: Final Deliverables & Handover', deliverables: '', amount: 0, dueOffsetDays: 28 },
  ]);
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<number[]>([]);
  const [attachCv, setAttachCv] = useState(true);
  const [sampleNote, setSampleNote] = useState('');
  const [sampleFile, setSampleFile] = useState<{ id: number; fileName: string } | null>(null);
  const [uploadingSample, setUploadingSample] = useState(false);

  useEffect(() => {
    apiRequest<BriefSummary>(`/api/projects/${projectId}`)
      .then((p) => {
        setProject(p);
        setPricingType(p.budgetType);
        const mid = Math.round((p.budgetMin + p.budgetMax) / 2) || p.budgetMin;
        setProposedPrice(String(mid));
        setMilestonePlan([
          {
            title: 'Milestone 1: Discovery & Core Architecture',
            deliverables: 'Initial draft and milestone review',
            amount: Math.round(mid * 0.4),
            dueOffsetDays: 14,
          },
          {
            title: 'Milestone 2: Final Delivery & Handover',
            deliverables: 'Final approved assets and handover notes',
            amount: mid - Math.round(mid * 0.4),
            dueOffsetDays: 28,
          },
        ]);
        setAnswers((p.screeningQuestions || []).map((q) => ({ question: q, answer: '' })));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load project.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (account?.portfolio.length) {
      setSelectedPortfolioIds([account.portfolio[0].id]);
    }
  }, [account]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Sign in to submit a proposal</h1>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-[#475467]">Loading project brief...</div>;
  if (!project) return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-[#B91C1C]">{error || 'Not found.'}</div>;

  const handleSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSample(true);
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const stored = await apiRequest<{ id: number; fileName: string }>('/api/files/upload', {
        method: 'POST',
        body: {
          scope: 'proposal_sample',
          scopeRefId: projectId,
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          contentBase64,
        },
      });
      setSampleFile(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample upload failed.');
    } finally {
      setUploadingSample(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest(`/api/projects/${projectId}/proposals`, {
        method: 'POST',
        body: {
          coverLetter,
          proposedPrice: Number(proposedPrice),
          pricingType,
          currency: project.currency,
          estimatedTimeline,
          availability,
          answers,
          milestonePlan: milestonePlan.filter((m) => m.title.trim().length > 0),
          portfolioItemIds: selectedPortfolioIds,
          attachCv,
          sampleFileId: sampleFile?.id || null,
          sampleNote,
        },
      });
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proposal submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const milestoneTotal = computeMilestoneSum(milestonePlan);

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <Link to={`/projects/${projectId}`} className="text-xs text-[#667085] hover:text-[#101828]">
          ← Back to Brief
        </Link>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#101828]">Submit Proposal</h1>
        <p className="mt-1 text-sm text-[#475467]">
          Applying to <strong>{project.title}</strong> · Client budget{' '}
          <span className="font-mono">
            {formatCurrency(project.budgetMin, project.currency)}–{formatCurrency(project.budgetMax, project.currency)}
          </span>
        </p>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6">
        <div>
          <label htmlFor="prop-cover" className="block text-sm font-medium text-[#344054] mb-1">
            Cover Letter &amp; Understanding of the Brief *
          </label>
          <textarea
            id="prop-cover"
            required
            minLength={30}
            rows={5}
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder="Summarize how you will approach the problem, relevant prior outcomes, and key risks you will mitigate..."
            className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="prop-price" className="block text-sm font-medium text-[#344054] mb-1">
              Proposed Price ({project.currency}) *
            </label>
            <input
              id="prop-price"
              type="number"
              required
              min={1}
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="prop-type" className="block text-sm font-medium text-[#344054] mb-1">
              Pricing Type
            </label>
            <select
              id="prop-type"
              value={pricingType}
              onChange={(e) => setPricingType(e.target.value as 'fixed' | 'hourly')}
              className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
            >
              <option value="fixed">Fixed Project Price</option>
              <option value="hourly">Hourly Rate</option>
            </select>
          </div>
          <div>
            <label htmlFor="prop-time" className="block text-sm font-medium text-[#344054] mb-1">
              Estimated Timeline *
            </label>
            <input
              id="prop-time"
              required
              value={estimatedTimeline}
              onChange={(e) => setEstimatedTimeline(e.target.value)}
              placeholder="e.g. 5 weeks"
              className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prop-avail" className="block text-sm font-medium text-[#344054] mb-1">
            Availability &amp; Weekly Commitment
          </label>
          <input
            id="prop-avail"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
          />
        </div>

        {/* Screening Questions */}
        {answers.length > 0 && (
          <div className="pt-4 border-t border-[#E4E7EC] space-y-4">
            <h2 className="font-display text-base font-semibold text-[#101828]">Client Screening Questions</h2>
            {answers.map((item, idx) => (
              <div key={idx}>
                <label htmlFor={`sq-${idx}`} className="block text-sm font-medium text-[#344054] mb-1">
                  {idx + 1}. {item.question} *
                </label>
                <textarea
                  id={`sq-${idx}`}
                  required
                  rows={2}
                  value={item.answer}
                  onChange={(e) =>
                    setAnswers((prev) => prev.map((a, i) => (i === idx ? { ...a, answer: e.target.value } : a)))
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
            ))}
          </div>
        )}

        {/* Milestone Plan */}
        <div className="pt-4 border-t border-[#E4E7EC] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#101828]">Proposed Milestone Plan</h2>
            <span className="font-mono tabular-nums text-xs text-[#475467]">
              Sum: {formatCurrency(milestoneTotal, project.currency)}
            </span>
          </div>
          {milestonePlan.map((m, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                aria-label={`Milestone ${idx + 1} title`}
                placeholder="Milestone title"
                value={m.title}
                onChange={(e) =>
                  setMilestonePlan((p) => p.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                }
                className="sm:col-span-5 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
              />
              <input
                aria-label={`Milestone ${idx + 1} deliverables`}
                placeholder="Deliverable summary"
                value={m.deliverables}
                onChange={(e) =>
                  setMilestonePlan((p) => p.map((x, i) => (i === idx ? { ...x, deliverables: e.target.value } : x)))
                }
                className="sm:col-span-4 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
              />
              <input
                aria-label={`Milestone ${idx + 1} amount`}
                type="number"
                min={0}
                value={m.amount}
                onChange={(e) =>
                  setMilestonePlan((p) => p.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value) || 0 } : x)))
                }
                className="sm:col-span-2 px-3 py-2 text-xs font-mono border border-[#D0D5DD] rounded-lg"
              />
              <button
                type="button"
                aria-label={`Remove milestone ${idx + 1}`}
                onClick={() => setMilestonePlan((p) => p.filter((_, i) => i !== idx))}
                className="sm:col-span-1 p-2 text-[#667085] hover:text-[#B91C1C]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setMilestonePlan((p) => [...p, { title: '', deliverables: '', amount: 0, dueOffsetDays: (p.length + 1) * 14 }])
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF]"
          >
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </button>
        </div>

        {/* Portfolio, Private CV & Sample Attachment */}
        <div className="pt-4 border-t border-[#E4E7EC] space-y-4">
          <h2 className="font-display text-base font-semibold text-[#101828]">Credentials, Portfolio &amp; Work Sample</h2>

          <label className="flex items-start gap-2.5 text-sm text-[#344054]">
            <input
              type="checkbox"
              checked={attachCv}
              onChange={(e) => setAttachCv(e.target.checked)}
              className="mt-1"
            />
            <span>
              Share my private CV with this client only{' '}
              <span className="text-xs text-[#667085]">
                ({account.cvFile ? account.cvFile.fileName : 'No CV uploaded yet — upload in Profile'})
              </span>
            </span>
          </label>

          {account.portfolio.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#475467]">Attach relevant portfolio items:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {account.portfolio.map((item) => {
                  const checked = selectedPortfolioIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2 cursor-pointer ${
                        checked ? 'border-[#1E40AF] bg-[#EEF2FF]/50' : 'border-[#E4E7EC]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedPortfolioIds((prev) =>
                            prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          )
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <strong className="text-[#101828]">{item.title}</strong>
                        <span className="block text-[#667085] mt-0.5">{item.rolePerformed}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#101828] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#1E40AF]" /> Optional Private Work Sample Attachment
              </p>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-[#D0D5DD] rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploadingSample ? 'Uploading...' : 'Attach Sample'}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md" onChange={handleSampleUpload} className="sr-only" />
              </label>
            </div>
            {sampleFile && <p className="text-xs text-[#15803D]">Attached privately: {sampleFile.fileName}</p>}
            <input
              placeholder="Optional note regarding work sample or test availability..."
              value={sampleNote}
              onChange={(e) => setSampleNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#E4E7EC] flex items-center justify-end gap-3">
          <Link to={`/projects/${projectId}`} className="px-4 py-2 text-sm text-[#475467]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 rounded-lg"
          >
            {submitting ? 'Submitting Proposal...' : 'Submit Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
}
