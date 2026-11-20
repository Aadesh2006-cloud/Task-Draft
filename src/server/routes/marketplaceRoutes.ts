import crypto from 'node:crypto';
import { Router } from 'express';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  activityEvents,
  buyerProfiles,
  categories,
  contracts,
  milestones,
  notifications,
  portfolioItems,
  projectQuestions,
  projects,
  proposals,
  reviews,
  savedProjects,
  sellerProfiles,
  storedFiles,
  users,
  workspaces,
} from '../../db/schema.ts';
import { validateProjectBrief } from '../../utils/domain.ts';
import { type AuthRequest, optionalAuth, requireAuth, requireUnrestricted } from '../auth.ts';

const router = Router();

function stripContactDetails(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, '[phone redacted]');
}

router.get('/api/categories', async (_req, res) => {
  try {
    const allCats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const openCounts = await db
      .select({
        categoryId: projects.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .where(and(eq(projects.status, 'open'), eq(projects.visibility, 'public')))
      .groupBy(projects.categoryId);

    const countMap = new Map(openCounts.map((r) => [r.categoryId, r.count]));
    return res.json(
      allCats.map((c) => ({
        ...c,
        openProjectsCount: countMap.get(c.id) || 0,
      }))
    );
  } catch (err) {
    console.error('Fetch categories failed:', err);
    return res.status(500).json({ error: 'Failed to load categories.' });
  }
});

router.get('/api/projects', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const skill = String(req.query.skill || '').trim().toLowerCase();
    const budgetType = String(req.query.budgetType || '').trim();
    const experienceLevel = String(req.query.experienceLevel || '').trim();
    const workMode = String(req.query.workMode || '').trim();
    const minBudget = req.query.minBudget ? Number(req.query.minBudget) : null;
    const maxBudget = req.query.maxBudget ? Number(req.query.maxBudget) : null;
    const sort = String(req.query.sort || 'newest');
    const mine = req.query.mine === 'true';
    const savedOnly = req.query.saved === 'true';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    if ((mine || savedOnly) && !req.currentUser) {
      return res.status(401).json({ error: 'Sign in required.' });
    }

    const rows = await db
      .select({
        project: projects,
        categoryName: categories.name,
        buyerName: users.name,
        buyerAvatar: users.avatarUrl,
        buyerOrg: buyerProfiles.organizationName,
      })
      .from(projects)
      .innerJoin(categories, eq(projects.categoryId, categories.id))
      .innerJoin(users, eq(projects.buyerId, users.id))
      .leftJoin(buyerProfiles, eq(projects.buyerId, buyerProfiles.userId))
      .orderBy(desc(projects.createdAt));

    let savedSet = new Set<number>();
    if (req.currentUser) {
      const saved = await db
        .select({ projectId: savedProjects.projectId })
        .from(savedProjects)
        .where(eq(savedProjects.userId, req.currentUser.id));
      savedSet = new Set(saved.map((s) => s.projectId));
    }

    const proposalCountsRaw = await db
      .select({
        projectId: proposals.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(proposals)
      .groupBy(proposals.projectId);
    const propCountMap = new Map(proposalCountsRaw.map((r) => [r.projectId, r.count]));

    let filtered = rows.filter(({ project }) => {
      if (mine) {
        return project.buyerId === req.currentUser!.id;
      }
      if (savedOnly) {
        return savedSet.has(project.id);
      }
      return project.status === 'open' && project.visibility === 'public';
    });

    if (q) {
      filtered = filtered.filter(({ project, categoryName, buyerOrg }) => {
        const hay = `${project.title} ${project.brief} ${categoryName} ${buyerOrg || ''} ${project.requiredSkills.join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (categoryId) {
      filtered = filtered.filter(({ project }) => project.categoryId === categoryId);
    }
    if (skill) {
      filtered = filtered.filter(({ project }) =>
        project.requiredSkills.some((s) => s.toLowerCase().includes(skill))
      );
    }
    if (budgetType && (budgetType === 'fixed' || budgetType === 'hourly')) {
      filtered = filtered.filter(({ project }) => project.budgetType === budgetType);
    }
    if (experienceLevel) {
      filtered = filtered.filter(({ project }) => project.experienceLevel === experienceLevel);
    }
    if (workMode) {
      filtered = filtered.filter(({ project }) => project.workMode === workMode);
    }
    if (minBudget !== null && Number.isFinite(minBudget)) {
      filtered = filtered.filter(({ project }) => project.budgetMax >= minBudget);
    }
    if (maxBudget !== null && Number.isFinite(maxBudget)) {
      filtered = filtered.filter(({ project }) => project.budgetMin <= maxBudget);
    }

    if (sort === 'budget_desc') {
      filtered.sort((a, b) => b.project.budgetMax - a.project.budgetMax);
    } else if (sort === 'budget_asc') {
      filtered.sort((a, b) => a.project.budgetMin - b.project.budgetMin);
    } else if (sort === 'deadline') {
      filtered.sort((a, b) => (a.project.deadline || '9999').localeCompare(b.project.deadline || '9999'));
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit).map(({ project, categoryName, buyerName, buyerAvatar, buyerOrg }) => ({
      ...project,
      categoryName,
      buyerName,
      buyerAvatar,
      buyerOrganization: buyerOrg || buyerName,
      proposalCount: propCountMap.get(project.id) || 0,
      isSaved: savedSet.has(project.id),
    }));

    return res.json({
      items: paged,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('List projects failed:', err);
    return res.status(500).json({ error: 'Failed to load marketplace projects.' });
  }
});

router.get('/api/projects/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'Invalid project ID.' });

    const [row] = await db
      .select({
        project: projects,
        categoryName: categories.name,
        buyerName: users.name,
        buyerAvatar: users.avatarUrl,
        buyerVerified: users.emailVerified,
        buyerOrg: buyerProfiles.organizationName,
        buyerIndustry: buyerProfiles.industry,
        buyerLocation: buyerProfiles.location,
        buyerDescription: buyerProfiles.description,
      })
      .from(projects)
      .innerJoin(categories, eq(projects.categoryId, categories.id))
      .innerJoin(users, eq(projects.buyerId, users.id))
      .leftJoin(buyerProfiles, eq(projects.buyerId, buyerProfiles.userId))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'Project not found.' });

    const isOwnerOrAdmin = Boolean(
      req.currentUser && (req.currentUser.isAdmin || req.currentUser.id === row.project.buyerId)
    );
    const tokenMatch = req.query.token && row.project.privateToken && req.query.token === row.project.privateToken;

    if (row.project.status === 'draft' && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'This draft project is private to its owner.' });
    }
    if (row.project.visibility !== 'public' && !isOwnerOrAdmin && !tokenMatch) {
      // Allow hired seller or invited applicant
      let isParticipant = false;
      if (req.currentUser) {
        const myProp = await db
          .select({ id: proposals.id })
          .from(proposals)
          .where(and(eq(proposals.projectId, projectId), eq(proposals.sellerId, req.currentUser.id)))
          .limit(1);
        isParticipant = myProp.length > 0;
      }
      if (!isParticipant) {
        return res.status(403).json({ error: 'This project requires an invite or private link.' });
      }
    }

    const qas = await db
      .select({
        id: projectQuestions.id,
        question: projectQuestions.question,
        answer: projectQuestions.answer,
        answeredAt: projectQuestions.answeredAt,
        createdAt: projectQuestions.createdAt,
        authorName: users.name,
      })
      .from(projectQuestions)
      .innerJoin(users, eq(projectQuestions.authorId, users.id))
      .where(eq(projectQuestions.projectId, projectId))
      .orderBy(asc(projectQuestions.createdAt));

    const refFiles = await db
      .select({
        id: storedFiles.id,
        fileName: storedFiles.fileName,
        mimeType: storedFiles.mimeType,
        sizeBytes: storedFiles.sizeBytes,
        createdAt: storedFiles.createdAt,
      })
      .from(storedFiles)
      .where(and(eq(storedFiles.scope, 'project_ref'), eq(storedFiles.scopeRefId, projectId)));

    const propCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposals)
      .where(eq(proposals.projectId, projectId));

    let myProposal = null;
    let isSaved = false;
    let myContract = null;
    let myWorkspaceId: number | null = null;

    if (req.currentUser) {
      const [mp] = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.projectId, projectId), eq(proposals.sellerId, req.currentUser.id)))
        .limit(1);
      if (mp) {
        // Never leak buyer's private declineReason to seller
        const { declineReason: _privateReason, ...safeProposal } = mp;
        myProposal = safeProposal;
      }

      const saved = await db
        .select({ id: savedProjects.id })
        .from(savedProjects)
        .where(and(eq(savedProjects.userId, req.currentUser.id), eq(savedProjects.projectId, projectId)))
        .limit(1);
      isSaved = saved.length > 0;

      const [c] = await db
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.projectId, projectId),
            or(eq(contracts.buyerId, req.currentUser.id), eq(contracts.sellerId, req.currentUser.id))
          )
        )
        .limit(1);
      if (c) {
        myContract = c;
        const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.contractId, c.id)).limit(1);
        if (ws) myWorkspaceId = ws.id;
      }
    }

    return res.json({
      ...row.project,
      categoryName: row.categoryName,
      buyer: {
        id: row.project.buyerId,
        name: row.buyerName,
        avatarUrl: row.buyerAvatar,
        emailVerified: row.buyerVerified,
        organizationName: row.buyerOrg || row.buyerName,
        industry: row.buyerIndustry || '',
        location: row.buyerLocation || '',
        description: row.buyerDescription || '',
      },
      questions: qas,
      referenceFiles: refFiles,
      proposalCount: propCountRows[0]?.count || 0,
      isSaved,
      myProposal,
      myContract,
      myWorkspaceId,
      isOwner: Boolean(req.currentUser && req.currentUser.id === row.project.buyerId),
    });
  } catch (err) {
    console.error('Get project failed:', err);
    return res.status(500).json({ error: 'Failed to load project details.' });
  }
});

const projectWriteSchema = z.object({
  title: z.string().trim().min(3, 'Title is required.').max(180),
  brief: z.string().trim().default(''),
  categoryId: z.number().int().positive('Category is required.'),
  subcategory: z.string().trim().max(100).default(''),
  requiredSkills: z.array(z.string().trim().max(60)).max(20).default([]),
  scopeOfWork: z.string().trim().max(4000).default(''),
  deliverables: z.array(z.string().trim().max(240)).max(20).default([]),
  acceptanceCriteria: z.string().trim().max(2000).default(''),
  referenceLinks: z.array(z.object({ label: z.string().trim().max(100), url: z.string().trim().max(300) })).max(10).default([]),
  budgetType: z.enum(['fixed', 'hourly']).default('fixed'),
  budgetMin: z.number().int().min(0).default(0),
  budgetMax: z.number().int().min(0).default(0),
  currency: z.string().trim().min(3).max(5).default('USD'),
  startDate: z.string().trim().max(40).default(''),
  deadline: z.string().trim().max(40).default(''),
  estimatedDuration: z.string().trim().max(80).default(''),
  urgency: z.enum(['standard', 'priority', 'urgent']).default('standard'),
  experienceLevel: z.enum(['entry', 'intermediate', 'expert']).default('intermediate'),
  freelancersNeeded: z.number().int().min(1).max(20).default(1),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).default('remote'),
  location: z.string().trim().max(120).default('Remote'),
  screeningQuestions: z.array(z.string().trim().max(300)).max(10).default([]),
  sampleRequested: z.boolean().default(false),
  samplePaid: z.boolean().default(false),
  sampleDetails: z.string().trim().max(1000).default(''),
  visibility: z.enum(['public', 'invite_only', 'private_link']).default('public'),
  revisionPolicy: z.string().trim().max(500).default('Up to 2 rounds of revisions included per milestone.'),
  additionalTerms: z.string().trim().max(2000).default(''),
  allowPublicQa: z.boolean().default(true),
  proposalDeadline: z.string().trim().max(40).default(''),
  publish: z.boolean().default(false),
  confirmedPublish: z.boolean().default(false),
});

router.post('/api/projects', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    if (!req.currentUser!.canBuy && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Enable Buyer mode in your profile to post projects.' });
    }
    const parsed = projectWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid project data.' });
    }
    const data = parsed.data;

    let status: 'draft' | 'open' = 'draft';
    if (data.publish) {
      if (!data.confirmedPublish) {
        return res.status(400).json({ error: 'Explicit buyer confirmation is required before publishing a project.' });
      }
      const check = validateProjectBrief({
        title: data.title,
        brief: data.brief,
        categoryId: data.categoryId,
        scopeOfWork: data.scopeOfWork,
        deliverables: data.deliverables,
        acceptanceCriteria: data.acceptanceCriteria,
        budgetType: data.budgetType,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        deadline: data.deadline,
        requiredSkills: data.requiredSkills,
        sampleRequested: data.sampleRequested,
        samplePaid: data.samplePaid,
        sampleDetails: data.sampleDetails,
      });
      if (!check.canPublish) {
        return res.status(400).json({
          error: check.blockingErrors[0],
          blockingErrors: check.blockingErrors,
          warnings: check.warnings,
        });
      }
      status = 'open';
    }

    const { publish: _p, confirmedPublish: _c, ...projectFields } = data;
    const privateToken = data.visibility === 'private_link' ? crypto.randomBytes(10).toString('hex') : null;

    const [created] = await db
      .insert(projects)
      .values({
        buyerId: req.currentUser!.id,
        ...projectFields,
        deliverables: projectFields.deliverables.filter((d) => d.trim().length > 0),
        screeningQuestions: projectFields.screeningQuestions.filter((q) => q.trim().length > 0),
        privateToken,
        status,
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create project failed:', err);
    return res.status(500).json({ error: 'Failed to create project.' });
  }
});

router.patch('/api/projects/:id', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Project not found.' });
    if (existing.buyerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project owner can update this brief.' });
    }

    const allowedStatuses = new Set(['draft', 'open', 'paused', 'closed', 'cancelled']);
    const nextStatus = req.body.status && allowedStatuses.has(req.body.status) ? req.body.status : existing.status;

    if (nextStatus === 'open' && existing.status === 'draft') {
      if (!req.body.confirmedPublish) {
        return res.status(400).json({ error: 'Please confirm publishing from the review step.' });
      }
      const check = validateProjectBrief({
        title: req.body.title ?? existing.title,
        brief: req.body.brief ?? existing.brief,
        categoryId: req.body.categoryId ?? existing.categoryId,
        scopeOfWork: req.body.scopeOfWork ?? existing.scopeOfWork,
        deliverables: req.body.deliverables ?? existing.deliverables,
        acceptanceCriteria: req.body.acceptanceCriteria ?? existing.acceptanceCriteria,
        budgetType: req.body.budgetType ?? existing.budgetType,
        budgetMin: req.body.budgetMin ?? existing.budgetMin,
        budgetMax: req.body.budgetMax ?? existing.budgetMax,
        deadline: req.body.deadline ?? existing.deadline,
        requiredSkills: req.body.requiredSkills ?? existing.requiredSkills,
        sampleRequested: req.body.sampleRequested ?? existing.sampleRequested,
        samplePaid: req.body.samplePaid ?? existing.samplePaid,
        sampleDetails: req.body.sampleDetails ?? existing.sampleDetails,
      });
      if (!check.canPublish) {
        return res.status(400).json({ error: check.blockingErrors[0], blockingErrors: check.blockingErrors });
      }
    }

    const [updated] = await db
      .update(projects)
      .set({
        title: req.body.title ?? existing.title,
        brief: req.body.brief ?? existing.brief,
        categoryId: req.body.categoryId ?? existing.categoryId,
        subcategory: req.body.subcategory ?? existing.subcategory,
        requiredSkills: req.body.requiredSkills ?? existing.requiredSkills,
        scopeOfWork: req.body.scopeOfWork ?? existing.scopeOfWork,
        deliverables: req.body.deliverables ?? existing.deliverables,
        acceptanceCriteria: req.body.acceptanceCriteria ?? existing.acceptanceCriteria,
        budgetType: req.body.budgetType ?? existing.budgetType,
        budgetMin: req.body.budgetMin ?? existing.budgetMin,
        budgetMax: req.body.budgetMax ?? existing.budgetMax,
        deadline: req.body.deadline ?? existing.deadline,
        estimatedDuration: req.body.estimatedDuration ?? existing.estimatedDuration,
        urgency: req.body.urgency ?? existing.urgency,
        experienceLevel: req.body.experienceLevel ?? existing.experienceLevel,
        screeningQuestions: req.body.screeningQuestions ?? existing.screeningQuestions,
        sampleRequested: req.body.sampleRequested ?? existing.sampleRequested,
        samplePaid: req.body.samplePaid ?? existing.samplePaid,
        sampleDetails: req.body.sampleDetails ?? existing.sampleDetails,
        revisionPolicy: req.body.revisionPolicy ?? existing.revisionPolicy,
        additionalTerms: req.body.additionalTerms ?? existing.additionalTerms,
        allowPublicQa: req.body.allowPublicQa ?? existing.allowPublicQa,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error('Update project failed:', err);
    return res.status(500).json({ error: 'Failed to update project.' });
  }
});

router.post('/api/projects/:id/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const existing = await db
      .select()
      .from(savedProjects)
      .where(and(eq(savedProjects.userId, req.currentUser!.id), eq(savedProjects.projectId, projectId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(savedProjects).where(eq(savedProjects.id, existing[0].id));
      return res.json({ saved: false });
    }
    await db.insert(savedProjects).values({ userId: req.currentUser!.id, projectId });
    return res.json({ saved: true });
  } catch (err) {
    console.error('Toggle save project failed:', err);
    return res.status(500).json({ error: 'Failed to update saved project.' });
  }
});

router.post('/api/projects/:id/questions', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (!proj.allowPublicQa) {
      return res.status(403).json({ error: 'Public clarification questions are disabled on this brief.' });
    }
    const questionText = stripContactDetails(String(req.body?.question || '').trim());
    if (questionText.length < 8) {
      return res.status(400).json({ error: 'Question must be at least 8 characters.' });
    }
    const [created] = await db
      .insert(projectQuestions)
      .values({
        projectId,
        authorId: req.currentUser!.id,
        question: questionText,
      })
      .returning();

    if (proj.buyerId !== req.currentUser!.id) {
      await db.insert(notifications).values({
        userId: proj.buyerId,
        type: 'project_qa',
        title: 'New clarification question on your brief',
        body: `${req.currentUser!.name} asked a question on "${proj.title}".`,
        linkPath: `/projects/${projectId}`,
      });
    }
    return res.status(201).json({ ...created, authorName: req.currentUser!.name });
  } catch (err) {
    console.error('Post question failed:', err);
    return res.status(500).json({ error: 'Failed to post question.' });
  }
});

router.post('/api/projects/:id/questions/:qId/answer', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const qId = Number(req.params.qId);
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (proj.buyerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project buyer can answer clarification questions.' });
    }
    const answerText = stripContactDetails(String(req.body?.answer || '').trim());
    if (answerText.length < 3) return res.status(400).json({ error: 'Answer cannot be empty.' });

    const [updated] = await db
      .update(projectQuestions)
      .set({ answer: answerText, answeredAt: new Date() })
      .where(and(eq(projectQuestions.id, qId), eq(projectQuestions.projectId, projectId)))
      .returning();

    if (updated) {
      await db.insert(notifications).values({
        userId: updated.authorId,
        type: 'project_qa',
        title: 'Buyer answered your question',
        body: `Your clarification question on "${proj.title}" has been answered.`,
        linkPath: `/projects/${projectId}`,
      });
    }
    return res.json(updated);
  } catch (err) {
    console.error('Answer question failed:', err);
    return res.status(500).json({ error: 'Failed to submit answer.' });
  }
});

// Seller submits a structured proposal
router.post('/api/projects/:id/proposals', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    if (!req.currentUser!.canSell && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Enable Seller mode in your account to submit proposals.' });
    }
    const projectId = Number(req.params.id);
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (proj.status !== 'open') return res.status(400).json({ error: 'This project is not currently accepting proposals.' });
    if (proj.buyerId === req.currentUser!.id) {
      return res.status(400).json({ error: 'You cannot submit a proposal to your own project.' });
    }

    const schema = z.object({
      coverLetter: z.string().trim().min(30, 'Cover letter must be at least 30 characters.').max(4000),
      proposedPrice: z.number().int().positive('Enter a valid proposed price.'),
      pricingType: z.enum(['fixed', 'hourly']).default('fixed'),
      currency: z.string().trim().default(proj.currency || 'USD'),
      estimatedTimeline: z.string().trim().min(2, 'Estimated timeline is required.').max(120),
      availability: z.string().trim().max(160).default('Immediate'),
      answers: z.array(z.object({ question: z.string(), answer: z.string().trim().min(1) })).default([]),
      milestonePlan: z
        .array(
          z.object({
            title: z.string().trim().min(2),
            deliverables: z.string().trim().default(''),
            amount: z.number().int().min(0),
            dueOffsetDays: z.number().int().min(1).default(14),
          })
        )
        .default([]),
      portfolioItemIds: z.array(z.number().int()).default([]),
      attachCv: z.boolean().default(true),
      sampleFileId: z.number().int().nullable().optional(),
      sampleNote: z.string().trim().max(1000).default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid proposal details.' });
    }

    const existing = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.projectId, projectId), eq(proposals.sellerId, req.currentUser!.id)))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You have already submitted a proposal for this project.' });
    }

    const [created] = await db
      .insert(proposals)
      .values({
        projectId,
        sellerId: req.currentUser!.id,
        ...parsed.data,
        sampleFileId: parsed.data.sampleFileId ?? null,
        status: 'submitted',
      })
      .returning();

    await db.insert(notifications).values({
      userId: proj.buyerId,
      type: 'proposal',
      title: `New proposal on "${proj.title}"`,
      body: `${req.currentUser!.name} submitted a proposal for ${parsed.data.currency} ${parsed.data.proposedPrice.toLocaleString()}.`,
      linkPath: `/projects/${projectId}/applications`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Submit proposal failed:', err);
    return res.status(500).json({ error: 'Failed to submit proposal.' });
  }
});

// Buyer application management & side-by-side comparison (OWNER OR ADMIN ONLY)
router.get('/api/projects/:id/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (proj.buyerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project owner can view applicant proposals.' });
    }

    const rows = await db
      .select({
        proposal: proposals,
        sellerName: users.name,
        sellerAvatar: users.avatarUrl,
        sellerVerified: users.emailVerified,
        sellerHeadline: sellerProfiles.headline,
        sellerSkills: sellerProfiles.skills,
        sellerRate: sellerProfiles.hourlyRate,
        sellerLocation: sellerProfiles.location,
        sellerAvailability: sellerProfiles.availability,
        sellerCvFileId: sellerProfiles.cvFileId,
      })
      .from(proposals)
      .innerJoin(users, eq(proposals.sellerId, users.id))
      .leftJoin(sellerProfiles, eq(proposals.sellerId, sellerProfiles.userId))
      .where(eq(proposals.projectId, projectId))
      .orderBy(desc(proposals.createdAt));

    const sellerIds = rows.map((r) => r.proposal.sellerId);
    const portfolioRows = sellerIds.length
      ? await db.select().from(portfolioItems).where(inArray(portfolioItems.sellerId, sellerIds))
      : [];
    const reviewRows = sellerIds.length
      ? await db
          .select({ revieweeId: reviews.revieweeId, ratingOverall: reviews.ratingOverall })
          .from(reviews)
          .where(and(inArray(reviews.revieweeId, sellerIds), eq(reviews.isHidden, false)))
      : [];

    const fileIds = [
      ...rows.map((r) => r.sellerCvFileId).filter((id): id is number => Boolean(id)),
      ...rows.map((r) => r.proposal.sampleFileId).filter((id): id is number => Boolean(id)),
    ];
    const filesMeta = fileIds.length
      ? await db
          .select({ id: storedFiles.id, fileName: storedFiles.fileName, sizeBytes: storedFiles.sizeBytes })
          .from(storedFiles)
          .where(inArray(storedFiles.id, fileIds))
      : [];
    const fileMap = new Map(filesMeta.map((f) => [f.id, f]));

    const contractRows = await db.select().from(contracts).where(eq(contracts.projectId, projectId));
    const contractByProposal = new Map(contractRows.map((c) => [c.proposalId, c]));

    const enriched = rows.map((r) => {
      const sReviews = reviewRows.filter((rev) => rev.revieweeId === r.proposal.sellerId);
      const avgRating = sReviews.length
        ? Number((sReviews.reduce((a, b) => a + b.ratingOverall, 0) / sReviews.length).toFixed(1))
        : null;
      const attachedPortfolio = portfolioRows.filter((p) => p.sellerId === r.proposal.sellerId);
      const contract = contractByProposal.get(r.proposal.id) || null;
      return {
        ...r.proposal,
        seller: {
          id: r.proposal.sellerId,
          name: r.sellerName,
          avatarUrl: r.sellerAvatar,
          emailVerified: r.sellerVerified,
          headline: r.sellerHeadline || '',
          skills: r.sellerSkills || [],
          hourlyRate: r.sellerRate,
          location: r.sellerLocation || '',
          availability: r.sellerAvailability || 'available',
          avgRating,
          reviewCount: sReviews.length,
        },
        cvFile: r.proposal.attachCv && r.sellerCvFileId ? fileMap.get(r.sellerCvFileId) || null : null,
        sampleFile: r.proposal.sampleFileId ? fileMap.get(r.proposal.sampleFileId) || null : null,
        portfolio: attachedPortfolio,
        contract,
      };
    });

    return res.json({ project: proj, applications: enriched });
  } catch (err) {
    console.error('Get applications failed:', err);
    return res.status(500).json({ error: 'Failed to load applications.' });
  }
});

router.patch('/api/proposals/:id/status', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const proposalId = Number(req.params.id);
    const [prop] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!prop) return res.status(404).json({ error: 'Proposal not found.' });

    const [proj] = await db.select().from(projects).where(eq(projects.id, prop.projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    const status = String(req.body?.status || '');
    if (status === 'withdrawn') {
      if (prop.sellerId !== req.currentUser!.id) {
        return res.status(403).json({ error: 'Only the applicant can withdraw a proposal.' });
      }
    } else if (proj.buyerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project buyer can update application status.' });
    }

    const allowed = new Set(['viewed', 'shortlisted', 'info_requested', 'declined', 'withdrawn']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid proposal status transition.' });
    }

    const declineReason = status === 'declined' ? String(req.body?.declineReason || '').trim() || null : prop.declineReason;
    const infoRequestNote =
      status === 'info_requested' ? String(req.body?.infoRequestNote || '').trim() || null : prop.infoRequestNote;

    const [updated] = await db
      .update(proposals)
      .set({
        status,
        declineReason,
        infoRequestNote,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId))
      .returning();

    if (status !== 'withdrawn') {
      const statusLabels: Record<string, string> = {
        viewed: 'Your proposal was reviewed',
        shortlisted: 'You have been shortlisted',
        info_requested: 'Client requested additional details or a sample',
        declined: 'Application status updated',
      };
      await db.insert(notifications).values({
        userId: prop.sellerId,
        type: 'proposal_status',
        title: statusLabels[status] || 'Proposal updated',
        body:
          status === 'info_requested' && infoRequestNote
            ? `${proj.title}: ${infoRequestNote}`
            : `Your proposal on "${proj.title}" is now marked "${status.replace('_', ' ')}".`,
        linkPath: `/projects/${proj.id}`,
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Update proposal status failed:', err);
    return res.status(500).json({ error: 'Failed to update proposal status.' });
  }
});

// Buyer initiates hiring & contract agreement (requires dual-party acceptance before activation)
router.post('/api/proposals/:id/hire', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const proposalId = Number(req.params.id);
    const [prop] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!prop) return res.status(404).json({ error: 'Proposal not found.' });

    const [proj] = await db.select().from(projects).where(eq(projects.id, prop.projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (proj.buyerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project buyer can send a hiring offer.' });
    }

    const schema = z.object({
      agreedScope: z.string().trim().min(10, 'Agreed scope summary is required.'),
      agreedDeliverables: z.array(z.string().trim().min(1)).default([]),
      agreedPrice: z.number().int().positive(),
      deadline: z.string().trim().default(proj.deadline || ''),
      revisionPolicy: z.string().trim().min(5),
      responsibilities: z.string().trim().min(10),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contract terms.' });
    }

    // Check if contract already exists for this proposal
    const existing = await db.select().from(contracts).where(eq(contracts.proposalId, proposalId)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An offer/contract already exists for this proposal.' });
    }

    const [createdContract] = await db
      .insert(contracts)
      .values({
        projectId: proj.id,
        proposalId: prop.id,
        buyerId: proj.buyerId,
        sellerId: prop.sellerId,
        agreedScope: parsed.data.agreedScope,
        agreedDeliverables:
          parsed.data.agreedDeliverables.length > 0 ? parsed.data.agreedDeliverables : proj.deliverables,
        agreedPrice: parsed.data.agreedPrice,
        pricingType: prop.pricingType,
        currency: prop.currency,
        deadline: parsed.data.deadline,
        revisionPolicy: parsed.data.revisionPolicy,
        responsibilities: parsed.data.responsibilities,
        buyerAcceptedAt: new Date(),
        sellerAcceptedAt: null,
        status: 'pending_acceptance',
      })
      .returning();

    await db
      .update(proposals)
      .set({ status: 'offer_sent', updatedAt: new Date() })
      .where(eq(proposals.id, proposalId));

    await db.insert(notifications).values({
      userId: prop.sellerId,
      type: 'offer_received',
      title: `Offer received for "${proj.title}"`,
      body: `Review and accept the agreed scope (${prop.currency} ${parsed.data.agreedPrice.toLocaleString()}) to activate your private workspace.`,
      linkPath: `/contracts/${createdContract.id}`,
    });

    return res.status(201).json(createdContract);
  } catch (err) {
    console.error('Create hire offer failed:', err);
    return res.status(500).json({ error: 'Failed to create hiring offer.' });
  }
});

router.get('/api/contracts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const contractId = Number(req.params.id);
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!contract) return res.status(404).json({ error: 'Contract not found.' });
    if (
      !req.currentUser!.isAdmin &&
      req.currentUser!.id !== contract.buyerId &&
      req.currentUser!.id !== contract.sellerId
    ) {
      return res.status(403).json({ error: 'You are not a party to this contract.' });
    }

    const [proj] = await db.select().from(projects).where(eq(projects.id, contract.projectId)).limit(1);
    const [prop] = await db.select().from(proposals).where(eq(proposals.id, contract.proposalId)).limit(1);
    const [buyer] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, contract.buyerId))
      .limit(1);
    const [seller] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, contract.sellerId))
      .limit(1);
    const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.contractId, contract.id)).limit(1);

    return res.json({
      contract,
      projectTitle: proj?.title || 'Project',
      milestonePlan: prop?.milestonePlan || [],
      buyer,
      seller,
      workspaceId: ws?.id || null,
    });
  } catch (err) {
    console.error('Fetch contract failed:', err);
    return res.status(500).json({ error: 'Failed to load contract.' });
  }
});

// Dual-party acceptance automatically activates contract and creates the private workspace
router.post('/api/contracts/:id/accept', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const contractId = Number(req.params.id);
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!contract) return res.status(404).json({ error: 'Contract not found.' });

    const isBuyer = req.currentUser!.id === contract.buyerId;
    const isSeller = req.currentUser!.id === contract.sellerId;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Only contract participants may accept terms.' });
    }

    const now = new Date();
    const buyerAcceptedAt = isBuyer ? contract.buyerAcceptedAt || now : contract.buyerAcceptedAt;
    const sellerAcceptedAt = isSeller ? contract.sellerAcceptedAt || now : contract.sellerAcceptedAt;
    const bothAccepted = Boolean(buyerAcceptedAt && sellerAcceptedAt);

    const [updated] = await db
      .update(contracts)
      .set({
        buyerAcceptedAt,
        sellerAcceptedAt,
        status: bothAccepted ? 'active' : 'pending_acceptance',
      })
      .where(eq(contracts.id, contractId))
      .returning();

    let workspaceRecord = null;
    if (bothAccepted) {
      const existingWs = await db.select().from(workspaces).where(eq(workspaces.contractId, contract.id)).limit(1);
      if (existingWs.length > 0) {
        workspaceRecord = existingWs[0];
      } else {
        const [createdWs] = await db
          .insert(workspaces)
          .values({
            contractId: contract.id,
            projectId: contract.projectId,
            buyerId: contract.buyerId,
            sellerId: contract.sellerId,
            status: 'active',
          })
          .returning();
        workspaceRecord = createdWs;

        // Mark proposal accepted and project hired
        await db.update(proposals).set({ status: 'accepted', updatedAt: now }).where(eq(proposals.id, contract.proposalId));
        await db.update(projects).set({ status: 'hired', updatedAt: now }).where(eq(projects.id, contract.projectId));

        // Seed milestones from proposal plan or create default single final milestone
        const [prop] = await db.select().from(proposals).where(eq(proposals.id, contract.proposalId)).limit(1);
        const plan = prop?.milestonePlan && prop.milestonePlan.length > 0
          ? prop.milestonePlan
          : [
              {
                title: 'Final Project Delivery',
                deliverables: contract.agreedDeliverables.join('; ') || 'Agreed scope deliverables',
                amount: contract.agreedPrice,
                dueOffsetDays: 21,
              },
            ];

        await db.insert(milestones).values(
          plan.map((m, idx) => {
            const due = new Date(Date.now() + (m.dueOffsetDays || (idx + 1) * 14) * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10);
            return {
              workspaceId: createdWs.id,
              title: m.title,
              deliverables: m.deliverables || '',
              amount: m.amount,
              currency: contract.currency,
              dueDate: due,
              status: idx === 0 ? 'in_progress' : 'pending',
              paymentStatus: 'unpaid',
              sortOrder: idx + 1,
            };
          })
        );

        await db.insert(activityEvents).values({
          workspaceId: createdWs.id,
          actorId: req.currentUser!.id,
          actorName: req.currentUser!.name,
          eventType: 'workspace_created',
          summary: 'Both parties accepted contract terms. Private project workspace is now active.',
        });

        const [proj] = await db.select({ title: projects.title }).from(projects).where(eq(projects.id, contract.projectId)).limit(1);
        await db.insert(notifications).values([
          {
            userId: contract.buyerId,
            type: 'workspace_active',
            title: 'Private workspace created',
            body: `Terms accepted for "${proj?.title || 'your project'}". Enter your private project room.`,
            linkPath: `/workspace/${createdWs.id}`,
          },
          {
            userId: contract.sellerId,
            type: 'workspace_active',
            title: 'Private workspace created',
            body: `Terms accepted for "${proj?.title || 'your project'}". You can now start milestones and tasks.`,
            linkPath: `/workspace/${createdWs.id}`,
          },
        ]);
      }
    }

    return res.json({ contract: updated, workspace: workspaceRecord });
  } catch (err) {
    console.error('Accept contract failed:', err);
    return res.status(500).json({ error: 'Failed to accept contract terms.' });
  }
});

// Unified Buyer & Seller Dashboard payload
router.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;

    // Buyer side data
    const myProjects = await db
      .select({
        project: projects,
        categoryName: categories.name,
      })
      .from(projects)
      .innerJoin(categories, eq(projects.categoryId, categories.id))
      .where(eq(projects.buyerId, userId))
      .orderBy(desc(projects.updatedAt));

    const myProjectIds = myProjects.map((p) => p.project.id);
    const receivedProposals = myProjectIds.length
      ? await db
          .select({
            id: proposals.id,
            projectId: proposals.projectId,
            status: proposals.status,
            proposedPrice: proposals.proposedPrice,
            currency: proposals.currency,
            sellerName: users.name,
            createdAt: proposals.createdAt,
          })
          .from(proposals)
          .innerJoin(users, eq(proposals.sellerId, users.id))
          .where(inArray(proposals.projectId, myProjectIds))
          .orderBy(desc(proposals.createdAt))
      : [];

    // Seller side data
    const myProposals = await db
      .select({
        proposal: proposals,
        projectTitle: projects.title,
        projectStatus: projects.status,
        buyerName: users.name,
      })
      .from(proposals)
      .innerJoin(projects, eq(proposals.projectId, projects.id))
      .innerJoin(users, eq(projects.buyerId, users.id))
      .where(eq(proposals.sellerId, userId))
      .orderBy(desc(proposals.updatedAt));

    const mySaved = await db
      .select({
        project: projects,
        categoryName: categories.name,
      })
      .from(savedProjects)
      .innerJoin(projects, eq(savedProjects.projectId, projects.id))
      .innerJoin(categories, eq(projects.categoryId, categories.id))
      .where(eq(savedProjects.userId, userId))
      .orderBy(desc(savedProjects.createdAt));

    // Recommended open projects for seller (excluding own projects)
    const recommended = await db
      .select({
        project: projects,
        categoryName: categories.name,
        buyerName: users.name,
      })
      .from(projects)
      .innerJoin(categories, eq(projects.categoryId, categories.id))
      .innerJoin(users, eq(projects.buyerId, users.id))
      .where(and(eq(projects.status, 'open'), eq(projects.visibility, 'public')))
      .orderBy(desc(projects.createdAt))
      .limit(6);

    // Contracts pending acceptance
    const pendingContracts = await db
      .select({
        contract: contracts,
        projectTitle: projects.title,
      })
      .from(contracts)
      .innerJoin(projects, eq(contracts.projectId, projects.id))
      .where(
        and(
          eq(contracts.status, 'pending_acceptance'),
          or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId))
        )
      );

    // Workspaces where user is participant
    const myWorkspaces = await db
      .select({
        workspace: workspaces,
        projectTitle: projects.title,
        agreedPrice: contracts.agreedPrice,
        currency: contracts.currency,
        deadline: contracts.deadline,
      })
      .from(workspaces)
      .innerJoin(projects, eq(workspaces.projectId, projects.id))
      .innerJoin(contracts, eq(workspaces.contractId, contracts.id))
      .where(or(eq(workspaces.buyerId, userId), eq(workspaces.sellerId, userId)))
      .orderBy(desc(workspaces.updatedAt));

    const wsIds = myWorkspaces.map((w) => w.workspace.id);
    const myReviews = wsIds.length
      ? await db
          .select({ workspaceId: reviews.workspaceId, reviewerId: reviews.reviewerId })
          .from(reviews)
          .where(and(inArray(reviews.workspaceId, wsIds), eq(reviews.reviewerId, userId)))
      : [];
    const reviewedWsSet = new Set(myReviews.map((r) => r.workspaceId));

    const participantIds = Array.from(
      new Set(myWorkspaces.flatMap((w) => [w.workspace.buyerId, w.workspace.sellerId]))
    );
    const participantRows = participantIds.length
      ? await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, participantIds))
      : [];
    const userMap = new Map(participantRows.map((u) => [u.id, u]));

    const formattedWorkspaces = myWorkspaces.map((w) => ({
      ...w.workspace,
      projectTitle: w.projectTitle,
      agreedPrice: w.agreedPrice,
      currency: w.currency,
      deadline: w.deadline,
      buyer: userMap.get(w.workspace.buyerId) || null,
      seller: userMap.get(w.workspace.sellerId) || null,
      needsMyReview: w.workspace.status === 'completed' && !reviewedWsSet.has(w.workspace.id),
    }));

    return res.json({
      buyer: {
        projects: myProjects.map((p) => ({
          ...p.project,
          categoryName: p.categoryName,
          proposalCount: receivedProposals.filter((pr) => pr.projectId === p.project.id).length,
          shortlistedCount: receivedProposals.filter((pr) => pr.projectId === p.project.id && pr.status === 'shortlisted').length,
        })),
        recentApplications: receivedProposals.slice(0, 8),
        workspaces: formattedWorkspaces.filter((w) => w.buyerId === userId),
        pendingContracts: pendingContracts.filter((c) => c.contract.buyerId === userId),
      },
      seller: {
        proposals: myProposals.map((p) => {
          const { declineReason: _hide, ...safeProp } = p.proposal;
          return {
            ...safeProp,
            projectTitle: p.projectTitle,
            projectStatus: p.projectStatus,
            buyerName: p.buyerName,
          };
        }),
        savedProjects: mySaved.map((s) => ({ ...s.project, categoryName: s.categoryName })),
        recommendedProjects: recommended
          .filter((r) => r.project.buyerId !== userId)
          .map((r) => ({ ...r.project, categoryName: r.categoryName, buyerName: r.buyerName })),
        workspaces: formattedWorkspaces.filter((w) => w.sellerId === userId),
        pendingContracts: pendingContracts.filter((c) => c.contract.sellerId === userId),
      },
    });
  } catch (err) {
    console.error('Dashboard load failed:', err);
    return res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

export default router;
