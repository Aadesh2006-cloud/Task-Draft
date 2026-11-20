import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, Flag, FileText } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';
import { Avatar, StatusText } from '../components/Layout';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatCurrency } from '../utils/domain';

interface ProjectDetail {
  id: number;
  title: string;
  brief: string;
  categoryName: string;
  subcategory: string;
  requiredSkills: string[];
  scopeOfWork: string;
  deliverables: string[];
  acceptanceCriteria: string;
  referenceLinks: Array<{ label: string; url: string }>;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  currency: string;
  startDate: string;
  deadline: string;
  estimatedDuration: string;
  urgency: string;
  experienceLevel: string;
  freelancersNeeded: number;
  workMode: string;
  location: string;
  screeningQuestions: string[];
  sampleRequested: boolean;
  samplePaid: boolean;
  sampleDetails: string;
  visibility: string;
  revisionPolicy: string;
  additionalTerms: string;
  allowPublicQa: boolean;
  proposalDeadline: string;
  status: string;
  isDemo: boolean;
  buyer: {
    id: number;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    organizationName: string;
    industry: string;
    location: string;
    description: string;
  };
  questions: Array<{
    id: number;
    question: string;
    answer: string | null;
    authorName: string;
    createdAt: string;
  }>;
  referenceFiles: Array<{ id: number; fileName: string; sizeBytes: number }>;
  proposalCount: number;
  isSaved: boolean;
  myProposal: { id: number; status: string; proposedPrice: number; currency: string; infoRequestNote: string | null } | null;
  myContract: { id: number; status: string } | null;
  myWorkspaceId: number | null;
  isOwner: boolean;
}

export function ProjectDetailPage({ projectId }: { projectId: number }) {
  const { account } = useAuth();
  const { search, navigate } = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [qaError, setQaError] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ProjectDetail>(`/api/projects/${projectId}${search}`);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleSave = async () => {
    if (!project || !account) return;
    const res = await apiRequest<{ saved: boolean }>(`/api/projects/${project.id}/save`, { method: 'POST' });
    setProject((p) => (p ? { ...p, isSaved: res.saved } : p));
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQaError(null);
    try {
      await apiRequest(`/api/projects/${projectId}/questions`, {
        method: 'POST',
        body: { question: questionText },
      });
      setQuestionText('');
      await load();
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Could not post question.');
    }
  };

  const handleAnswerQuestion = async (qId: number) => {
    const answer = answerDrafts[qId] || '';
    if (!answer.trim()) return;
    await apiRequest(`/api/projects/${projectId}/questions/${qId}/answer`, {
      method: 'POST',
      body: { answer },
    });
    setAnswerDrafts((prev) => ({ ...prev, [qId]: '' }));
    await load();
  };

  const handleStatusChange = async (status: string) => {
    await apiRequest(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: { status, confirmedPublish: status === 'open' },
    });
    setNotice(`Project status updated to ${status}.`);
    await load();
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/reports', {
      method: 'POST',
      body: {
        targetType: 'project',
        targetId: projectId,
        reason: reportReason,
        details: reportDetails,
      },
    });
    setShowReport(false);
    setReportReason('');
    setReportDetails('');
    setNotice('Report submitted to platform moderation.');
  };

  if (loading) {
    return (
      <div className="max-w-[1180px] mx-auto px-4 py-12">
        <div className="h-64 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Project unavailable</h1>
        <p className="mt-2 text-sm text-[#B91C1C]">{error || 'Project not found.'}</p>
        <Link to="/marketplace" className="mt-5 inline-block text-sm font-semibold text-[#1E40AF] underline">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-4 text-xs text-[#667085]">
        <Link to="/marketplace" className="hover:text-[#101828]">Marketplace</Link>
        <span className="mx-2">/</span>
        <span>{project.categoryName}</span>
      </div>

      {notice && (
        <div className="mb-6 p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#15803D]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Brief Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
              <StatusText status={project.status} />
              <span aria-hidden="true">·</span>
              <span>{project.categoryName}{project.subcategory ? ` / ${project.subcategory}` : ''}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{project.experienceLevel} level</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{project.workMode} ({project.location})</span>
              {project.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#B45309] font-medium">Demo Brief</span>
                </>
              )}
            </div>

            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-[#101828] tracking-tight">
              {project.title}
            </h1>

            <div className="mt-6 space-y-6 text-sm text-[#344054] leading-relaxed">
              <div>
                <h2 className="font-display text-base font-semibold text-[#101828] mb-2">Project Brief</h2>
                <p className="whitespace-pre-line">{project.brief}</p>
              </div>

              {project.scopeOfWork && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-2">Scope of Work</h2>
                  <p className="whitespace-pre-line">{project.scopeOfWork}</p>
                </div>
              )}

              {project.deliverables.length > 0 && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-2">Expected Deliverables</h2>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {project.deliverables.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {project.acceptanceCriteria && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-2">Acceptance Criteria</h2>
                  <p>{project.acceptanceCriteria}</p>
                </div>
              )}

              <div className="pt-5 border-t border-[#E4E7EC] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#101828]">Required Skills</p>
                  <p className="mt-1 text-[#475467]">
                    {project.requiredSkills.length > 0 ? project.requiredSkills.join(' · ') : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[#101828]">Revision Expectations</p>
                  <p className="mt-1 text-[#475467]">{project.revisionPolicy}</p>
                </div>
              </div>

              {project.sampleRequested && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-1">
                    Sample / Work Test Disclosure
                  </h2>
                  <p className={`text-xs font-semibold ${project.samplePaid ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                    {project.samplePaid
                      ? 'Paid work test disclosed by client'
                      : 'Unpaid sample requested — review carefully before committing substantial time'}
                  </p>
                  {project.sampleDetails && <p className="mt-1.5 text-sm text-[#475467]">{project.sampleDetails}</p>}
                </div>
              )}

              {project.screeningQuestions.length > 0 && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-2">
                    Required Proposal Questions
                  </h2>
                  <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[#475467]">
                    {project.screeningQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}

              {(project.referenceFiles.length > 0 || project.referenceLinks.length > 0) && (
                <div className="pt-5 border-t border-[#E4E7EC]">
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-2">Reference Materials</h2>
                  <div className="space-y-2">
                    {project.referenceFiles.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPreviewFileId(f.id)}
                        className="flex items-center gap-2 text-xs font-medium text-[#1E40AF] hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        {f.fileName} ({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)
                      </button>
                    ))}
                    {project.referenceLinks.map((lnk, idx) => (
                      <a
                        key={idx}
                        href={lnk.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-medium text-[#1E40AF] hover:underline"
                      >
                        {lnk.label || lnk.url} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Public Clarification Q&A */}
          {project.allowPublicQa && (
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#101828]">Public Clarification Q&amp;A</h2>
                <p className="text-xs text-[#475467] mt-1">
                  Questions and answers help all applicants scope accurately. Direct contact information is automatically redacted.
                </p>
              </div>

              {project.questions.length === 0 ? (
                <p className="text-sm text-[#667085]">No clarification questions asked yet.</p>
              ) : (
                <div className="space-y-4">
                  {project.questions.map((qa) => (
                    <div key={qa.id} className="pb-4 border-b border-[#F2F4F7] last:border-b-0 space-y-2">
                      <p className="text-sm font-medium text-[#101828]">Q: {qa.question}</p>
                      <p className="text-xs text-[#667085]">Asked by {qa.authorName}</p>
                      {qa.answer ? (
                        <div className="pl-4 py-2 bg-[#F8F9FB] rounded-lg text-sm text-[#344054]">
                          <strong>Client answer:</strong> {qa.answer}
                        </div>
                      ) : project.isOwner ? (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={answerDrafts[qa.id] || ''}
                            onChange={(e) => setAnswerDrafts((p) => ({ ...p, [qa.id]: e.target.value }))}
                            placeholder="Write public answer for all applicants..."
                            className="flex-1 px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleAnswerQuestion(qa.id)}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#101828] rounded-lg"
                          >
                            Post Answer
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[#667085]">Awaiting client response</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {account && !project.isOwner && project.status === 'open' && (
                <form onSubmit={handleAskQuestion} className="pt-3 border-t border-[#E4E7EC] space-y-2">
                  {qaError && <p className="text-xs text-[#B91C1C]">{qaError}</p>}
                  <label htmlFor="ask-qa" className="block text-xs font-medium text-[#344054]">
                    Ask a public clarification question
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="ask-qa"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Clarify deliverables, stack, or timeline..."
                      className="flex-1 px-3.5 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg whitespace-nowrap"
                    >
                      Ask Question
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>

        {/* Right Sidebar: Budget, Action CTA, Client Card */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <div>
              <p className="text-xs text-[#667085]">
                {project.budgetType === 'hourly' ? 'Hourly Budget Range' : 'Fixed Project Budget'}
              </p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#101828]">
                {formatCurrency(project.budgetMin, project.currency)}–{formatCurrency(project.budgetMax, project.currency)}
                {project.budgetType === 'hourly' ? '/hr' : ''}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 pt-4 border-t border-[#E4E7EC] text-xs">
              <div>
                <dt className="text-[#667085]">Target Deadline</dt>
                <dd className="font-mono text-[#101828] font-medium mt-0.5">{project.deadline || 'Flexible'}</dd>
              </div>
              <div>
                <dt className="text-[#667085]">Proposal Cutoff</dt>
                <dd className="font-mono text-[#101828] font-medium mt-0.5">{project.proposalDeadline || 'Open'}</dd>
              </div>
              <div>
                <dt className="text-[#667085]">Duration</dt>
                <dd className="text-[#101828] font-medium mt-0.5">{project.estimatedDuration || 'Scoped'}</dd>
              </div>
              <div>
                <dt className="text-[#667085]">Proposals</dt>
                <dd className="font-mono text-[#101828] font-medium mt-0.5">{project.proposalCount} submitted</dd>
              </div>
            </dl>

            {/* Primary Action Area */}
            <div className="pt-4 border-t border-[#E4E7EC] space-y-2.5">
              {project.myWorkspaceId ? (
                <Link
                  to={`/workspace/${project.myWorkspaceId}`}
                  className="block w-full text-center py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                >
                  Open Private Workspace
                </Link>
              ) : project.myContract ? (
                <Link
                  to={`/contracts/${project.myContract.id}`}
                  className="block w-full text-center py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                >
                  Review &amp; Accept Offer Terms
                </Link>
              ) : project.isOwner ? (
                <>
                  <Link
                    to={`/projects/${project.id}/applications`}
                    className="block w-full text-center py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                  >
                    Manage Applications ({project.proposalCount})
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/post-project?edit=${project.id}`}
                      className="text-center py-2 px-3 text-xs font-semibold text-[#101828] border border-[#D0D5DD] rounded-lg hover:bg-[#F8F9FB]"
                    >
                      Edit Brief
                    </Link>
                    {project.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('paused')}
                        className="py-2 px-3 text-xs font-semibold text-[#B45309] border border-[#D0D5DD] rounded-lg hover:bg-[#F8F9FB]"
                      >
                        Pause Brief
                      </button>
                    ) : project.status === 'paused' || project.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('open')}
                        className="py-2 px-3 text-xs font-semibold text-[#15803D] border border-[#D0D5DD] rounded-lg hover:bg-[#F8F9FB]"
                      >
                        Publish / Resume
                      </button>
                    ) : null}
                  </div>
                  {project.status !== 'cancelled' && project.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('cancelled')}
                      className="w-full py-2 text-xs font-medium text-[#B91C1C] hover:underline"
                    >
                      Cancel Project
                    </button>
                  )}
                </>
              ) : project.myProposal ? (
                <div className="p-3.5 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] text-xs space-y-1">
                  <p className="font-semibold text-[#101828]">
                    Your proposal is <StatusText status={project.myProposal.status} />
                  </p>
                  <p className="text-[#475467] font-mono">
                    Bid: {formatCurrency(project.myProposal.proposedPrice, project.myProposal.currency)}
                  </p>
                  {project.myProposal.infoRequestNote && (
                    <p className="text-[#B45309] mt-1">Client note: {project.myProposal.infoRequestNote}</p>
                  )}
                </div>
              ) : account ? (
                project.status === 'open' ? (
                  account.user.canSell ? (
                    <Link
                      to={`/projects/${project.id}/apply`}
                      className="block w-full text-center py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                    >
                      Submit Proposal
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/onboarding')}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-[#101828] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg"
                    >
                      Enable Freelancer Role to Apply
                    </button>
                  )
                ) : (
                  <p className="text-xs text-[#667085]">This brief is no longer accepting new proposals.</p>
                )
              ) : (
                <Link
                  to="/auth"
                  className="block w-full text-center py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                >
                  Sign In to Apply
                </Link>
              )}

              {account && !project.isOwner && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475467] hover:text-[#101828]"
                  >
                    <Bookmark className="w-3.5 h-3.5" fill={project.isSaved ? 'currentColor' : 'none'} />
                    {project.isSaved ? 'Saved' : 'Save Project'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReport((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-[#667085] hover:text-[#B91C1C]"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report Brief
                  </button>
                </div>
              )}
            </div>
          </div>

          {showReport && (
            <form onSubmit={handleReport} className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#101828]">Report this brief</h3>
              <input
                required
                placeholder="Reason (e.g. Unclear scope, suspicious terms)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
              />
              <textarea
                required
                rows={3}
                placeholder="Details for moderation review..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
              />
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#B91C1C] rounded-lg">
                Submit Report
              </button>
            </form>
          )}

          {/* Client Card */}
          <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
            <p className="text-xs font-medium text-[#667085]">Posted by Client</p>
            <div className="flex items-center gap-3">
              <Avatar name={project.buyer.name} src={project.buyer.avatarUrl} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#101828] truncate">{project.buyer.organizationName}</p>
                <p className="text-xs text-[#667085]">
                  {project.buyer.name} · {project.buyer.emailVerified ? 'Verified email' : 'Unverified'}
                </p>
              </div>
            </div>
            {project.buyer.description && (
              <p className="text-xs text-[#475467] leading-relaxed">{project.buyer.description}</p>
            )}
            <p className="text-xs text-[#667085]">
              {project.buyer.industry}{project.buyer.location ? ` · ${project.buyer.location}` : ''}
            </p>
          </div>
        </aside>
      </div>

      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
}
