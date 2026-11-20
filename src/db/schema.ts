import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  summary: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface LabeledLink {
  label: string;
  url: string;
}

export interface ScreeningAnswer {
  question: string;
  answer: string;
}

export interface ProposalMilestonePlan {
  title: string;
  deliverables: string;
  amount: number;
  dueOffsetDays: number;
}

export interface TaskComment {
  id: string;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  canBuy: boolean('can_buy').notNull().default(true),
  canSell: boolean('can_sell').notNull().default(false),
  activeRole: text('active_role').notNull().default('buyer'), // 'buyer' | 'seller' | 'admin'
  isAdmin: boolean('is_admin').notNull().default(false),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token'),
  resetToken: text('reset_token'),
  isRestricted: boolean('is_restricted').notNull().default(false),
  restrictionReason: text('restriction_reason'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const buyerProfiles = pgTable('buyer_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  organizationName: text('organization_name').notNull().default(''),
  description: text('description').notNull().default(''),
  website: text('website').notNull().default(''),
  industry: text('industry').notNull().default(''),
  contactPreference: text('contact_preference').notNull().default('Platform messages'),
  location: text('location').notNull().default(''),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sellerProfiles = pgTable('seller_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  headline: text('headline').notNull().default(''),
  bio: text('bio').notNull().default(''),
  skills: jsonb('skills').$type<string[]>().notNull().default([]),
  experience: jsonb('experience').$type<ExperienceEntry[]>().notNull().default([]),
  education: jsonb('education').$type<EducationEntry[]>().notNull().default([]),
  languages: jsonb('languages').$type<string[]>().notNull().default([]),
  pricingPreference: text('pricing_preference').notNull().default('both'), // 'fixed' | 'hourly' | 'both'
  hourlyRate: integer('hourly_rate'),
  currency: text('currency').notNull().default('USD'),
  availability: text('availability').notNull().default('available'), // 'available' | 'limited' | 'unavailable'
  location: text('location').notNull().default(''),
  timezone: text('timezone').notNull().default('UTC'),
  cvFileId: integer('cv_file_id'),
  portfolioLinks: jsonb('portfolio_links').$type<LabeledLink[]>().notNull().default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const portfolioItems = pgTable(
  'portfolio_items',
  {
    id: serial('id').primaryKey(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    toolsUsed: jsonb('tools_used').$type<string[]>().notNull().default([]),
    rolePerformed: text('role_performed').notNull().default(''),
    externalUrl: text('external_url').notNull().default(''),
    imageUrl: text('image_url').notNull().default(''),
    fileId: integer('file_id'),
    verifiedContribution: boolean('verified_contribution').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('portfolio_items_seller_idx').on(t.sellerId)]
);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  subcategories: jsonb('subcategories').$type<string[]>().notNull().default([]),
  suggestedSkills: jsonb('suggested_skills').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const storedFiles = pgTable(
  'stored_files',
  {
    id: serial('id').primaryKey(),
    ownerId: integer('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    scope: text('scope').notNull(), // 'cv' | 'portfolio' | 'project_ref' | 'proposal_sample' | 'workspace'
    scopeRefId: integer('scope_ref_id'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    contentBase64: text('content_base64').notNull(),
    version: integer('version').notNull().default(1),
    versionGroup: text('version_group'),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('stored_files_scope_idx').on(t.scope, t.scopeRefId)]
);

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    buyerId: integer('buyer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    brief: text('brief').notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id)
      .notNull(),
    subcategory: text('subcategory').notNull().default(''),
    requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
    scopeOfWork: text('scope_of_work').notNull().default(''),
    deliverables: jsonb('deliverables').$type<string[]>().notNull().default([]),
    acceptanceCriteria: text('acceptance_criteria').notNull().default(''),
    referenceLinks: jsonb('reference_links').$type<LabeledLink[]>().notNull().default([]),
    budgetType: text('budget_type').notNull().default('fixed'), // 'fixed' | 'hourly'
    budgetMin: integer('budget_min').notNull().default(0),
    budgetMax: integer('budget_max').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    startDate: text('start_date').notNull().default(''),
    deadline: text('deadline').notNull().default(''),
    estimatedDuration: text('estimated_duration').notNull().default(''),
    urgency: text('urgency').notNull().default('standard'), // 'standard' | 'priority' | 'urgent'
    experienceLevel: text('experience_level').notNull().default('intermediate'), // 'entry' | 'intermediate' | 'expert'
    freelancersNeeded: integer('freelancers_needed').notNull().default(1),
    workMode: text('work_mode').notNull().default('remote'), // 'remote' | 'hybrid' | 'onsite'
    location: text('location').notNull().default('Remote'),
    screeningQuestions: jsonb('screening_questions').$type<string[]>().notNull().default([]),
    sampleRequested: boolean('sample_requested').notNull().default(false),
    samplePaid: boolean('sample_paid').notNull().default(false),
    sampleDetails: text('sample_details').notNull().default(''),
    visibility: text('visibility').notNull().default('public'), // 'public' | 'invite_only' | 'private_link'
    privateToken: text('private_token'),
    revisionPolicy: text('revision_policy').notNull().default('Up to 2 rounds of revisions included per milestone.'),
    additionalTerms: text('additional_terms').notNull().default(''),
    allowPublicQa: boolean('allow_public_qa').notNull().default(true),
    proposalDeadline: text('proposal_deadline').notNull().default(''),
    status: text('status').notNull().default('draft'), // 'draft' | 'open' | 'paused' | 'hired' | 'closed' | 'cancelled'
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('projects_status_idx').on(t.status),
    index('projects_category_idx').on(t.categoryId),
    index('projects_buyer_idx').on(t.buyerId),
  ]
);

export const savedProjects = pgTable(
  'saved_projects',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saved_projects_user_project_uidx').on(t.userId, t.projectId)]
);

export const projectQuestions = pgTable(
  'project_questions',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: integer('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    answeredAt: timestamp('answered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('project_questions_project_idx').on(t.projectId)]
);

export const proposals = pgTable(
  'proposals',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    coverLetter: text('cover_letter').notNull(),
    proposedPrice: integer('proposed_price').notNull(),
    pricingType: text('pricing_type').notNull().default('fixed'),
    currency: text('currency').notNull().default('USD'),
    estimatedTimeline: text('estimated_timeline').notNull(),
    availability: text('availability').notNull().default('Immediate'),
    answers: jsonb('answers').$type<ScreeningAnswer[]>().notNull().default([]),
    milestonePlan: jsonb('milestone_plan').$type<ProposalMilestonePlan[]>().notNull().default([]),
    portfolioItemIds: jsonb('portfolio_item_ids').$type<number[]>().notNull().default([]),
    attachCv: boolean('attach_cv').notNull().default(true),
    sampleFileId: integer('sample_file_id'),
    sampleNote: text('sample_note').notNull().default(''),
    status: text('status').notNull().default('submitted'), // 'submitted' | 'viewed' | 'shortlisted' | 'info_requested' | 'offer_sent' | 'accepted' | 'declined' | 'withdrawn'
    declineReason: text('decline_reason'),
    infoRequestNote: text('info_request_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('proposals_project_seller_uidx').on(t.projectId, t.sellerId),
    index('proposals_seller_idx').on(t.sellerId),
  ]
);

export const directMessages = pgTable(
  'direct_messages',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    proposalId: integer('proposal_id').references(() => proposals.id, { onDelete: 'cascade' }),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    recipientId: integer('recipient_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('direct_messages_participants_idx').on(t.senderId, t.recipientId)]
);

export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  proposalId: integer('proposal_id')
    .references(() => proposals.id, { onDelete: 'cascade' })
    .notNull(),
  buyerId: integer('buyer_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sellerId: integer('seller_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  agreedScope: text('agreed_scope').notNull(),
  agreedDeliverables: jsonb('agreed_deliverables').$type<string[]>().notNull().default([]),
  agreedPrice: integer('agreed_price').notNull(),
  pricingType: text('pricing_type').notNull().default('fixed'),
  currency: text('currency').notNull().default('USD'),
  deadline: text('deadline').notNull().default(''),
  revisionPolicy: text('revision_policy').notNull(),
  responsibilities: text('responsibilities').notNull(),
  buyerAcceptedAt: timestamp('buyer_accepted_at'),
  sellerAcceptedAt: timestamp('seller_accepted_at'),
  status: text('status').notNull().default('pending_acceptance'), // 'pending_acceptance' | 'active' | 'completed' | 'cancelled' | 'disputed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: serial('id').primaryKey(),
    contractId: integer('contract_id')
      .references(() => contracts.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    buyerId: integer('buyer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('not_started'), // 'not_started' | 'active' | 'submitted_for_review' | 'revision_requested' | 'completed' | 'cancelled' | 'disputed'
    handoverNotes: text('handover_notes').notNull().default(''),
    handoverLinks: jsonb('handover_links').$type<LabeledLink[]>().notNull().default([]),
    finalSubmittedAt: timestamp('final_submitted_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('workspaces_participants_idx').on(t.buyerId, t.sellerId)]
);

export const workspaceMessages = pgTable(
  'workspace_messages',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    readByBuyer: boolean('read_by_buyer').notNull().default(false),
    readBySeller: boolean('read_by_seller').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('workspace_messages_ws_idx').on(t.workspaceId)]
);

export const workspaceTasks = pgTable(
  'workspace_tasks',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('todo'), // 'todo' | 'in_progress' | 'in_review' | 'completed'
    priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high'
    assigneeId: integer('assignee_id').references(() => users.id),
    dueDate: text('due_date').notNull().default(''),
    comments: jsonb('comments').$type<TaskComment[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('workspace_tasks_ws_idx').on(t.workspaceId)]
);

export const milestones = pgTable(
  'milestones',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    deliverables: text('deliverables').notNull().default(''),
    amount: integer('amount').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    dueDate: text('due_date').notNull().default(''),
    status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved'
    paymentStatus: text('payment_status').notNull().default('unpaid'), // 'unpaid' | 'demo_authorized' | 'demo_released'
    invoiceNumber: text('invoice_number'),
    submittedNote: text('submitted_note').notNull().default(''),
    feedbackNote: text('feedback_note').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('milestones_ws_idx').on(t.workspaceId)]
);

export const changeRequests = pgTable(
  'change_requests',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    requesterId: integer('requester_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    scopeType: text('scope_type').notNull().default('included_in_scope'), // 'included_in_scope' | 'revised_terms'
    priceDelta: integer('price_delta').notNull().default(0),
    revisedDeadline: text('revised_deadline'),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'declined'
    responseNote: text('response_note').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => [index('change_requests_ws_idx').on(t.workspaceId)]
);

export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    milestoneId: integer('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    submissionType: text('submission_type').notNull().default('milestone'), // 'milestone' | 'final_handover'
    summary: text('summary').notNull(),
    deliverableLinks: jsonb('deliverable_links').$type<LabeledLink[]>().notNull().default([]),
    fileIds: jsonb('file_ids').$type<number[]>().notNull().default([]),
    status: text('status').notNull().default('pending_review'), // 'pending_review' | 'approved' | 'revision_requested'
    buyerFeedback: text('buyer_feedback').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (t) => [index('submissions_ws_idx').on(t.workspaceId)]
);

export const activityEvents = pgTable(
  'activity_events',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    eventType: text('event_type').notNull(),
    summary: text('summary').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('activity_events_ws_idx').on(t.workspaceId)]
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    workspaceId: integer('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    reviewerId: integer('reviewer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    revieweeId: integer('reviewee_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reviewerRole: text('reviewer_role').notNull(), // 'buyer' | 'seller'
    ratingOverall: integer('rating_overall').notNull(),
    ratingCommunication: integer('rating_communication').notNull(),
    ratingQuality: integer('rating_quality').notNull(),
    ratingReliability: integer('rating_reliability').notNull(),
    ratingProfessionalism: integer('rating_professionalism').notNull(),
    comment: text('comment').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('reviews_ws_reviewer_uidx').on(t.workspaceId, t.reviewerId),
    index('reviews_reviewee_idx').on(t.revieweeId),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkPath: text('link_path').notNull().default('/dashboard'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)]
);

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    reporterId: integer('reporter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: text('target_type').notNull(), // 'user' | 'project' | 'proposal' | 'review' | 'workspace_dispute'
    targetId: integer('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull(),
    status: text('status').notNull().default('open'), // 'open' | 'investigating' | 'resolved' | 'dismissed'
    resolutionNote: text('resolution_note').notNull().default(''),
    resolvedById: integer('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => [index('reports_status_idx').on(t.status)]
);

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  adminName: text('admin_name').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  buyerProfile: one(buyerProfiles, { fields: [users.id], references: [buyerProfiles.userId] }),
  sellerProfile: one(sellerProfiles, { fields: [users.id], references: [sellerProfiles.userId] }),
  portfolioItems: many(portfolioItems),
  projects: many(projects),
  proposals: many(proposals),
  notifications: many(notifications),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  buyer: one(users, { fields: [projects.buyerId], references: [users.id] }),
  category: one(categories, { fields: [projects.categoryId], references: [categories.id] }),
  proposals: many(proposals),
  questions: many(projectQuestions),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  project: one(projects, { fields: [proposals.projectId], references: [projects.id] }),
  seller: one(users, { fields: [proposals.sellerId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  contract: one(contracts, { fields: [workspaces.contractId], references: [contracts.id] }),
  project: one(projects, { fields: [workspaces.projectId], references: [projects.id] }),
  buyer: one(users, { fields: [workspaces.buyerId], references: [users.id] }),
  seller: one(users, { fields: [workspaces.sellerId], references: [users.id] }),
  messages: many(workspaceMessages),
  tasks: many(workspaceTasks),
  milestones: many(milestones),
  changeRequests: many(changeRequests),
  submissions: many(submissions),
  events: many(activityEvents),
}));
