export interface AuthPrincipal {
  id: number;
  isAdmin: boolean;
  canBuy: boolean;
  canSell: boolean;
  isRestricted: boolean;
}

export interface WorkspaceParticipantInfo {
  buyerId: number;
  sellerId: number;
  status: string;
}

export interface FileAccessRecord {
  ownerId: number;
  scope: string;
  scopeRefId: number | null;
  isPublic: boolean;
}

export interface FileAccessContext {
  isWorkspaceParticipant?: boolean;
  isBuyerOfSubmittedProposal?: boolean;
}

export interface ProjectBriefInput {
  title: string;
  brief: string;
  categoryId: number | null;
  scopeOfWork: string;
  deliverables: string[];
  acceptanceCriteria: string;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  deadline: string;
  requiredSkills: string[];
  sampleRequested: boolean;
  samplePaid: boolean;
  sampleDetails: string;
}

export interface BriefValidationResult {
  canPublish: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export interface CompletionSummary {
  percent: number;
  missing: string[];
}

export function canAccessWorkspace(
  user: Pick<AuthPrincipal, 'id' | 'isAdmin'> | null | undefined,
  workspace: Pick<WorkspaceParticipantInfo, 'buyerId' | 'sellerId'> | null | undefined
): boolean {
  if (!user || !workspace) return false;
  if (user.isAdmin) return true;
  return user.id === workspace.buyerId || user.id === workspace.sellerId;
}

export function canAccessFile(
  user: Pick<AuthPrincipal, 'id' | 'isAdmin'> | null | undefined,
  file: FileAccessRecord,
  context: FileAccessContext = {}
): boolean {
  // CVs and proposal samples are NEVER publicly downloadable by default.
  if (file.scope === 'cv' || file.scope === 'proposal_sample') {
    if (!user) return false;
    if (user.isAdmin || user.id === file.ownerId) return true;
    return Boolean(context.isBuyerOfSubmittedProposal);
  }

  if (file.scope === 'workspace') {
    if (!user) return false;
    if (user.isAdmin || user.id === file.ownerId) return true;
    return Boolean(context.isWorkspaceParticipant);
  }

  if (file.isPublic && (file.scope === 'portfolio' || file.scope === 'project_ref')) {
    return true;
  }

  if (!user) return false;
  return user.isAdmin || user.id === file.ownerId;
}

export function canSubmitReview(
  workspace: WorkspaceParticipantInfo,
  userId: number,
  existingReviewerIds: number[]
): { allowed: boolean; reason?: string } {
  if (workspace.status !== 'completed') {
    return { allowed: false, reason: 'Reviews can only be submitted after the project is marked completed.' };
  }
  if (userId !== workspace.buyerId && userId !== workspace.sellerId) {
    return { allowed: false, reason: 'Only project participants may submit a review.' };
  }
  if (existingReviewerIds.includes(userId)) {
    return { allowed: false, reason: 'You have already submitted a review for this project.' };
  }
  return { allowed: true };
}

export function validateProjectBrief(input: ProjectBriefInput): BriefValidationResult {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  if (!input.title || input.title.trim().length < 8) {
    blockingErrors.push('Project title must be at least 8 characters.');
  }
  if (!input.brief || input.brief.trim().length < 30) {
    blockingErrors.push('Project brief must be at least 30 characters describing the problem and goals.');
  }
  if (!input.categoryId) {
    blockingErrors.push('Select a primary category for this project.');
  }
  if (input.budgetMin <= 0 || input.budgetMax < input.budgetMin) {
    blockingErrors.push('Specify a valid positive budget range where maximum is at least minimum.');
  }
  if (!input.deadline) {
    blockingErrors.push('Specify a target deadline.');
  }

  if (!input.scopeOfWork || input.scopeOfWork.trim().length < 20) {
    warnings.push('Scope of work is short — adding explicit boundaries prevents scope creep.');
  }
  if (input.deliverables.filter((d) => d.trim().length > 0).length === 0) {
    warnings.push('No explicit deliverables listed. Freelancers estimate more accurately when deliverables are concrete.');
  }
  if (!input.acceptanceCriteria || input.acceptanceCriteria.trim().length < 15) {
    warnings.push('Acceptance criteria are missing. Define how you will verify final handover.');
  }
  if (input.requiredSkills.length === 0) {
    warnings.push('No required skills tagged. Adding skills improves discovery relevance.');
  }
  if (input.sampleRequested && !input.samplePaid) {
    warnings.push('Unpaid work sample requested — paid tests are recommended for substantial work and increase senior applicant quality.');
  }

  return {
    canPublish: blockingErrors.length === 0,
    blockingErrors,
    warnings,
  };
}

export function calculateSellerCompletion(
  profile: {
    headline?: string;
    bio?: string;
    skills?: string[];
    experience?: unknown[];
    hourlyRate?: number | null;
    location?: string;
    cvFileId?: number | null;
  } | null,
  portfolioCount: number
): CompletionSummary {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(profile?.headline && profile.headline.trim().length >= 8), label: 'Professional headline' },
    { ok: Boolean(profile?.bio && profile.bio.trim().length >= 30), label: 'Biography (30+ chars)' },
    { ok: Boolean(profile?.skills && profile.skills.length >= 2), label: 'At least 2 skills' },
    { ok: Boolean(profile?.experience && profile.experience.length >= 1), label: 'Experience entry' },
    { ok: Boolean(profile?.hourlyRate && profile.hourlyRate > 0), label: 'Rate preference' },
    { ok: Boolean(profile?.location && profile.location.trim().length >= 2), label: 'Location / timezone' },
    { ok: Boolean(profile?.cvFileId), label: 'Private CV / resume upload' },
    { ok: portfolioCount >= 1, label: 'At least 1 portfolio item' },
  ];

  const passed = checks.filter((c) => c.ok).length;
  return {
    percent: Math.round((passed / checks.length) * 100),
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function calculateBuyerCompletion(
  profile: {
    organizationName?: string;
    description?: string;
    industry?: string;
    location?: string;
    website?: string;
  } | null
): CompletionSummary {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(profile?.organizationName && profile.organizationName.trim().length >= 2), label: 'Company or display name' },
    { ok: Boolean(profile?.description && profile.description.trim().length >= 20), label: 'About / overview' },
    { ok: Boolean(profile?.industry && profile.industry.trim().length >= 2), label: 'Industry' },
    { ok: Boolean(profile?.location && profile.location.trim().length >= 2), label: 'Location / timezone' },
    { ok: Boolean(profile?.website && profile.website.trim().length >= 4), label: 'Website or portfolio link' },
  ];

  const passed = checks.filter((c) => c.ok).length;
  return {
    percent: Math.round((passed / checks.length) * 100),
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US')}`;
  }
}

export function computeMilestoneSum(milestones: Array<{ amount: number }>): number {
  return milestones.reduce((acc, m) => acc + (Number.isFinite(m.amount) ? m.amount : 0), 0);
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
]);

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

export function validateUploadFile(fileName: string, mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
  if (!fileName || fileName.trim().length === 0 || fileName.length > 180) {
    return { valid: false, error: 'Invalid file name.' };
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return { valid: false, error: 'File must be between 1 byte and 4 MB.' };
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `Unsupported file type (${mimeType}). Allowed: PDF, PNG, JPG, WEBP, TXT, MD, DOCX, ZIP.` };
  }
  return { valid: true };
}
