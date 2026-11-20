import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Lock, MessageSquare } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { Avatar, StatusText } from '../components/Layout';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatCurrency } from '../utils/domain';

interface ApplicationRow {
  id: number;
  sellerId: number;
  coverLetter: string;
  proposedPrice: number;
  pricingType: string;
  currency: string;
  estimatedTimeline: string;
  availability: string;
  answers: Array<{ question: string; answer: string }>;
  milestonePlan: Array<{ title: string; deliverables: string; amount: number; dueOffsetDays: number }>;
  sampleNote: string;
  status: string;
  declineReason: string | null;
  infoRequestNote: string | null;
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    headline: string;
    skills: string[];
    hourlyRate: number | null;
    location: string;
    availability: string;
    avgRating: number | null;
    reviewCount: number;
  };
  cvFile: { id: number; fileName: string; sizeBytes: number } | null;
  sampleFile: { id: number; fileName: string; sizeBytes: number } | null;
  portfolio: Array<{ id: number; title: string; description: string; rolePerformed: string; toolsUsed: string[] }>;
  contract: { id: number; status: string } | null;
}

interface ProjectSummary {
  id: number;
  title: string;
  scopeOfWork: string;
  deliverables: string[];
  deadline: string;
  revisionPolicy: string;
}

export function ApplicationsPage({ projectId }: { projectId: number }) {
  const { navigate } = useRouter();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);

  // Action drawers
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [infoNote, setInfoNote] = useState('');
  const [showInfoReq, setShowInfoReq] = useState(false);
  const [dmBody, setDmBody] = useState('');
  const [showDm, setShowDm] = useState(false);
  const [showHire, setShowHire] = useState(false);
  const [hireScope, setHireScope] = useState('');
  const [hirePrice, setHirePrice] = useState('');
  const [hireDeadline, setHireDeadline] = useState('');
  const [hireRevision, setHireRevision] = useState('');
  const [hireResp, setHireResp] = useState(
    'Client provides timely feedback within 2 business days and approves milestone deliverables. Freelancer completes agreed deliverables inside the private project workspace.'
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ project: ProjectSummary; applications: ApplicationRow[] }>(
        `/api/projects/${projectId}/applications`
      );
      setProject(data.project);
      setApps(data.applications);
      if (data.applications.length > 0 && !selectedId) {
        setSelectedId(data.applications[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = apps.find((a) => a.id === selectedId) || apps[0] || null;

  const openHireForm = (app: ApplicationRow) => {
    setHireScope(project?.scopeOfWork || 'Agreed project brief scope and milestone deliverables.');
    setHirePrice(String(app.proposedPrice));
    setHireDeadline(project?.deadline || '');
    setHireRevision(project?.revisionPolicy || 'Up to 2 revision rounds per milestone included.');
    setShowHire(true);
    setShowDecline(false);
    setShowInfoReq(false);
  };

  const updateStatus = async (proposalId: number, status: string, extra: Record<string, string> = {}) => {
    setError(null);
    try {
      await apiRequest(`/api/proposals/${proposalId}/status`, {
        method: 'PATCH',
        body: { status, ...extra },
      });
      setNotice(`Application marked as "${status.replace('_', ' ')}".`);
      setShowDecline(false);
      setShowInfoReq(false);
      setDeclineReason('');
      setInfoNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update application.');
    }
  };

  const sendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !dmBody.trim()) return;
    await apiRequest('/api/messages', {
      method: 'POST',
      body: {
        projectId,
        proposalId: selected.id,
        recipientId: selected.sellerId,
        body: dmBody,
      },
    });
    setDmBody('');
    setShowDm(false);
    setNotice(`Direct message sent to ${selected.seller.name}.`);
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      const contract = await apiRequest<{ id: number }>(`/api/proposals/${selected.id}/hire`, {
        method: 'POST',
        body: {
          agreedScope: hireScope,
          agreedDeliverables: project?.deliverables || [],
          agreedPrice: Number(hirePrice),
          deadline: hireDeadline,
          revisionPolicy: hireRevision,
          responsibilities: hireResp,
        },
      });
      navigate(`/contracts/${contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send offer.');
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-sm text-[#475467]">Loading applications...</div>;
  if (error && !project) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Access restricted</h1>
        <p className="mt-2 text-sm text-[#B91C1C]">{error}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#1E40AF] underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link to={`/projects/${projectId}`} className="text-xs text-[#667085] hover:text-[#101828]">
            ← Back to Project Brief
          </Link>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#101828]">
            Applications &amp; Candidate Comparison
          </h1>
          <p className="text-sm text-[#475467] mt-1">{project?.title}</p>
        </div>
        <span className="font-mono tabular-nums text-xs text-[#667085]">{apps.length} total applicants</span>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] text-sm text-[#15803D]">
          {notice}
        </div>
      )}

      {apps.length === 0 ? (
        <div className="bg-white border border-[#E4E7EC] rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-[#101828]">No proposals received yet</h2>
          <p className="text-sm text-[#475467] mt-1">
            As freelancers submit proposals, you can compare bids, inspect private CVs, shortlist, and send offers here.
          </p>
        </div>
      ) : (
        <>
          {/* Side-by-side comparison table */}
          <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E4E7EC] text-xs text-[#667085] bg-[#F8F9FB]">
                  <th className="py-3 px-4 font-semibold">Candidate</th>
                  <th className="py-3 px-4 font-semibold text-right">Proposed Price</th>
                  <th className="py-3 px-4 font-semibold">Timeline</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const isSel = selected?.id === app.id;
                  return (
                    <tr
                      key={app.id}
                      className={`border-b border-[#F2F4F7] last:border-b-0 ${isSel ? 'bg-[#EEF2FF]/50' : 'hover:bg-[#F8F9FB]'}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={app.seller.name} src={app.seller.avatarUrl} size="sm" />
                          <div>
                            <p className="font-semibold text-[#101828]">{app.seller.name}</p>
                            <p className="text-xs text-[#667085] truncate max-w-[240px]">{app.seller.headline}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#101828]">
                        {formatCurrency(app.proposedPrice, app.currency)}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#344054]">{app.estimatedTimeline}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#344054]">
                        {app.seller.avgRating ? `${app.seller.avgRating} / 5 (${app.seller.reviewCount})` : 'New'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <StatusText status={app.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(app.id);
                            setShowHire(false);
                            setShowDecline(false);
                            setShowInfoReq(false);
                          }}
                          className="text-xs font-semibold text-[#1E40AF] hover:underline"
                        >
                          {isSel ? 'Viewing' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selected Candidate Full Review Panel */}
          {selected && (
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E4E7EC]">
                <div className="flex items-center gap-4">
                  <Avatar name={selected.seller.name} src={selected.seller.avatarUrl} size="lg" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold text-[#101828]">{selected.seller.name}</h2>
                      <span aria-hidden="true" className="text-[#667085]">·</span>
                      <span className="text-xs"><StatusText status={selected.status} /></span>
                    </div>
                    <p className="text-sm text-[#475467]">{selected.seller.headline}</p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      {selected.seller.location || 'Remote'} · Skills: {selected.seller.skills.join(', ')} ·{' '}
                      <Link to={`/sellers/${selected.seller.id}`} className="text-[#1E40AF] hover:underline">
                        Open Public Profile
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Buyer Selection Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {selected.contract ? (
                    <Link
                      to={`/contracts/${selected.contract.id}`}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg"
                    >
                      View Contract ({selected.contract.status.replace('_', ' ')})
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openHireForm(selected)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                      >
                        Select &amp; Send Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(selected.id, 'shortlisted')}
                        className="px-3.5 py-2 text-xs font-semibold text-[#15803D] border border-[#BBF7D0] bg-[#F0FDF4] rounded-lg"
                      >
                        Shortlist
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInfoReq((v) => !v)}
                        className="px-3.5 py-2 text-xs font-semibold text-[#344054] border border-[#D0D5DD] rounded-lg"
                      >
                        Request Info / Sample
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDm((v) => !v)}
                        className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-[#344054] border border-[#D0D5DD] rounded-lg"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Message
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDecline((v) => !v)}
                        className="px-3.5 py-2 text-xs font-semibold text-[#B91C1C] border border-[#FECACA] rounded-lg"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Action Forms */}
              {showInfoReq && (
                <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] space-y-2">
                  <label htmlFor="info-note" className="block text-xs font-semibold text-[#92400E]">
                    Request additional details or paid sample from {selected.seller.name}
                  </label>
                  <textarea
                    id="info-note"
                    rows={2}
                    value={infoNote}
                    onChange={(e) => setInfoNote(e.target.value)}
                    placeholder="Specify what clarification or sample exercise you would like..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, 'info_requested', { infoRequestNote: infoNote })}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#B45309] rounded-lg"
                  >
                    Send Request
                  </button>
                </div>
              )}

              {showDm && (
                <form onSubmit={sendDirectMessage} className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] space-y-2">
                  <label htmlFor="dm-applicant" className="block text-xs font-semibold text-[#101828]">
                    Message {selected.seller.name} directly
                  </label>
                  <textarea
                    id="dm-applicant"
                    required
                    rows={2}
                    value={dmBody}
                    onChange={(e) => setDmBody(e.target.value)}
                    placeholder="Ask a follow-up question or schedule a scoping chat..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                  />
                  <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#101828] rounded-lg">
                    Send Message
                  </button>
                </form>
              )}

              {showDecline && (
                <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                  <label htmlFor="decline-reason" className="block text-xs font-semibold text-[#B91C1C]">
                    Private decline reason (visible only to you and platform admins — never shown to the applicant)
                  </label>
                  <input
                    id="decline-reason"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g. Budget exceeds Q4 allocation, missing PostgreSQL experience..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, 'declined', { declineReason })}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#B91C1C] rounded-lg"
                  >
                    Confirm Decline
                  </button>
                </div>
              )}

              {showHire && (
                <form onSubmit={handleSendOffer} className="p-6 rounded-xl bg-[#F8F9FB] border border-[#1E40AF]/30 space-y-4">
                  <h3 className="font-display text-base font-bold text-[#101828]">
                    Draft Hiring Offer &amp; Project Agreement for {selected.seller.name}
                  </h3>
                  <p className="text-xs text-[#475467]">
                    Both you and the freelancer must accept these terms before the contract becomes active and the private workspace is provisioned.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="hire-price" className="block text-xs font-medium text-[#344054] mb-1">
                        Agreed Price ({selected.currency})
                      </label>
                      <input
                        id="hire-price"
                        type="number"
                        required
                        value={hirePrice}
                        onChange={(e) => setHirePrice(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D0D5DD] rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="hire-deadline" className="block text-xs font-medium text-[#344054] mb-1">
                        Agreed Deadline
                      </label>
                      <input
                        id="hire-deadline"
                        type="date"
                        value={hireDeadline}
                        onChange={(e) => setHireDeadline(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D0D5DD] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="hire-scope" className="block text-xs font-medium text-[#344054] mb-1">
                      Agreed Scope Summary
                    </label>
                    <textarea
                      id="hire-scope"
                      required
                      rows={3}
                      value={hireScope}
                      onChange={(e) => setHireScope(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="hire-rev" className="block text-xs font-medium text-[#344054] mb-1">
                      Revision Policy
                    </label>
                    <input
                      id="hire-rev"
                      required
                      value={hireRevision}
                      onChange={(e) => setHireRevision(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="hire-resp" className="block text-xs font-medium text-[#344054] mb-1">
                      Mutual Responsibilities
                    </label>
                    <textarea
                      id="hire-resp"
                      required
                      rows={2}
                      value={hireResp}
                      onChange={(e) => setHireResp(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowHire(false)} className="px-4 py-2 text-xs text-[#475467]">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                    >
                      Confirm &amp; Send Offer to Freelancer
                    </button>
                  </div>
                </form>
              )}

              {/* Proposal Details */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[#101828]">Cover Letter</h3>
                    <p className="mt-2 text-sm text-[#344054] leading-relaxed whitespace-pre-line">{selected.coverLetter}</p>
                  </div>

                  {selected.answers.length > 0 && (
                    <div className="pt-4 border-t border-[#E4E7EC] space-y-3">
                      <h3 className="text-sm font-semibold text-[#101828]">Screening Answers</h3>
                      {selected.answers.map((a, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium text-[#101828]">{a.question}</p>
                          <p className="text-[#475467] mt-1">{a.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {selected.milestonePlan.length > 0 && (
                    <div className="pt-4 border-t border-[#E4E7EC] space-y-2">
                      <h3 className="text-sm font-semibold text-[#101828]">Proposed Milestone Plan</h3>
                      <div className="divide-y divide-[#F2F4F7] border border-[#E4E7EC] rounded-lg">
                        {selected.milestonePlan.map((m, i) => (
                          <div key={i} className="p-3 flex items-center justify-between gap-4 text-xs">
                            <div>
                              <p className="font-semibold text-[#101828]">{m.title}</p>
                              <p className="text-[#475467]">{m.deliverables}</p>
                            </div>
                            <span className="font-mono tabular-nums font-semibold text-[#101828]">
                              {formatCurrency(m.amount, selected.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.declineReason && (
                    <div className="p-3 rounded-lg bg-[#FEF2F2] text-xs text-[#B91C1C]">
                      <strong>Private decline note:</strong> {selected.declineReason}
                    </div>
                  )}
                </div>

                {/* Private CV, Sample & Portfolio Column */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="p-4 rounded-xl bg-[#F8F9FB] border border-[#E4E7EC] space-y-3">
                    <h3 className="text-xs font-semibold text-[#101828] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#1E40AF]" /> Private Credentials &amp; Samples
                    </h3>
                    {selected.cvFile ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFileId(selected.cvFile!.id)}
                        className="w-full flex items-center justify-between p-2.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#101828] hover:border-[#1E40AF]"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                          <span className="truncate">{selected.cvFile.fileName}</span>
                        </span>
                        <span className="font-semibold text-[#1E40AF] ml-2 shrink-0">View CV</span>
                      </button>
                    ) : (
                      <p className="text-xs text-[#667085]">No CV attached.</p>
                    )}

                    {selected.sampleFile && (
                      <button
                        type="button"
                        onClick={() => setPreviewFileId(selected.sampleFile!.id)}
                        className="w-full flex items-center justify-between p-2.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#101828] hover:border-[#1E40AF]"
                      >
                        <span className="truncate">{selected.sampleFile.fileName}</span>
                        <span className="font-semibold text-[#1E40AF] ml-2 shrink-0">View Sample</span>
                      </button>
                    )}
                    {selected.sampleNote && <p className="text-xs text-[#475467]">Note: {selected.sampleNote}</p>}
                  </div>

                  {selected.portfolio.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-[#101828]">Attached Portfolio</h3>
                      {selected.portfolio.map((p) => (
                        <div key={p.id} className="p-3.5 rounded-lg border border-[#E4E7EC] text-xs space-y-1">
                          <p className="font-semibold text-[#101828]">{p.title}</p>
                          <p className="text-[#667085]">{p.rolePerformed} · {p.toolsUsed.join(', ')}</p>
                          <p className="text-[#475467]">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
}
