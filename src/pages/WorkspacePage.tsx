import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Star,
  Upload,
} from 'lucide-react';
import { apiRequest, fileToBase64 } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';
import { Avatar, StatusText } from '../components/Layout';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatCurrency } from '../utils/domain';

interface WorkspacePayload {
  workspace: {
    id: number;
    contractId: number;
    projectId: number;
    buyerId: number;
    sellerId: number;
    status: string;
    handoverNotes: string;
    handoverLinks: Array<{ label: string; url: string }>;
    finalSubmittedAt: string | null;
    completedAt: string | null;
  };
  contract: {
    id: number;
    agreedScope: string;
    agreedDeliverables: string[];
    agreedPrice: number;
    pricingType: string;
    currency: string;
    deadline: string;
    revisionPolicy: string;
    responsibilities: string;
    status: string;
  };
  project: {
    id: number;
    title: string;
    brief: string;
    acceptanceCriteria: string;
    deliverables: string[];
  } | null;
  buyer: { id: number; name: string; email: string; avatarUrl: string | null } | null;
  seller: { id: number; name: string; email: string; avatarUrl: string | null } | null;
  messages: Array<{
    id: number;
    senderId: number;
    senderName: string;
    senderAvatar: string | null;
    body: string;
    readByBuyer: boolean;
    readBySeller: boolean;
    createdAt: string;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'in_review' | 'completed';
    priority: 'low' | 'medium' | 'high';
    assigneeId: number | null;
    dueDate: string;
    comments: Array<{ id: string; authorId: number; authorName: string; body: string; createdAt: string }>;
  }>;
  milestones: Array<{
    id: number;
    title: string;
    deliverables: string;
    amount: number;
    currency: string;
    dueDate: string;
    status: string;
    paymentStatus: string;
    invoiceNumber: string | null;
    submittedNote: string;
    feedbackNote: string;
  }>;
  files: Array<{
    id: number;
    ownerId: number;
    ownerName: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    version: number;
    createdAt: string;
  }>;
  changeRequests: Array<{
    id: number;
    requesterId: number;
    requesterName: string;
    title: string;
    description: string;
    scopeType: 'included_in_scope' | 'revised_terms';
    priceDelta: number;
    revisedDeadline: string | null;
    status: string;
    responseNote: string;
    createdAt: string;
  }>;
  submissions: Array<{
    id: number;
    milestoneId: number | null;
    submissionType: 'milestone' | 'final_handover';
    summary: string;
    deliverableLinks: Array<{ label: string; url: string }>;
    fileIds: number[];
    status: string;
    buyerFeedback: string;
    createdAt: string;
  }>;
  activityEvents: Array<{
    id: number;
    actorName: string;
    eventType: string;
    summary: string;
    createdAt: string;
  }>;
  reviews: Array<{
    id: number;
    reviewerId: number;
    reviewerName: string;
    reviewerRole: string;
    ratingOverall: number;
    ratingCommunication: number;
    ratingQuality: number;
    ratingReliability: number;
    ratingProfessionalism: number;
    comment: string;
    createdAt: string;
  }>;
  reviewEligibility: { allowed: boolean; reason?: string };
}

type WsTab = 'overview' | 'messages' | 'tasks' | 'milestones' | 'files' | 'changes' | 'submissions';

export function WorkspacePage({ workspaceId }: { workspaceId: number }) {
  const { account } = useAuth();
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WsTab>('overview');
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);

  // Message state
  const [msgText, setMsgText] = useState('');

  // Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDue, setTaskDue] = useState('');
  const [taskCommentDrafts, setTaskCommentDrafts] = useState<Record<number, string>>({});

  // Milestone add
  const [msTitle, setMsTitle] = useState('');
  const [msDeliverables, setMsDeliverables] = useState('');
  const [msAmount, setMsAmount] = useState('');
  const [msDue, setMsDue] = useState('');
  const [invoiceModalMs, setInvoiceModalMs] = useState<WorkspacePayload['milestones'][number] | null>(null);

  // File upload
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Change request form
  const [crTitle, setCrTitle] = useState('');
  const [crDesc, setCrDesc] = useState('');
  const [crScope, setCrScope] = useState<'included_in_scope' | 'revised_terms'>('included_in_scope');
  const [crPriceDelta, setCrPriceDelta] = useState('0');
  const [crDeadline, setCrDeadline] = useState('');

  // Submission form (seller)
  const [subType, setSubType] = useState<'milestone' | 'final_handover'>('milestone');
  const [subMilestoneId, setSubMilestoneId] = useState<string>('');
  const [subSummary, setSubSummary] = useState('');
  const [subLinkUrl, setSubLinkUrl] = useState('');
  const [subLinkLabel, setSubLinkLabel] = useState('');
  const [reviewFeedbackDrafts, setReviewFeedbackDrafts] = useState<Record<number, string>>({});

  // Structured review form
  const [rComm, setRComm] = useState(5);
  const [rQual, setRQual] = useState(5);
  const [rRel, setRRel] = useState(5);
  const [rProf, setRProf] = useState(5);
  const [rComment, setRComment] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiRequest<WorkspacePayload>(`/api/workspaces/${workspaceId}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to access private workspace.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    load();
  }, [account, load]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Lock className="w-8 h-8 text-[#1E40AF] mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-[#101828]">Private Workspace Sign-In Required</h1>
        <p className="mt-2 text-sm text-[#475467]">
          Workspace messages, tasks, files, and deliverables are strictly private to authorized project participants.
        </p>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-12">
        <div className="h-72 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <Lock className="w-8 h-8 text-[#B91C1C] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#101828]">Private Workspace Access Denied</h1>
        <p role="alert" className="text-sm text-[#B91C1C]">
          {error || 'You do not have permission to view this project room.'}
        </p>
        <Link to="/workspaces" className="inline-block text-sm font-semibold text-[#1E40AF] underline">
          View Your Authorized Workspaces
        </Link>
      </div>
    );
  }

  const { workspace, contract, project, buyer, seller } = data;
  const isBuyer = account.user.id === workspace.buyerId;
  const isSeller = account.user.id === workspace.sellerId;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    await apiRequest(`/api/workspaces/${workspace.id}/messages`, {
      method: 'POST',
      body: { body: msgText },
    });
    setMsgText('');
    await load();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await apiRequest(`/api/workspaces/${workspace.id}/tasks`, {
      method: 'POST',
      body: {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        dueDate: taskDue,
        assigneeId: workspace.sellerId,
      },
    });
    setTaskTitle('');
    setTaskDesc('');
    setTaskDue('');
    setNotice('Task added to workspace board.');
    await load();
  };

  const handleMoveTask = async (taskId: number, status: 'todo' | 'in_progress' | 'in_review' | 'completed') => {
    await apiRequest(`/api/workspaces/${workspace.id}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { status },
    });
    await load();
  };

  const handleTaskComment = async (taskId: number) => {
    const body = taskCommentDrafts[taskId] || '';
    if (!body.trim()) return;
    await apiRequest(`/api/workspaces/${workspace.id}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { body },
    });
    setTaskCommentDrafts((p) => ({ ...p, [taskId]: '' }));
    await load();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadProgress(25);
    try {
      const contentBase64 = await fileToBase64(file);
      setUploadProgress(70);
      await apiRequest('/api/files/upload', {
        method: 'POST',
        body: {
          scope: 'workspace',
          scopeRefId: workspace.id,
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          contentBase64,
        },
      });
      setUploadProgress(100);
      setNotice(`Uploaded "${file.name}" privately to this workspace.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setTimeout(() => setUploadProgress(null), 500);
      e.target.value = '';
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest(`/api/workspaces/${workspace.id}/milestones`, {
      method: 'POST',
      body: {
        title: msTitle,
        deliverables: msDeliverables,
        amount: Number(msAmount) || 0,
        dueDate: msDue,
      },
    });
    setMsTitle('');
    setMsDeliverables('');
    setMsAmount('');
    setMsDue('');
    setNotice('Milestone added.');
    await load();
  };

  const handleDemoPaymentAction = async (msId: number, paymentStatus: string) => {
    await apiRequest(`/api/workspaces/${workspace.id}/milestones/${msId}`, {
      method: 'PATCH',
      body: { paymentStatus },
    });
    setNotice('Demo billing status updated (no real funds moved).');
    await load();
  };

  const handleCreateChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest(`/api/workspaces/${workspace.id}/change-requests`, {
      method: 'POST',
      body: {
        title: crTitle,
        description: crDesc,
        scopeType: crScope,
        priceDelta: crScope === 'revised_terms' ? Number(crPriceDelta) || 0 : 0,
        revisedDeadline: crScope === 'revised_terms' ? crDeadline || null : null,
      },
    });
    setCrTitle('');
    setCrDesc('');
    setCrPriceDelta('0');
    setCrDeadline('');
    setNotice('Change request recorded.');
    await load();
  };

  const handleResolveChangeRequest = async (crId: number, status: 'approved' | 'declined') => {
    await apiRequest(`/api/workspaces/${workspace.id}/change-requests/${crId}`, {
      method: 'PATCH',
      body: { status },
    });
    setNotice(`Change request ${status}.`);
    await load();
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest(`/api/workspaces/${workspace.id}/submissions`, {
      method: 'POST',
      body: {
        submissionType: subType,
        milestoneId: subType === 'milestone' && subMilestoneId ? Number(subMilestoneId) : null,
        summary: subSummary,
        deliverableLinks: subLinkUrl.trim() ? [{ label: subLinkLabel || 'Deliverable Link', url: subLinkUrl }] : [],
        fileIds: data.files.slice(0, 2).map((f) => f.id),
      },
    });
    setSubSummary('');
    setSubLinkUrl('');
    setSubLinkLabel('');
    setNotice(subType === 'final_handover' ? 'Final handover submitted for buyer approval.' : 'Deliverable submitted for review.');
    await load();
  };

  const handleReviewSubmission = async (
    subId: number,
    decision: 'approved' | 'revision_requested',
    completeProject = false
  ) => {
    setError(null);
    try {
      await apiRequest(`/api/workspaces/${workspace.id}/submissions/${subId}/review`, {
        method: 'POST',
        body: {
          decision,
          feedback: reviewFeedbackDrafts[subId] || '',
          completeProject,
        },
      });
      setNotice(
        completeProject
          ? 'Delivery approved and project marked completed! Mutual reviews are now unlocked.'
          : decision === 'approved'
          ? 'Deliverable approved.'
          : 'Revision requested with written feedback.'
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review action failed.');
    }
  };

  const handleStatusUpdate = async (status: string) => {
    await apiRequest(`/api/workspaces/${workspace.id}/status`, {
      method: 'PATCH',
      body: { status },
    });
    setNotice(`Workspace status updated to ${status}.`);
    await load();
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/workspaces/${workspace.id}/reviews`, {
        method: 'POST',
        body: {
          ratingCommunication: rComm,
          ratingQuality: rQual,
          ratingReliability: rRel,
          ratingProfessionalism: rProf,
          comment: rComment,
        },
      });
      setRComment('');
      setNotice('Verified review published.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review.');
    }
  };

  const tabs: Array<{ id: WsTab; label: string }> = [
    { id: 'overview', label: 'Overview & Handover' },
    { id: 'messages', label: `Messages (${data.messages.length})` },
    { id: 'tasks', label: `Tasks (${data.tasks.length})` },
    { id: 'milestones', label: `Milestones (${data.milestones.length})` },
    { id: 'files', label: `Files (${data.files.length})` },
    { id: 'changes', label: `Change Requests (${data.changeRequests.length})` },
    { id: 'submissions', label: `Submissions & Activity (${data.submissions.length})` },
  ];

  const kanbanColumns: Array<{ key: 'todo' | 'in_progress' | 'in_review' | 'completed'; label: string }> = [
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'in_review', label: 'In Review' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Workspace Header */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#667085]">
              <span className="inline-flex items-center gap-1 font-medium text-[#1E40AF] whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                Private Workspace #{workspace.id}
              </span>
              <span className="whitespace-nowrap">
                <StatusText status={workspace.status} />
              </span>
              <span className="whitespace-nowrap">
                Due <span className="font-mono">{contract.deadline || 'TBD'}</span>
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-[#101828]">
              {project?.title || `Project #${workspace.projectId}`}
            </h1>
            <p className="mt-1 text-xs text-[#475467]">
              Client: <strong>{buyer?.name}</strong> · Freelancer: <strong>{seller?.name}</strong> · Agreed Value:{' '}
              <strong className="font-mono tabular-nums text-[#101828]">
                {formatCurrency(contract.agreedPrice, contract.currency)}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isBuyer && workspace.status !== 'completed' && workspace.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => handleStatusUpdate('completed')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg whitespace-nowrap"
              >
                Approve &amp; Mark Completed
              </button>
            )}
            {workspace.status !== 'completed' && workspace.status !== 'disputed' && (
              <button
                type="button"
                onClick={() => handleStatusUpdate('disputed')}
                className="px-3.5 py-2 text-xs font-semibold text-[#B91C1C] border border-[#FECACA] rounded-lg whitespace-nowrap"
              >
                Open Dispute
              </button>
            )}
          </div>
        </div>

        {/* Workspace Navigation Tabs — single-row scrollable on mobile */}
        <nav aria-label="Workspace sections" className="mt-6 pt-4 border-t border-[#E4E7EC] flex flex-nowrap overflow-x-auto gap-1.5 pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'bg-[#101828] text-white'
                  : 'text-[#475467] hover:bg-[#F2F4F7] hover:text-[#101828]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
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

      {/* TAB 1: OVERVIEW, FINAL HANDOVER & MUTUAL REVIEWS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold text-[#101828]">Agreed Scope &amp; Deliverables</h2>
              <p className="text-sm text-[#344054] leading-relaxed whitespace-pre-line">{contract.agreedScope}</p>
              {contract.agreedDeliverables.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-[#344054] space-y-1">
                  {contract.agreedDeliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              <div className="pt-4 border-t border-[#E4E7EC] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#101828]">Revision Policy</p>
                  <p className="text-[#475467] mt-1">{contract.revisionPolicy}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#101828]">Acceptance Criteria</p>
                  <p className="text-[#475467] mt-1">{project?.acceptanceCriteria || 'Verified against deliverables above.'}</p>
                </div>
              </div>
            </section>

            {/* Final Handover Box */}
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold text-[#101828]">Final Handover Area</h2>
              {workspace.handoverNotes ? (
                <div className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] space-y-2 text-sm">
                  <p className="font-medium text-[#101828]">Handover Notes</p>
                  <p className="text-[#344054] whitespace-pre-line">{workspace.handoverNotes}</p>
                  {workspace.handoverLinks.length > 0 && (
                    <div className="pt-2 space-y-1">
                      {workspace.handoverLinks.map((lnk, i) => (
                        <a key={i} href={lnk.url} target="_blank" rel="noreferrer" className="block text-xs text-[#1E40AF] underline">
                          {lnk.label || lnk.url} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#667085]">
                  No final handover package submitted yet. {isSeller ? 'Use the Submissions tab to submit milestone or final handover deliverables.' : 'The freelancer will submit final links, files, and handover notes here.'}
                </p>
              )}
            </section>

            {/* Mutual Verified Reviews (unlocked strictly after completion) */}
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold text-[#101828]">Project Reviews</h2>
              {data.reviews.length > 0 && (
                <div className="space-y-4">
                  {data.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#101828]">
                          {rev.reviewerName} <span className="font-normal text-[#667085]">({rev.reviewerRole})</span>
                        </span>
                        <span className="font-mono font-semibold text-[#1E40AF] flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-current" /> {rev.ratingOverall}/5
                        </span>
                      </div>
                      <p className="text-xs text-[#667085] font-mono">
                        Comm {rev.ratingCommunication}/5 · Quality {rev.ratingQuality}/5 · Reliability {rev.ratingReliability}/5 · Professionalism {rev.ratingProfessionalism}/5
                      </p>
                      <p className="text-sm text-[#344054]">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {data.reviewEligibility.allowed ? (
                <form onSubmit={handleSubmitReview} className="pt-4 border-t border-[#E4E7EC] space-y-4">
                  <h3 className="text-sm font-semibold text-[#101828]">Leave a Verified Review</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[
                      { label: 'Communication', val: rComm, set: setRComm },
                      { label: 'Quality', val: rQual, set: setRQual },
                      { label: 'Reliability', val: rRel, set: setRRel },
                      { label: 'Professionalism', val: rProf, set: setRProf },
                    ].map((item) => (
                      <label key={item.label} className="block">
                        <span className="text-[#475467]">{item.label}</span>
                        <select
                          value={item.val}
                          onChange={(e) => item.set(Number(e.target.value))}
                          className="mt-1 w-full px-2.5 py-2 border border-[#D0D5DD] rounded-lg bg-white font-mono"
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <textarea
                    required
                    minLength={15}
                    rows={3}
                    value={rComment}
                    onChange={(e) => setRComment(e.target.value)}
                    placeholder="Share concrete feedback on collaboration, deliverables, and reliability..."
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                  >
                    Publish Verified Review
                  </button>
                </form>
              ) : (
                <p className="text-xs text-[#667085]">{data.reviewEligibility.reason}</p>
              )}
            </section>
          </div>

          {/* Recent Activity Sidebar */}
          <aside className="lg:col-span-4 bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#101828]">Recent Activity Timeline</h2>
            <ol className="space-y-4 text-xs">
              {data.activityEvents.slice(0, 10).map((ev) => (
                <li key={ev.id} className="pb-3 border-b border-[#F2F4F7] last:border-b-0">
                  <p className="text-[#101828] font-medium">{ev.summary}</p>
                  <p className="text-[#667085] mt-0.5">
                    {ev.actorName} · {new Date(ev.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}

      {/* TAB 2: PRIVATE MESSAGING */}
      {activeTab === 'messages' && (
        <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#101828] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1E40AF]" /> Private Project Room Chat
            </h2>
            <button type="button" onClick={load} className="text-xs font-semibold text-[#1E40AF] hover:underline">
              Refresh Messages
            </button>
          </div>

          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {data.messages.length === 0 ? (
              <p className="text-sm text-[#667085]">Start the conversation with your project partner.</p>
            ) : (
              data.messages.map((m) => {
                const mine = m.senderId === account.user.id;
                const readByOther = isBuyer ? m.readBySeller : m.readByBuyer;
                return (
                  <div key={m.id} className={`flex items-start gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                    <Avatar name={m.senderName} src={m.senderAvatar} size="sm" />
                    <div
                      className={`max-w-xl rounded-xl p-3.5 text-sm ${
                        mine ? 'bg-[#1E40AF] text-white' : 'bg-[#F2F4F7] text-[#101828]'
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${mine ? 'text-white/80' : 'text-[#475467]'}`}>
                        {m.senderName}
                      </p>
                      <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                      <p className={`text-[11px] mt-1.5 ${mine ? 'text-white/70' : 'text-[#667085]'}`}>
                        {new Date(m.createdAt).toLocaleString()}
                        {mine ? (readByOther ? ' · Read' : ' · Sent') : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMessage} className="pt-4 border-t border-[#E4E7EC] flex gap-2">
            <input
              aria-label="Private workspace message"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Write a private message..."
              className="flex-1 px-4 py-2.5 text-sm border border-[#D0D5DD] rounded-lg"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </section>
      )}

      {/* TAB 3: KANBAN TASK BOARD */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateTask} className="bg-white border border-[#E4E7EC] rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label htmlFor="task-title" className="block text-xs font-medium text-[#344054] mb-1">New Task Title</label>
              <input
                id="task-title"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Build responsive export modal"
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="task-desc" className="block text-xs font-medium text-[#344054] mb-1">Details</label>
              <input
                id="task-desc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Acceptance notes..."
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="task-prio" className="block text-xs font-medium text-[#344054] mb-1">Priority</label>
              <select
                id="task-prio"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="task-due" className="block text-xs font-medium text-[#344054] mb-1">Due Date</label>
              <input
                id="task-due"
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-[#D0D5DD] rounded-lg"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kanbanColumns.map((col) => {
              const colTasks = data.tasks.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="bg-white border border-[#E4E7EC] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F2F4F7]">
                    <h3 className="text-xs font-semibold text-[#101828]">{col.label}</h3>
                    <span className="font-mono text-xs text-[#667085]">{colTasks.length}</span>
                  </div>
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-[#667085] py-4 text-center">No tasks</p>
                  ) : (
                    colTasks.map((task) => (
                      <div key={task.id} className="p-3 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[#101828]">{task.title}</p>
                          <span
                            className={`capitalize shrink-0 font-medium ${
                              task.priority === 'high'
                                ? 'text-[#B91C1C]'
                                : task.priority === 'medium'
                                ? 'text-[#B45309]'
                                : 'text-[#667085]'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.description && <p className="text-[#475467]">{task.description}</p>}
                        {task.dueDate && <p className="font-mono text-[#667085]">Due {task.dueDate}</p>}

                        <label className="block pt-1">
                          <span className="sr-only">Move task {task.title}</span>
                          <select
                            aria-label={`Status for ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              handleMoveTask(task.id, e.target.value as 'todo' | 'in_progress' | 'in_review' | 'completed')
                            }
                            className="w-full px-2 py-1.5 text-xs bg-white border border-[#D0D5DD] rounded-md"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </label>

                        {task.comments.length > 0 && (
                          <div className="pt-2 border-t border-[#E4E7EC] space-y-1">
                            {task.comments.map((c) => (
                              <p key={c.id} className="text-[11px] text-[#475467]">
                                <strong className="text-[#101828]">{c.authorName}:</strong> {c.body}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1 pt-1">
                          <input
                            aria-label={`Comment on ${task.title}`}
                            value={taskCommentDrafts[task.id] || ''}
                            onChange={(e) => setTaskCommentDrafts((p) => ({ ...p, [task.id]: e.target.value }))}
                            placeholder="Add comment..."
                            className="flex-1 px-2 py-1 text-[11px] bg-white border border-[#D0D5DD] rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleTaskComment(task.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#101828] text-white rounded"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: MILESTONES & CLEARLY LABELED DEMO PAYMENT FLOW */}
      {activeTab === 'milestones' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-xs text-[#92400E]">
            <strong>Development Demo Billing Mode:</strong> No live payment processor or regulated escrow account is configured in this preview environment. Milestone authorization, release, and invoice numbers below simulate the data model only — no real money is held or transferred and no payment card details are collected.
          </div>

          <div className="bg-white border border-[#E4E7EC] rounded-xl divide-y divide-[#F2F4F7]">
            {data.milestones.map((ms) => (
              <div key={ms.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-sm text-[#101828]">{ms.title}</span>
                    <span aria-hidden="true">·</span>
                    <StatusText status={ms.status} />
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#667085]">Due {ms.dueDate || 'TBD'}</span>
                  </div>
                  <p className="text-xs text-[#475467]">{ms.deliverables}</p>
                  {ms.feedbackNote && <p className="text-xs text-[#15803D]">Review note: {ms.feedbackNote}</p>}
                  <p className="text-xs text-[#667085]">
                    Demo payment status: <StatusText status={ms.paymentStatus} />
                    {ms.invoiceNumber ? ` · Invoice ${ms.invoiceNumber}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-base font-bold text-[#101828]">
                    {formatCurrency(ms.amount, ms.currency)}
                  </span>
                  {isBuyer && ms.paymentStatus === 'unpaid' && (
                    <button
                      type="button"
                      onClick={() => handleDemoPaymentAction(ms.id, 'demo_authorized')}
                      className="px-3 py-1.5 text-xs font-semibold text-[#101828] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-lg"
                    >
                      Mark Demo Authorized
                    </button>
                  )}
                  {isBuyer && ms.paymentStatus !== 'demo_released' && ms.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleDemoPaymentAction(ms.id, 'demo_released')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#15803D] rounded-lg"
                    >
                      Record Demo Release
                    </button>
                  )}
                  {ms.invoiceNumber && (
                    <button
                      type="button"
                      onClick={() => setInvoiceModalMs(ms)}
                      className="text-xs font-semibold text-[#1E40AF] hover:underline"
                    >
                      View Demo Receipt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isBuyer && (
            <form onSubmit={handleCreateMilestone} className="bg-white border border-[#E4E7EC] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label htmlFor="ms-title" className="block text-xs font-medium text-[#344054] mb-1">Add Milestone Title</label>
                <input id="ms-title" required value={msTitle} onChange={(e) => setMsTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg" />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="ms-del" className="block text-xs font-medium text-[#344054] mb-1">Deliverables</label>
                <input id="ms-del" value={msDeliverables} onChange={(e) => setMsDeliverables(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ms-amt" className="block text-xs font-medium text-[#344054] mb-1">Amount ({contract.currency})</label>
                <input id="ms-amt" type="number" required min={0} value={msAmount} onChange={(e) => setMsAmount(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-[#D0D5DD] rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#101828] rounded-lg">
                  Add Milestone
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 5: PRIVATE VERSIONED FILE ROOM */}
      {activeTab === 'files' && (
        <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#101828]">Private Versioned File Room</h2>
              <p className="text-xs text-[#475467] mt-0.5">
                Uploading a file with the same name automatically increments its version number. Max 4 MB · PDF, PNG, JPG, WEBP, TXT, MD, DOCX, ZIP.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg cursor-pointer whitespace-nowrap">
              <Upload className="w-4 h-4" />
              Upload Workspace File
              <input type="file" onChange={handleUploadFile} className="sr-only" />
            </label>
          </div>

          {uploadProgress !== null && (
            <div className="w-full bg-[#F2F4F7] rounded-full h-2 overflow-hidden">
              <div className="bg-[#1E40AF] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          {data.files.length === 0 ? (
            <p className="text-sm text-[#667085]">No files uploaded yet.</p>
          ) : (
            <div className="divide-y divide-[#F2F4F7]">
              {data.files.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-[#1E40AF] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-[#101828] truncate">
                        {f.fileName}{' '}
                        <span className="font-mono text-xs text-[#1E40AF]">v{f.version}</span>
                      </p>
                      <p className="text-xs text-[#667085]">
                        Uploaded by {f.ownerName} · {Math.max(1, Math.round(f.sizeBytes / 1024))} KB ·{' '}
                        {new Date(f.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewFileId(f.id)}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline whitespace-nowrap"
                  >
                    Preview / Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 6: SCOPE & CHANGE REQUESTS */}
      {activeTab === 'changes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Scope Change Requests</h2>
            {data.changeRequests.length === 0 ? (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-sm text-[#667085]">
                No scope modifications requested yet.
              </div>
            ) : (
              data.changeRequests.map((cr) => (
                <div key={cr.id} className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-[#101828]">{cr.title}</p>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Requested by {cr.requesterName} · <StatusText status={cr.status} />
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#101828]">
                      {cr.scopeType === 'revised_terms'
                        ? `+${formatCurrency(cr.priceDelta, contract.currency)}${cr.revisedDeadline ? ` · Due ${cr.revisedDeadline}` : ''}`
                        : 'Included in original scope'}
                    </span>
                  </div>
                  <p className="text-sm text-[#344054]">{cr.description}</p>
                  {cr.status === 'pending' && cr.requesterId !== account.user.id && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleResolveChangeRequest(cr.id, 'approved')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#15803D] rounded-lg"
                      >
                        Approve Change
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveChangeRequest(cr.id, 'declined')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-[#B91C1C] border border-[#FECACA] rounded-lg"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCreateChangeRequest} className="lg:col-span-5 bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4 h-fit">
            <h3 className="font-display text-base font-semibold text-[#101828]">Request Scope Change</h3>
            <div>
              <label htmlFor="cr-title" className="block text-xs font-medium text-[#344054] mb-1">Modification Title *</label>
              <input id="cr-title" required value={crTitle} onChange={(e) => setCrTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg" />
            </div>
            <div>
              <label htmlFor="cr-desc" className="block text-xs font-medium text-[#344054] mb-1">Written Details *</label>
              <textarea id="cr-desc" required minLength={10} rows={3} value={crDesc} onChange={(e) => setCrDesc(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg" />
            </div>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input type="radio" checked={crScope === 'included_in_scope'} onChange={() => setCrScope('included_in_scope')} />
                <span>Included in original agreed scope ($0 change)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={crScope === 'revised_terms'} onChange={() => setCrScope('revised_terms')} />
                <span>Requires revised price and/or deadline</span>
              </label>
            </div>
            {crScope === 'revised_terms' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cr-delta" className="block text-xs font-medium text-[#344054] mb-1">Price Delta ({contract.currency})</label>
                  <input id="cr-delta" type="number" min={0} value={crPriceDelta} onChange={(e) => setCrPriceDelta(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-[#D0D5DD] rounded-lg" />
                </div>
                <div>
                  <label htmlFor="cr-date" className="block text-xs font-medium text-[#344054] mb-1">Revised Deadline</label>
                  <input id="cr-date" type="date" value={crDeadline} onChange={(e) => setCrDeadline(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-[#D0D5DD] rounded-lg" />
                </div>
              </div>
            )}
            <button type="submit" className="w-full py-2.5 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg">
              Submit Change Request
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: SUBMISSIONS, REVISION FEEDBACK & ACTIVITY */}
      {activeTab === 'submissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Deliverable Submissions &amp; Reviews</h2>
            {data.submissions.length === 0 ? (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-sm text-[#667085]">
                No deliverable submissions yet.
              </div>
            ) : (
              data.submissions.map((sub) => (
                <div key={sub.id} className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#101828] uppercase tracking-wide">
                      {sub.submissionType === 'final_handover' ? 'Final Handover' : 'Milestone Deliverable'}
                    </span>
                    <StatusText status={sub.status} />
                  </div>
                  <p className="text-sm text-[#344054] whitespace-pre-line">{sub.summary}</p>
                  {sub.deliverableLinks.length > 0 && (
                    <div className="space-y-1">
                      {sub.deliverableLinks.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block text-xs text-[#1E40AF] underline">
                          {l.label || l.url} ↗
                        </a>
                      ))}
                    </div>
                  )}
                  {sub.buyerFeedback && (
                    <div className="p-3 rounded-lg bg-[#F8F9FB] text-xs text-[#344054]">
                      <strong>Client feedback:</strong> {sub.buyerFeedback}
                    </div>
                  )}

                  {isBuyer && sub.status === 'pending_review' && (
                    <div className="pt-3 border-t border-[#E4E7EC] space-y-2">
                      <textarea
                        rows={2}
                        value={reviewFeedbackDrafts[sub.id] || ''}
                        onChange={(e) => setReviewFeedbackDrafts((p) => ({ ...p, [sub.id]: e.target.value }))}
                        placeholder="Approval note or specific revision feedback..."
                        className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewSubmission(sub.id, 'approved', sub.submissionType === 'final_handover')}
                          className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#15803D] rounded-lg"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {sub.submissionType === 'final_handover' ? 'Approve & Complete Project' : 'Approve Delivery'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewSubmission(sub.id, 'revision_requested', false)}
                          className="px-3.5 py-2 text-xs font-semibold text-[#B45309] border border-[#FCD34D] bg-[#FFFBEB] rounded-lg"
                        >
                          Request Revisions
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            {isSeller && workspace.status !== 'completed' && (
              <form onSubmit={handleSubmitDeliverable} className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-semibold text-[#101828]">Submit Deliverable or Final Handover</h3>
                <div>
                  <label htmlFor="sub-type" className="block text-xs font-medium text-[#344054] mb-1">Submission Type</label>
                  <select
                    id="sub-type"
                    value={subType}
                    onChange={(e) => setSubType(e.target.value as 'milestone' | 'final_handover')}
                    className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                  >
                    <option value="milestone">Milestone Deliverable</option>
                    <option value="final_handover">Final Project Handover</option>
                  </select>
                </div>
                {subType === 'milestone' && (
                  <div>
                    <label htmlFor="sub-ms" className="block text-xs font-medium text-[#344054] mb-1">Linked Milestone</label>
                    <select
                      id="sub-ms"
                      value={subMilestoneId}
                      onChange={(e) => setSubMilestoneId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg bg-white"
                    >
                      <option value="">General progress update</option>
                      {data.milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="sub-sum" className="block text-xs font-medium text-[#344054] mb-1">Summary &amp; Handover Notes *</label>
                  <textarea
                    id="sub-sum"
                    required
                    minLength={10}
                    rows={4}
                    value={subSummary}
                    onChange={(e) => setSubSummary(e.target.value)}
                    placeholder="List completed items, testing notes, and how to review..."
                    className="w-full px-3 py-2 text-sm border border-[#D0D5DD] rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Link label (optional)"
                    value={subLinkLabel}
                    onChange={(e) => setSubLinkLabel(e.target.value)}
                    className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                  />
                  <input
                    placeholder="https://staging-or-figma..."
                    value={subLinkUrl}
                    onChange={(e) => setSubLinkUrl(e.target.value)}
                    className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-lg"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg">
                  Submit for Buyer Review
                </button>
              </form>
            )}

            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#101828]">Full Activity Log</h3>
              <ol className="space-y-3 text-xs">
                {data.activityEvents.map((ev) => (
                  <li key={ev.id} className="pb-2 border-b border-[#F2F4F7] last:border-b-0">
                    <p className="text-[#101828]">{ev.summary}</p>
                    <p className="text-[#667085] mt-0.5">{ev.actorName} · {new Date(ev.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Demo Receipt Modal */}
      {invoiceModalMs && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EC] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#101828]">Demo Milestone Receipt</h3>
              <button type="button" onClick={() => setInvoiceModalMs(null)} className="text-xs text-[#667085]">Close</button>
            </div>
            <p className="text-xs text-[#B45309] bg-[#FFFBEB] p-2.5 rounded-lg">
              Development prototype receipt — not a live tax invoice or proof of escrow transfer.
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-[#667085]">Receipt #</dt><dd className="font-mono">{invoiceModalMs.invoiceNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-[#667085]">Milestone</dt><dd className="font-medium text-right">{invoiceModalMs.title}</dd></div>
              <div className="flex justify-between"><dt className="text-[#667085]">Amount</dt><dd className="font-mono font-bold">{formatCurrency(invoiceModalMs.amount, invoiceModalMs.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#667085]">Demo Status</dt><dd><StatusText status={invoiceModalMs.paymentStatus} /></dd></div>
              <div className="flex justify-between"><dt className="text-[#667085]">Client</dt><dd>{buyer?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-[#667085]">Freelancer</dt><dd>{seller?.name}</dd></div>
            </dl>
          </div>
        </div>
      )}

      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
}
