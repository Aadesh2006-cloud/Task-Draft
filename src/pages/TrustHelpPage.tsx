import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileLock2, Scale, HelpCircle, MessageSquareWarning, CheckCircle2 } from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';

type TrustTab = 'overview' | 'terms' | 'privacy' | 'contact';

export function TrustHelpPage() {
  const { search } = useRouter();
  const { account } = useAuth();
  const [tab, setTab] = useState<TrustTab>('overview');

  // Dispute / report form state
  const [targetType, setTargetType] = useState<'project' | 'user' | 'proposal' | 'review' | 'workspace_dispute'>('workspace_dispute');
  const [targetId, setTargetId] = useState('1');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const requested = params.get('tab');
    if (requested === 'terms' || requested === 'privacy' || requested === 'contact' || requested === 'overview') {
      setTab(requested);
    }
  }, [search]);

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittedId(null);
    const parsedId = Number(targetId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setError('Enter a valid positive numeric reference ID.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiRequest<{ id: number }>('/api/reports', {
        method: 'POST',
        body: {
          targetType,
          targetId: parsedId,
          reason: reason.trim(),
          details: details.trim(),
        },
      });
      setSubmittedId(created.id);
      setReason('');
      setDetails('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit report right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#101828]">
          Trust, Safety &amp; Platform Policies
        </h1>
        <p className="mt-2 text-[#475467] leading-relaxed">
          How Briefline enforces private workspace isolation, protects candidate CVs and work samples, governs agreements, and handles disputes.
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="mt-8 border-b border-[#E4E7EC] flex flex-wrap gap-6 text-sm font-medium">
        {(
          [
            { id: 'overview', label: 'How Trust Works' },
            { id: 'terms', label: 'Terms of Service' },
            { id: 'privacy', label: 'Privacy & File Access' },
            { id: 'contact', label: 'Contact & Disputes' },
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

      {tab === 'overview' && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
              <FileLock2 className="w-5 h-5 text-[#1E40AF]" />
              <h2 className="mt-4 font-display text-base font-semibold text-[#101828]">
                Private-by-Default Documents
              </h2>
              <p className="mt-2 text-sm text-[#475467] leading-relaxed">
                Resumes, CVs, and proposal work samples are never publicly downloadable. Only the owner, the buyer of a project the freelancer applied to, or authorized platform admins can access them via server-verified endpoints.
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
              <ShieldCheck className="w-5 h-5 text-[#1E40AF]" />
              <h2 className="mt-4 font-display text-base font-semibold text-[#101828]">
                Dual-Party Project Agreements
              </h2>
              <p className="mt-2 text-sm text-[#475467] leading-relaxed">
                Before any workspace opens, both the buyer and selected freelancer must confirm scope, deliverables, price, milestones, and revision count. Scope changes require formal written approval.
              </p>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
              <Scale className="w-5 h-5 text-[#1E40AF]" />
              <h2 className="mt-4 font-display text-base font-semibold text-[#101828]">
                Verified Delivery Reviews
              </h2>
              <p className="mt-2 text-sm text-[#475467] leading-relaxed">
                Ratings and written reviews can only be submitted after a contracted workspace is marked completed. Unrelated accounts cannot leave feedback on completed work.
              </p>
            </div>
          </div>

          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" />
              <div className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-[#101828]">
                  Frequently Asked Questions
                </h2>
                <div className="divide-y divide-[#E4E7EC]">
                  <div className="py-4 first:pt-0">
                    <h3 className="text-sm font-semibold text-[#101828]">
                      Can I use one account to both hire freelancers and apply to projects?
                    </h3>
                    <p className="mt-1 text-sm text-[#475467]">
                      Yes. Enable both Buyer and Seller capabilities in your Profile &amp; Account settings and switch active modes at any time without maintaining separate logins.
                    </p>
                  </div>
                  <div className="py-4">
                    <h3 className="text-sm font-semibold text-[#101828]">
                      Who can view messages, tasks, and files inside a Project Workspace?
                    </h3>
                    <p className="mt-1 text-sm text-[#475467]">
                      Every private workspace checks participant identity on every API request. Only the project buyer, the hired freelancer, and authorized administrators reviewing a dispute can view or modify workspace records.
                    </p>
                  </div>
                  <div className="py-4">
                    <h3 className="text-sm font-semibold text-[#101828]">
                      What is Briefline&apos;s policy on work samples and tests?
                    </h3>
                    <p className="mt-1 text-sm text-[#475467]">
                      Buyers must explicitly disclose whether a sample or test is requested and whether it is paid or unpaid. Briefline strongly recommends paid work tests for any effort exceeding 30 minutes and prohibits requesting production deliverables as unpaid tests.
                    </p>
                  </div>
                  <div className="py-4 last:pb-0">
                    <h3 className="text-sm font-semibold text-[#101828]">
                      Are milestone payments real money in this environment?
                    </h3>
                    <p className="mt-1 text-sm text-[#475467]">
                      No. Milestone funding, authorization, and release actions operate as a clearly labeled Development Demo Payment Flow. Briefline does not store raw payment card numbers or hold real escrow funds in this environment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'terms' && (
        <div className="mt-8 bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6 text-sm text-[#475467] leading-relaxed">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#101828]">Terms of Service Summary</h2>
            <p className="mt-1 text-xs text-[#667085]">Effective for independent marketplace engagements on Briefline</p>
          </div>
          <div>
            <h3 className="font-semibold text-[#101828]">1. Marketplace Role &amp; Independent Contractors</h3>
            <p className="mt-1">
              Briefline provides project discovery, structured proposal evaluation, contract confirmation, and private collaboration workspaces. Freelancers act as independent professionals rather than employees of Briefline or of buyers.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#101828]">2. Scope, Revisions &amp; Change Requests</h3>
            <p className="mt-1">
              Deliverables, revision allowances, and acceptance criteria are recorded in the bilateral project agreement before work begins. Additional deliverables or timeline adjustments should be proposed and mutually accepted through the Workspace Scope Change log.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#101828]">3. Payment Mode Disclosure</h3>
            <p className="mt-1">
              In this deployment, milestone funding and release actions are simulated using a Development Demo Flow for workflow tracking and receipt previews. Production deployments must integrate a PCI-compliant third-party payment processor (such as Stripe Connect) before processing live client funds.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#101828]">4. Fair Conduct &amp; Moderation</h3>
            <p className="mt-1">
              Spam briefs, misleading credentials, harassment, off-platform credential harvesting, or unpaid production work disguised as screening tests violate platform standards and may result in project suspension or account restriction.
            </p>
          </div>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="mt-8 bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6 text-sm text-[#475467] leading-relaxed">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#101828]">Privacy &amp; File Access Architecture</h2>
            <p className="mt-1 text-xs text-[#667085]">Server-side authorization rules enforced across all endpoints</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[#E4E7EC] rounded-lg p-5">
              <h3 className="font-semibold text-[#101828]">CVs &amp; Candidate Resumes</h3>
              <p className="mt-1.5">
                Stored privately and served only after authenticating the requester. Authorized viewers are limited to the freelancer themselves, buyers who have received an active proposal from that freelancer, and platform admins.
              </p>
            </div>
            <div className="border border-[#E4E7EC] rounded-lg p-5">
              <h3 className="font-semibold text-[#101828]">Proposal Work Samples</h3>
              <p className="mt-1.5">
                Scoped to the specific proposal. Unrelated freelancers, unauthenticated visitors, and buyers of other projects receive a 403 Forbidden response if they attempt to download the file.
              </p>
            </div>
            <div className="border border-[#E4E7EC] rounded-lg p-5">
              <h3 className="font-semibold text-[#101828]">Workspace Deliverables &amp; Messages</h3>
              <p className="mt-1.5">
                Every workspace endpoint verifies that the authenticated user is the workspace buyer, the hired freelancer, or an admin. Files are versioned and validated for size and MIME type before storage.
              </p>
            </div>
            <div className="border border-[#E4E7EC] rounded-lg p-5">
              <h3 className="font-semibold text-[#101828]">Private Decline Reasons</h3>
              <p className="mt-1.5">
                When a buyer declines an applicant and records an internal reason, that note is stored privately for the buyer and platform auditors and is not broadcast publicly.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'contact' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <MessageSquareWarning className="w-5 h-5 text-[#1E40AF]" />
              <h2 className="font-display text-lg font-semibold text-[#101828]">
                Submit a Safety Report or Workspace Dispute
              </h2>
            </div>
            <p className="mt-2 text-sm text-[#475467]">
              Reports are routed directly to the Briefline Admin Moderation Queue with an audit trail.
            </p>

            {!account ? (
              <div className="mt-6 border border-[#E4E7EC] rounded-lg p-5 bg-[#F8F9FB]">
                <p className="text-sm text-[#344054]">
                  Sign in to submit a verified report or dispute so our team can trace your account and respond in your notifications.
                </p>
                <Link
                  to="/auth"
                  className="mt-4 inline-flex px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                >
                  Sign In to Continue
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="mt-6 space-y-5">
                {error && (
                  <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#B91C1C]">
                    {error}
                  </div>
                )}
                {submittedId !== null && (
                  <div className="p-4 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#15803D] flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Report #{submittedId} logged and assigned to the moderation queue.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="report-target-type" className="block text-sm font-medium text-[#344054] mb-1.5">
                      Report Category
                    </label>
                    <select
                      id="report-target-type"
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value as typeof targetType)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF]"
                    >
                      <option value="workspace_dispute">Workspace / Delivery Dispute</option>
                      <option value="project">Project Brief Policy Issue</option>
                      <option value="user">User Conduct / Account Issue</option>
                      <option value="proposal">Proposal Abuse or Spam</option>
                      <option value="review">Review Integrity Concern</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="report-target-id" className="block text-sm font-medium text-[#344054] mb-1.5">
                      Reference ID (Workspace, Project, or User #)
                    </label>
                    <input
                      id="report-target-id"
                      type="number"
                      min={1}
                      required
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D0D5DD] rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="report-reason" className="block text-sm font-medium text-[#344054] mb-1.5">
                    Short Summary
                  </label>
                  <input
                    id="report-reason"
                    type="text"
                    required
                    minLength={4}
                    maxLength={160}
                    placeholder="e.g., Missed agreed milestone acceptance criteria"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF]"
                  />
                </div>

                <div>
                  <label htmlFor="report-details" className="block text-sm font-medium text-[#344054] mb-1.5">
                    Full Context &amp; Evidence
                  </label>
                  <textarea
                    id="report-details"
                    rows={5}
                    required
                    minLength={10}
                    maxLength={2000}
                    placeholder="Include dates, agreed scope references, and what resolution you are requesting..."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Report to Trust Team'}
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-sm space-y-3">
              <h3 className="font-display font-semibold text-[#101828]">Dispute Resolution Steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-[#475467]">
                <li>Document any deliverable gap inside the workspace Revision Feedback log first.</li>
                <li>If alignment stalls, submit a dispute with the workspace ID and milestone reference.</li>
                <li>An authorized administrator reviews the contract, versioned files, and message timeline.</li>
                <li>Resolution actions and status updates are recorded in the permanent audit log.</li>
              </ol>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-sm">
              <h3 className="font-display font-semibold text-[#101828]">Direct Support</h3>
              <p className="mt-1.5 text-[#475467]">
                Response target: within 1 business day for active workspace disputes and account security notices.
              </p>
              <p className="mt-3 font-mono text-xs text-[#344054]">trust@briefline.example</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
