import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { syncProjectBriefToFirestore } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';
import { formatCurrency, validateProjectBrief } from '../utils/domain';

interface Category {
  id: number;
  name: string;
  subcategories: string[];
  suggestedSkills: string[];
}

export function PostProjectWizardPage() {
  const { account } = useAuth();
  const { search, navigate } = useRouter();
  const editId = new URLSearchParams(search).get('edit');

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedPublish, setConfirmedPublish] = useState(false);

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [customBriefLabel, setCustomBriefLabel] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [referenceLinkLabel, setReferenceLinkLabel] = useState('');
  const [referenceLinkUrl, setReferenceLinkUrl] = useState('');
  const [referenceLinks, setReferenceLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [budgetType, setBudgetType] = useState<'fixed' | 'hourly'>('fixed');
  const [budgetMin, setBudgetMin] = useState('3500');
  const [budgetMax, setBudgetMax] = useState('5500');
  const [currency, setCurrency] = useState('USD');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [proposalDeadline, setProposalDeadline] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('4 weeks');
  const [urgency, setUrgency] = useState<'standard' | 'priority' | 'urgent'>('standard');
  const [experienceLevel, setExperienceLevel] = useState<'entry' | 'intermediate' | 'expert'>('intermediate');
  const [freelancersNeeded, setFreelancersNeeded] = useState(1);
  const [workMode, setWorkMode] = useState<'remote' | 'hybrid' | 'onsite'>('remote');
  const [location, setLocation] = useState('Remote');
  const [screeningQuestions, setScreeningQuestions] = useState<string[]>(['']);
  const [sampleRequested, setSampleRequested] = useState(false);
  const [samplePaid, setSamplePaid] = useState(true);
  const [sampleDetails, setSampleDetails] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'invite_only' | 'private_link'>('public');
  const [revisionPolicy, setRevisionPolicy] = useState('Up to 2 rounds of revisions included per milestone.');
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [allowPublicQa, setAllowPublicQa] = useState(true);

  useEffect(() => {
    apiRequest<Category[]>('/api/categories')
      .then((list) => {
        setCategories(list);
        if (list.length > 0 && !editId) {
          setCategoryId((prev) => prev || list[0].id);
        }
      })
      .catch(() => {});
  }, [editId]);

  useEffect(() => {
    if (!editId) return;
    apiRequest<Record<string, unknown>>(`/api/projects/${editId}`)
      .then((p) => {
        setTitle(String(p.title || ''));
        setBrief(String(p.brief || ''));
        setCategoryId(Number(p.categoryId) || null);
        setSubcategory(String(p.subcategory || ''));
        setSkillsText(((p.requiredSkills as string[]) || []).join(', '));
        setScopeOfWork(String(p.scopeOfWork || ''));
        const dels = (p.deliverables as string[]) || [];
        setDeliverables(dels.length > 0 ? dels : ['']);
        setAcceptanceCriteria(String(p.acceptanceCriteria || ''));
        setReferenceLinks((p.referenceLinks as Array<{ label: string; url: string }>) || []);
        setBudgetType((p.budgetType as 'fixed' | 'hourly') || 'fixed');
        setBudgetMin(String(p.budgetMin || 0));
        setBudgetMax(String(p.budgetMax || 0));
        setCurrency(String(p.currency || 'USD'));
        setStartDate(String(p.startDate || ''));
        setDeadline(String(p.deadline || ''));
        setProposalDeadline(String(p.proposalDeadline || ''));
        setEstimatedDuration(String(p.estimatedDuration || ''));
        setUrgency((p.urgency as 'standard' | 'priority' | 'urgent') || 'standard');
        setExperienceLevel((p.experienceLevel as 'entry' | 'intermediate' | 'expert') || 'intermediate');
        setFreelancersNeeded(Number(p.freelancersNeeded || 1));
        setWorkMode((p.workMode as 'remote' | 'hybrid' | 'onsite') || 'remote');
        setLocation(String(p.location || 'Remote'));
        const qs = (p.screeningQuestions as string[]) || [];
        setScreeningQuestions(qs.length > 0 ? qs : ['']);
        setSampleRequested(Boolean(p.sampleRequested));
        setSamplePaid(Boolean(p.samplePaid));
        setSampleDetails(String(p.sampleDetails || ''));
        setVisibility((p.visibility as 'public' | 'invite_only' | 'private_link') || 'public');
        setRevisionPolicy(String(p.revisionPolicy || ''));
        setAdditionalTerms(String(p.additionalTerms || ''));
        setAllowPublicQa(Boolean(p.allowPublicQa));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load draft.'));
  }, [editId]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to post a project</h1>
        <p className="mt-2 text-sm text-[#475467]">Create a Buyer account or switch into a demo Buyer preview account to publish a project brief.</p>
        <Link to="/auth?mode=register&role=buyer" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In / Create Buyer Account
        </Link>
      </div>
    );
  }

  if (!account.user.canBuy && !account.user.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Buyer capability required</h1>
        <p className="mt-2 text-sm text-[#475467]">You can enable Buyer mode on your existing account in seconds.</p>
        <Link to="/onboarding" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Enable Buyer Role
        </Link>
      </div>
    );
  }

  const requiredSkills = skillsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const cleanDeliverables = deliverables.map((d) => d.trim()).filter(Boolean);
  const cleanQuestions = screeningQuestions.map((q) => q.trim()).filter(Boolean);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategoryOptions = Array.from(
    new Set([...(selectedCategory?.subcategories || []), 'Custom Brief'])
  );
  const isUnknownCustomSubcategory =
    Boolean(subcategory) && !subcategoryOptions.includes(subcategory);
  const isCustomBriefSelected =
    subcategory === 'Custom Brief' ||
    isUnknownCustomSubcategory ||
    selectedCategory?.name === 'Custom Brief';
  const displayedCustomLabel = isUnknownCustomSubcategory && !customBriefLabel ? subcategory : customBriefLabel;
  const resolvedSubcategory =
    (subcategory === 'Custom Brief' || isUnknownCustomSubcategory) && displayedCustomLabel.trim()
      ? displayedCustomLabel.trim()
      : subcategory;

  const briefValidation = validateProjectBrief({
    title,
    brief,
    categoryId,
    scopeOfWork,
    deliverables: cleanDeliverables,
    acceptanceCriteria,
    budgetType,
    budgetMin: Number(budgetMin) || 0,
    budgetMax: Number(budgetMax) || 0,
    deadline,
    requiredSkills,
    sampleRequested,
    samplePaid,
    sampleDetails,
  });

  const submitBrief = async (publish: boolean) => {
    setError(null);
    if (publish && !confirmedPublish) {
      setError('Please check the publish confirmation box before publishing your project.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || 'Untitled Project Draft',
        brief,
        categoryId: categoryId || categories[0]?.id,
        subcategory: resolvedSubcategory,
        requiredSkills,
        scopeOfWork,
        deliverables: cleanDeliverables,
        acceptanceCriteria,
        referenceLinks,
        budgetType,
        budgetMin: Number(budgetMin) || 0,
        budgetMax: Number(budgetMax) || 0,
        currency,
        startDate,
        deadline,
        proposalDeadline,
        estimatedDuration,
        urgency,
        experienceLevel,
        freelancersNeeded,
        workMode,
        location,
        screeningQuestions: cleanQuestions,
        sampleRequested,
        samplePaid,
        sampleDetails,
        visibility,
        revisionPolicy,
        additionalTerms,
        allowPublicQa,
        publish,
        confirmedPublish: publish ? confirmedPublish : false,
        status: publish ? 'open' : 'draft',
      };

      const saved = editId
        ? await apiRequest<{ id: number }>(`/api/projects/${editId}`, { method: 'PATCH', body: payload })
        : await apiRequest<{ id: number }>('/api/projects', { method: 'POST', body: payload });

      void syncProjectBriefToFirestore({
        projectId: saved.id,
        title: payload.title,
        category: selectedCategory?.name || 'Custom Brief',
        subcategory: resolvedSubcategory,
        budgetType,
        budgetMin: Number(budgetMin) || 0,
        budgetMax: Number(budgetMax) || 0,
        currency,
        status: publish ? 'open' : 'draft',
        skills: requiredSkills,
      }).catch(() => {});

      navigate(publish ? `/projects/${saved.id}` : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save project.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Brief & Category' },
    { num: 2, label: 'Scope & Questions' },
    { num: 3, label: 'Budget & Policy' },
    { num: 4, label: 'Review & Publish' },
  ];

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">
            {editId ? 'Edit Project Brief' : 'Post a New Project'}
          </h1>
          <p className="mt-1 text-sm text-[#475467]">
            Save as a draft at any step. Projects are never published without your final review and confirmation.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => submitBrief(false)}
          className="px-4 py-2 text-xs font-semibold text-[#101828] bg-white border border-[#D0D5DD] hover:bg-[#F8F9FB] rounded-lg whitespace-nowrap"
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
      </div>

      {/* Stepper */}
      <nav aria-label="Wizard steps" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`text-left px-4 py-3 rounded-lg border text-xs transition-colors ${
              step === s.num
                ? 'border-[#1E40AF] bg-[#EEF2FF] text-[#1E40AF] font-semibold'
                : 'border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F8F9FB]'
            }`}
          >
            <span className="font-mono">0{s.num}.</span> {s.label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-[#101828]">01. Project Title, Brief &amp; Skills</h2>
            <div>
              <label htmlFor="proj-title" className="block text-sm font-medium text-[#344054] mb-1">
                Project Title *
              </label>
              <input
                id="proj-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Redesign B2B Billing Portal & Design Token Library"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="proj-cat" className="block text-sm font-medium text-[#344054] mb-1">
                  Category *
                </label>
                <select
                  id="proj-cat"
                  value={categoryId || ''}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    const nextCat = categories.find((c) => c.id === nextId);
                    setCategoryId(nextId);
                    setSubcategory(nextCat?.name === 'Custom Brief' ? 'Custom Brief' : '');
                    setCustomBriefLabel('');
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="proj-subcat" className="block text-sm font-medium text-[#344054] mb-1">
                  Subcategory
                </label>
                <select
                  id="proj-subcat"
                  value={
                    subcategory && !subcategoryOptions.includes(subcategory)
                      ? 'Custom Brief'
                      : subcategory
                  }
                  onChange={(e) => {
                    setSubcategory(e.target.value);
                    if (e.target.value !== 'Custom Brief') {
                      setCustomBriefLabel('');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="">General</option>
                  {subcategoryOptions.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isCustomBriefSelected && (
              <div>
                <label htmlFor="proj-custom-subcat" className="block text-sm font-medium text-[#344054] mb-1">
                  Custom Brief Type / Specialty (optional)
                </label>
                <input
                  id="proj-custom-subcat"
                  value={displayedCustomLabel}
                  onChange={(e) => {
                    if (subcategory !== 'Custom Brief') setSubcategory('Custom Brief');
                    setCustomBriefLabel(e.target.value);
                  }}
                  placeholder="e.g. Video Production, Event Strategy, AI Workflow Automation, Legal Review..."
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
                <p className="mt-1 text-xs text-[#667085]">
                  Leave blank to publish under &ldquo;Custom Brief&rdquo;, or enter a custom specialty label.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="proj-brief" className="block text-sm font-medium text-[#344054] mb-1">
                Detailed Brief &amp; Problem Statement *
              </label>
              <textarea
                id="proj-brief"
                rows={5}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Explain the business context, current bottlenecks, target users, and what success looks like..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="proj-skills" className="block text-sm font-medium text-[#344054] mb-1">
                Required Skills &amp; Tools (comma-separated)
              </label>
              <input
                id="proj-skills"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder={(selectedCategory?.suggestedSkills || ['Figma', 'React', 'TypeScript']).join(', ')}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
              {selectedCategory && selectedCategory.suggestedSkills.length > 0 && (
                <p className="mt-1.5 text-xs text-[#667085]">
                  Suggested: {selectedCategory.suggestedSkills.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-[#101828]">02. Scope, Deliverables &amp; Screening</h2>
            <div>
              <label htmlFor="proj-scope" className="block text-sm font-medium text-[#344054] mb-1">
                Scope of Work
              </label>
              <textarea
                id="proj-scope"
                rows={4}
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="Define included pages, modules, integrations, and explicit boundaries..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#344054]">Expected Deliverables</label>
              {deliverables.map((del, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    aria-label={`Deliverable ${idx + 1}`}
                    value={del}
                    onChange={(e) =>
                      setDeliverables((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                    }
                    placeholder="e.g. Tokenized Figma library covering 12 core views"
                    className="flex-1 px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                  {deliverables.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove deliverable ${idx + 1}`}
                      onClick={() => setDeliverables((p) => p.filter((_, i) => i !== idx))}
                      className="p-2 text-[#667085] hover:text-[#B91C1C]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDeliverables((p) => [...p, ''])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF]"
              >
                <Plus className="w-3.5 h-3.5" /> Add deliverable
              </button>
            </div>

            <div>
              <label htmlFor="proj-criteria" className="block text-sm font-medium text-[#344054] mb-1">
                Acceptance Criteria
              </label>
              <textarea
                id="proj-criteria"
                rows={3}
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="How will you verify deliverables before approving handover?"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>

            <div className="space-y-2 pt-3 border-t border-[#E4E7EC]">
              <label className="block text-sm font-medium text-[#344054]">
                Required Screening Questions for Proposals
              </label>
              {screeningQuestions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    aria-label={`Screening question ${idx + 1}`}
                    value={q}
                    onChange={(e) =>
                      setScreeningQuestions((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                    }
                    placeholder="Ask freelancers about relevant past projects or methodology..."
                    className="flex-1 px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                  {screeningQuestions.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove question ${idx + 1}`}
                      onClick={() => setScreeningQuestions((p) => p.filter((_, i) => i !== idx))}
                      className="p-2 text-[#667085] hover:text-[#B91C1C]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setScreeningQuestions((p) => [...p, ''])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF]"
              >
                <Plus className="w-3.5 h-3.5" /> Add question
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-[#E4E7EC]">
              <p className="text-sm font-medium text-[#344054]">Reference Links (optional)</p>
              {referenceLinks.map((lnk, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-[#344054]">
                  <span>{lnk.label}: {lnk.url}</span>
                  <button type="button" onClick={() => setReferenceLinks((p) => p.filter((_, idx) => idx !== i))} className="text-[#B91C1C]">
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  placeholder="Label"
                  value={referenceLinkLabel}
                  onChange={(e) => setReferenceLinkLabel(e.target.value)}
                  className="sm:w-1/3 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
                <input
                  placeholder="https://..."
                  value={referenceLinkUrl}
                  onChange={(e) => setReferenceLinkUrl(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!referenceLinkUrl.trim()) return;
                    setReferenceLinks((p) => [...p, { label: referenceLinkLabel || 'Reference', url: referenceLinkUrl }]);
                    setReferenceLinkLabel('');
                    setReferenceLinkUrl('');
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-[#F2F4F7] rounded-lg"
                >
                  Add Link
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold text-[#101828]">03. Budget, Timeline &amp; Policies</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="proj-btype" className="block text-sm font-medium text-[#344054] mb-1">
                  Budget Type
                </label>
                <select
                  id="proj-btype"
                  value={budgetType}
                  onChange={(e) => setBudgetType(e.target.value as 'fixed' | 'hourly')}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-curr" className="block text-sm font-medium text-[#344054] mb-1">
                  Currency
                </label>
                <select
                  id="proj-curr"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-bmin" className="block text-sm font-medium text-[#344054] mb-1">
                  Min Budget *
                </label>
                <input
                  id="proj-bmin"
                  type="number"
                  min={1}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="proj-bmax" className="block text-sm font-medium text-[#344054] mb-1">
                  Max Budget *
                </label>
                <input
                  id="proj-bmax"
                  type="number"
                  min={1}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="proj-start" className="block text-sm font-medium text-[#344054] mb-1">
                  Desired Start Date
                </label>
                <input
                  id="proj-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="proj-deadline" className="block text-sm font-medium text-[#344054] mb-1">
                  Target Deadline *
                </label>
                <input
                  id="proj-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="proj-pdeadline" className="block text-sm font-medium text-[#344054] mb-1">
                  Proposal Cutoff
                </label>
                <input
                  id="proj-pdeadline"
                  type="date"
                  value={proposalDeadline}
                  onChange={(e) => setProposalDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="proj-duration" className="block text-sm font-medium text-[#344054] mb-1">
                  Estimated Duration
                </label>
                <input
                  id="proj-duration"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="proj-exp" className="block text-sm font-medium text-[#344054] mb-1">
                  Experience Level
                </label>
                <select
                  id="proj-exp"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as 'entry' | 'intermediate' | 'expert')}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="entry">Entry</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-urgency" className="block text-sm font-medium text-[#344054] mb-1">
                  Urgency
                </label>
                <select
                  id="proj-urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as 'standard' | 'priority' | 'urgent')}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="standard">Standard</option>
                  <option value="priority">Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-count" className="block text-sm font-medium text-[#344054] mb-1">
                  Freelancers Needed
                </label>
                <input
                  id="proj-count"
                  type="number"
                  min={1}
                  max={10}
                  value={freelancersNeeded}
                  onChange={(e) => setFreelancersNeeded(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 text-sm font-mono border border-[#D0D5DD] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="proj-wmode" className="block text-sm font-medium text-[#344054] mb-1">
                  Work Mode
                </label>
                <select
                  id="proj-wmode"
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as 'remote' | 'hybrid' | 'onsite')}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div>
                <label htmlFor="proj-loc" className="block text-sm font-medium text-[#344054] mb-1">
                  Location / Timezone Overlap
                </label>
                <input
                  id="proj-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="proj-vis" className="block text-sm font-medium text-[#344054] mb-1">
                  Visibility
                </label>
                <select
                  id="proj-vis"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'invite_only' | 'private_link')}
                  className="w-full px-3 py-2.5 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                >
                  <option value="public">Public Marketplace</option>
                  <option value="private_link">Private Link Only</option>
                  <option value="invite_only">Invite Only</option>
                </select>
              </div>
            </div>

            {/* Sample / Work Test Disclosure */}
            <div className="pt-4 border-t border-[#E4E7EC] space-y-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-[#101828]">
                <input
                  type="checkbox"
                  checked={sampleRequested}
                  onChange={(e) => setSampleRequested(e.target.checked)}
                />
                Request a sample task or paid work test from shortlisted applicants
              </label>
              {sampleRequested && (
                <div className="pl-6 space-y-3">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={samplePaid} onChange={() => setSamplePaid(true)} />
                      <span className="font-semibold text-[#15803D]">Paid work test (Recommended for substantial work)</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={!samplePaid} onChange={() => setSamplePaid(false)} />
                      <span className="text-[#B45309]">Unpaid sample (small screening exercise only)</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Clearly disclose test scope, expected time commitment, and compensation if paid..."
                    value={sampleDetails}
                    onChange={(e) => setSampleDetails(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E4E7EC]">
              <div>
                <label htmlFor="proj-rev" className="block text-sm font-medium text-[#344054] mb-1">
                  Revision Policy
                </label>
                <input
                  id="proj-rev"
                  value={revisionPolicy}
                  onChange={(e) => setRevisionPolicy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-[#344054]">
                  <input
                    type="checkbox"
                    checked={allowPublicQa}
                    onChange={(e) => setAllowPublicQa(e.target.checked)}
                  />
                  Allow public clarification questions on brief
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="proj-terms" className="block text-sm font-medium text-[#344054] mb-1">
                Additional Terms (optional)
              </label>
              <textarea
                id="proj-terms"
                rows={2}
                value={additionalTerms}
                onChange={(e) => setAdditionalTerms(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="font-display text-lg font-semibold text-[#101828]">04. Review Brief Before Publishing</h2>

            {/* Blocking Errors & Completeness Warnings */}
            {briefValidation.blockingErrors.length > 0 && (
              <div className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] space-y-1.5">
                <p className="text-sm font-semibold text-[#B91C1C]">Missing required details before publishing:</p>
                <ul className="list-disc pl-5 text-xs text-[#B91C1C] space-y-1">
                  {briefValidation.blockingErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {briefValidation.warnings.length > 0 && (
              <div className="p-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] space-y-1.5">
                <p className="text-sm font-semibold text-[#B45309] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Brief completeness warnings
                </p>
                <ul className="list-disc pl-5 text-xs text-[#92400E] space-y-1">
                  {briefValidation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {briefValidation.canPublish && briefValidation.warnings.length === 0 && (
              <div className="p-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] text-sm text-[#15803D] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Your brief is complete and ready to publish.
              </div>
            )}

            {/* Summary Preview */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-xl bg-[#F8F9FB] border border-[#E4E7EC] text-sm">
              <div className="sm:col-span-2">
                <dt className="text-xs text-[#667085]">Project Title</dt>
                <dd className="font-semibold text-[#101828] mt-0.5">{title || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Category &amp; Level</dt>
                <dd className="text-[#101828] mt-0.5">
                  {selectedCategory?.name || '—'}
                  {resolvedSubcategory ? ` / ${resolvedSubcategory}` : ''} ·{' '}
                  <span className="capitalize">{experienceLevel}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Budget &amp; Deadline</dt>
                <dd className="font-mono text-[#101828] mt-0.5">
                  {formatCurrency(Number(budgetMin) || 0, currency)}–{formatCurrency(Number(budgetMax) || 0, currency)}{' '}
                  ({budgetType}) · Due {deadline || '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[#667085]">Brief Summary</dt>
                <dd className="text-[#344054] mt-0.5 whitespace-pre-line">{brief || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Deliverables</dt>
                <dd className="text-[#344054] mt-0.5">{cleanDeliverables.length > 0 ? cleanDeliverables.join('; ') : 'None listed'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Visibility &amp; Sample Policy</dt>
                <dd className="text-[#344054] mt-0.5 capitalize">
                  {visibility.replace('_', ' ')} · {sampleRequested ? (samplePaid ? 'Paid sample' : 'Unpaid sample') : 'No sample test'}
                </dd>
              </div>
            </dl>

            <label className="flex items-start gap-2.5 text-sm text-[#101828] p-4 border border-[#D0D5DD] rounded-lg">
              <input
                type="checkbox"
                checked={confirmedPublish}
                onChange={(e) => setConfirmedPublish(e.target.checked)}
                className="mt-1"
              />
              <span>
                I have reviewed the project brief, budget, deadline, and policies above and confirm I want to publish this project to the marketplace.
              </span>
            </label>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-5 border-t border-[#E4E7EC] flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-4 py-2 text-sm font-semibold text-[#344054] border border-[#D0D5DD] rounded-lg disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg"
              >
                Continue
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitBrief(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#101828] border border-[#D0D5DD] hover:bg-[#F8F9FB] rounded-lg"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving || !briefValidation.canPublish || !confirmedPublish}
                  onClick={() => submitBrief(true)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 rounded-lg"
                >
                  {saving ? 'Publishing...' : 'Confirm & Publish Project'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
