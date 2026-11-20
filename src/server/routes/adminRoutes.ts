import { Router } from 'express';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminAuditLogs,
  categories,
  contracts,
  projects,
  proposals,
  reports,
  reviews,
  users,
  workspaces,
} from '../../db/schema.ts';
import { type AuthRequest, requireAdmin, requireAuth } from '../auth.ts';
import { checkSupabaseHealth } from '../supabase.ts';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

const router = Router();

router.use('/api/admin', requireAuth, requireAdmin);

router.get('/api/admin/overview', async (_req, res) => {
  try {
    const [allUsers, allProjects, allProposals, allContracts, allWorkspaces, allReports, allCategories, auditLogs] =
      await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            canBuy: users.canBuy,
            canSell: users.canSell,
            activeRole: users.activeRole,
            isAdmin: users.isAdmin,
            emailVerified: users.emailVerified,
            isRestricted: users.isRestricted,
            restrictionReason: users.restrictionReason,
            isDemo: users.isDemo,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt)),
        db
          .select({
            id: projects.id,
            title: projects.title,
            status: projects.status,
            budgetMin: projects.budgetMin,
            budgetMax: projects.budgetMax,
            currency: projects.currency,
            visibility: projects.visibility,
            isDemo: projects.isDemo,
            buyerName: users.name,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .innerJoin(users, eq(projects.buyerId, users.id))
          .orderBy(desc(projects.createdAt)),
        db.select({ id: proposals.id, status: proposals.status }).from(proposals),
        db.select({ id: contracts.id, status: contracts.status }).from(contracts),
        db.select({ id: workspaces.id, status: workspaces.status }).from(workspaces),
        db
          .select({
            report: reports,
            reporterName: users.name,
          })
          .from(reports)
          .innerJoin(users, eq(reports.reporterId, users.id))
          .orderBy(desc(reports.createdAt)),
        db.select().from(categories).orderBy(asc(categories.sortOrder)),
        db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(40),
      ]);

    const completedCount = allWorkspaces.filter((w) => w.status === 'completed').length;
    const completionRate = allWorkspaces.length ? Math.round((completedCount / allWorkspaces.length) * 100) : 0;

    return res.json({
      metrics: {
        totalUsers: allUsers.length,
        totalProjects: allProjects.length,
        openProjects: allProjects.filter((p) => p.status === 'open').length,
        totalApplications: allProposals.length,
        totalHires: allContracts.filter((c) => c.status === 'active' || c.status === 'completed').length,
        completionRate,
        openReports: allReports.filter((r) => r.report.status === 'open' || r.report.status === 'investigating').length,
      },
      users: allUsers,
      projects: allProjects,
      reports: allReports.map((r) => ({ ...r.report, reporterName: r.reporterName })),
      categories: allCategories,
      auditLogs,
    });
  } catch (err) {
    console.error('Admin overview failed:', err);
    return res.status(500).json({ error: 'Failed to load admin console data.' });
  }
});

router.patch('/api/admin/users/:id', async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const [updated] = await db
      .update(users)
      .set({
        isRestricted: req.body.isRestricted ?? target.isRestricted,
        restrictionReason:
          req.body.restrictionReason !== undefined ? req.body.restrictionReason : target.restrictionReason,
        isAdmin: req.body.isAdmin ?? target.isAdmin,
        canBuy: req.body.canBuy ?? target.canBuy,
        canSell: req.body.canSell ?? target.canSell,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning();

    await db.insert(adminAuditLogs).values({
      adminId: req.currentUser!.id,
      adminName: req.currentUser!.name,
      action: 'user_updated',
      targetType: 'user',
      targetId,
      details: `Updated user ${target.email}: restricted=${updated.isRestricted}, admin=${updated.isAdmin}.`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Admin update user failed:', err);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.patch('/api/admin/projects/:id', async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const status = String(req.body?.status || '');
    const allowed = new Set(['open', 'paused', 'closed', 'cancelled']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid project moderation status.' });

    const [updated] = await db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Project not found.' });

    await db.insert(adminAuditLogs).values({
      adminId: req.currentUser!.id,
      adminName: req.currentUser!.name,
      action: 'project_moderated',
      targetType: 'project',
      targetId: projectId,
      details: `Set project "${updated.title}" status to ${status}.`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Admin moderate project failed:', err);
    return res.status(500).json({ error: 'Failed to moderate project.' });
  }
});

router.patch('/api/admin/reports/:id', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.id);
    const status = String(req.body?.status || '');
    const resolutionNote = String(req.body?.resolutionNote || '').trim();
    const hideReview = Boolean(req.body?.hideReview);

    const allowed = new Set(['open', 'investigating', 'resolved', 'dismissed']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid report status.' });

    const [updated] = await db
      .update(reports)
      .set({
        status,
        resolutionNote,
        resolvedById: req.currentUser!.id,
        resolvedAt: status === 'resolved' || status === 'dismissed' ? new Date() : null,
      })
      .where(eq(reports.id, reportId))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Report not found.' });

    if (hideReview && updated.targetType === 'review') {
      await db.update(reviews).set({ isHidden: true }).where(eq(reviews.id, updated.targetId));
    }

    await db.insert(adminAuditLogs).values({
      adminId: req.currentUser!.id,
      adminName: req.currentUser!.name,
      action: 'report_updated',
      targetType: updated.targetType,
      targetId: updated.targetId,
      details: `Marked report #${reportId} as ${status}. ${resolutionNote}`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Admin update report failed:', err);
    return res.status(500).json({ error: 'Failed to update report.' });
  }
});

router.post('/api/admin/categories', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).default(''),
      subcategories: z.array(z.string().trim().min(1)).default([]),
      suggestedSkills: z.array(z.string().trim().min(1)).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category payload.' });

    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const [created] = await db
      .insert(categories)
      .values({
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        subcategories: parsed.data.subcategories,
        suggestedSkills: parsed.data.suggestedSkills,
      })
      .returning();

    await db.insert(adminAuditLogs).values({
      adminId: req.currentUser!.id,
      adminName: req.currentUser!.name,
      action: 'category_created',
      targetType: 'category',
      targetId: created.id,
      details: `Created marketplace category "${created.name}".`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create category failed:', err);
    return res.status(500).json({ error: 'Failed to create category (name may already exist).' });
  }
});

router.get('/api/admin/integrations', async (_req, res) => {
  try {
    const supabaseStatus = await checkSupabaseHealth();
    return res.json({
      firebase: {
        projectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        authConfigured: Boolean(firebaseConfig.apiKey),
      },
      supabase: supabaseStatus,
    });
  } catch (err) {
    console.error('Integration status check failed:', err);
    return res.status(500).json({ error: 'Failed to check backend integrations.' });
  }
});

export default router;
