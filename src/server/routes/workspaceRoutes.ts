import crypto from 'node:crypto';
import { Router } from 'express';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  activityEvents,
  changeRequests,
  contracts,
  directMessages,
  milestones,
  notifications,
  projects,
  reports,
  reviews,
  storedFiles,
  submissions,
  users,
  workspaceMessages,
  workspaces,
  workspaceTasks,
} from '../../db/schema.ts';
import { canAccessWorkspace, canSubmitReview } from '../../utils/domain.ts';
import { type AuthRequest, requireAuth, requireUnrestricted } from '../auth.ts';

const router = Router();

type WorkspaceAuthResult =
  | { errorStatus: number; error: string }
  | { ws: typeof workspaces.$inferSelect };

async function loadAuthorizedWorkspace(req: AuthRequest): Promise<WorkspaceAuthResult> {
  const workspaceId = Number(req.params.id);
  if (!Number.isInteger(workspaceId)) {
    return { errorStatus: 400, error: 'Invalid workspace ID.' };
  }
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!ws) {
    return { errorStatus: 404, error: 'Workspace not found.' };
  }
  if (!canAccessWorkspace(req.currentUser, ws)) {
    return {
      errorStatus: 403,
      error: 'Access denied. This private workspace is restricted to the hired freelancer, client, and authorized admins.',
    };
  }
  return { ws };
}

router.get('/api/workspaces', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const rows = await db
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
      .where(
        req.currentUser!.isAdmin
          ? undefined
          : or(eq(workspaces.buyerId, userId), eq(workspaces.sellerId, userId))
      )
      .orderBy(desc(workspaces.updatedAt));

    return res.json(
      rows.map((r) => ({
        ...r.workspace,
        projectTitle: r.projectTitle,
        agreedPrice: r.agreedPrice,
        currency: r.currency,
        deadline: r.deadline,
      }))
    );
  } catch (err) {
    console.error('List workspaces failed:', err);
    return res.status(500).json({ error: 'Failed to load workspaces.' });
  }
});

router.get('/api/workspaces/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const [contract] = await db.select().from(contracts).where(eq(contracts.id, ws.contractId)).limit(1);
    const [project] = await db.select().from(projects).where(eq(projects.id, ws.projectId)).limit(1);
    const [buyer] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, ws.buyerId))
      .limit(1);
    const [seller] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, ws.sellerId))
      .limit(1);

    // Mark messages read for current viewer
    if (req.currentUser!.id === ws.buyerId) {
      await db.update(workspaceMessages).set({ readByBuyer: true }).where(eq(workspaceMessages.workspaceId, ws.id));
    } else if (req.currentUser!.id === ws.sellerId) {
      await db.update(workspaceMessages).set({ readBySeller: true }).where(eq(workspaceMessages.workspaceId, ws.id));
    }

    const [msgs, tasks, msList, files, crList, subList, events, wsReviews] = await Promise.all([
      db
        .select({
          id: workspaceMessages.id,
          senderId: workspaceMessages.senderId,
          senderName: users.name,
          senderAvatar: users.avatarUrl,
          body: workspaceMessages.body,
          readByBuyer: workspaceMessages.readByBuyer,
          readBySeller: workspaceMessages.readBySeller,
          createdAt: workspaceMessages.createdAt,
        })
        .from(workspaceMessages)
        .innerJoin(users, eq(workspaceMessages.senderId, users.id))
        .where(eq(workspaceMessages.workspaceId, ws.id))
        .orderBy(asc(workspaceMessages.createdAt)),
      db.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, ws.id)).orderBy(asc(workspaceTasks.createdAt)),
      db.select().from(milestones).where(eq(milestones.workspaceId, ws.id)).orderBy(asc(milestones.sortOrder), asc(milestones.id)),
      db
        .select({
          id: storedFiles.id,
          ownerId: storedFiles.ownerId,
          ownerName: users.name,
          fileName: storedFiles.fileName,
          mimeType: storedFiles.mimeType,
          sizeBytes: storedFiles.sizeBytes,
          version: storedFiles.version,
          versionGroup: storedFiles.versionGroup,
          createdAt: storedFiles.createdAt,
        })
        .from(storedFiles)
        .innerJoin(users, eq(storedFiles.ownerId, users.id))
        .where(and(eq(storedFiles.scope, 'workspace'), eq(storedFiles.scopeRefId, ws.id)))
        .orderBy(desc(storedFiles.createdAt)),
      db
        .select({
          cr: changeRequests,
          requesterName: users.name,
        })
        .from(changeRequests)
        .innerJoin(users, eq(changeRequests.requesterId, users.id))
        .where(eq(changeRequests.workspaceId, ws.id))
        .orderBy(desc(changeRequests.createdAt)),
      db.select().from(submissions).where(eq(submissions.workspaceId, ws.id)).orderBy(desc(submissions.createdAt)),
      db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.workspaceId, ws.id))
        .orderBy(desc(activityEvents.createdAt)),
      db
        .select({
          id: reviews.id,
          reviewerId: reviews.reviewerId,
          reviewerName: users.name,
          reviewerRole: reviews.reviewerRole,
          ratingOverall: reviews.ratingOverall,
          ratingCommunication: reviews.ratingCommunication,
          ratingQuality: reviews.ratingQuality,
          ratingReliability: reviews.ratingReliability,
          ratingProfessionalism: reviews.ratingProfessionalism,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.reviewerId, users.id))
        .where(eq(reviews.workspaceId, ws.id)),
    ]);

    const reviewCheck = canSubmitReview(
      ws,
      req.currentUser!.id,
      wsReviews.map((r) => r.reviewerId)
    );

    return res.json({
      workspace: ws,
      contract,
      project: project
        ? {
            id: project.id,
            title: project.title,
            brief: project.brief,
            acceptanceCriteria: project.acceptanceCriteria,
            deliverables: project.deliverables,
          }
        : null,
      buyer,
      seller,
      messages: msgs,
      tasks,
      milestones: msList,
      files,
      changeRequests: crList.map((r) => ({ ...r.cr, requesterName: r.requesterName })),
      submissions: subList,
      activityEvents: events,
      reviews: wsReviews,
      reviewEligibility: reviewCheck,
    });
  } catch (err) {
    console.error('Load workspace failed:', err);
    return res.status(500).json({ error: 'Failed to load private workspace.' });
  }
});

router.post('/api/workspaces/:id/messages', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const body = String(req.body?.body || '').trim();
    if (!body || body.length > 4000) {
      return res.status(400).json({ error: 'Message must be between 1 and 4,000 characters.' });
    }

    const isBuyer = req.currentUser!.id === ws.buyerId;
    const [created] = await db
      .insert(workspaceMessages)
      .values({
        workspaceId: ws.id,
        senderId: req.currentUser!.id,
        body,
        readByBuyer: isBuyer,
        readBySeller: !isBuyer,
      })
      .returning();

    const recipientId = isBuyer ? ws.sellerId : ws.buyerId;
    if (recipientId !== req.currentUser!.id) {
      await db.insert(notifications).values({
        userId: recipientId,
        type: 'workspace_message',
        title: `New message from ${req.currentUser!.name}`,
        body: body.slice(0, 140),
        linkPath: `/workspace/${ws.id}`,
      });
    }

    return res.status(201).json({
      ...created,
      senderName: req.currentUser!.name,
      senderAvatar: req.currentUser!.avatarUrl,
    });
  } catch (err) {
    console.error('Post workspace message failed:', err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.post('/api/workspaces/:id/tasks', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const schema = z.object({
      title: z.string().trim().min(2, 'Task title is required.').max(160),
      description: z.string().trim().max(1500).default(''),
      status: z.enum(['todo', 'in_progress', 'in_review', 'completed']).default('todo'),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      assigneeId: z.number().int().nullable().optional(),
      dueDate: z.string().trim().max(40).default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid task.' });

    const [created] = await db
      .insert(workspaceTasks)
      .values({
        workspaceId: ws.id,
        ...parsed.data,
        assigneeId: parsed.data.assigneeId ?? ws.sellerId,
      })
      .returning();

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'task_created',
      summary: `Created task "${created.title}".`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create task failed:', err);
    return res.status(500).json({ error: 'Failed to create task.' });
  }
});

router.patch('/api/workspaces/:id/tasks/:taskId', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    const taskId = Number(req.params.taskId);

    const [existing] = await db
      .select()
      .from(workspaceTasks)
      .where(and(eq(workspaceTasks.id, taskId), eq(workspaceTasks.workspaceId, ws.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Task not found.' });

    const [updated] = await db
      .update(workspaceTasks)
      .set({
        title: req.body.title ?? existing.title,
        description: req.body.description ?? existing.description,
        status: req.body.status ?? existing.status,
        priority: req.body.priority ?? existing.priority,
        assigneeId: req.body.assigneeId !== undefined ? req.body.assigneeId : existing.assigneeId,
        dueDate: req.body.dueDate ?? existing.dueDate,
        updatedAt: new Date(),
      })
      .where(eq(workspaceTasks.id, taskId))
      .returning();

    if (req.body.status && req.body.status !== existing.status) {
      await db.insert(activityEvents).values({
        workspaceId: ws.id,
        actorId: req.currentUser!.id,
        actorName: req.currentUser!.name,
        eventType: 'task_updated',
        summary: `Moved task "${updated.title}" to ${updated.status.replace('_', ' ')}.`,
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Update task failed:', err);
    return res.status(500).json({ error: 'Failed to update task.' });
  }
});

router.post('/api/workspaces/:id/tasks/:taskId/comments', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    const taskId = Number(req.params.taskId);
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });

    const [existing] = await db
      .select()
      .from(workspaceTasks)
      .where(and(eq(workspaceTasks.id, taskId), eq(workspaceTasks.workspaceId, ws.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Task not found.' });

    const nextComments = [
      ...existing.comments,
      {
        id: crypto.randomUUID(),
        authorId: req.currentUser!.id,
        authorName: req.currentUser!.name,
        body,
        createdAt: new Date().toISOString(),
      },
    ];
    const [updated] = await db
      .update(workspaceTasks)
      .set({ comments: nextComments, updatedAt: new Date() })
      .where(eq(workspaceTasks.id, taskId))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error('Add task comment failed:', err);
    return res.status(500).json({ error: 'Failed to post task comment.' });
  }
});

router.post('/api/workspaces/:id/milestones', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const schema = z.object({
      title: z.string().trim().min(3),
      deliverables: z.string().trim().default(''),
      amount: z.number().int().min(0),
      dueDate: z.string().trim().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid milestone details.' });

    const [created] = await db
      .insert(milestones)
      .values({
        workspaceId: ws.id,
        ...parsed.data,
        status: 'pending',
        paymentStatus: 'unpaid',
      })
      .returning();

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'milestone_created',
      summary: `Added milestone "${created.title}" ($${created.amount.toLocaleString()}).`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create milestone failed:', err);
    return res.status(500).json({ error: 'Failed to add milestone.' });
  }
});

// Clearly labeled development demo payment state update & invoice issuance
router.patch('/api/workspaces/:id/milestones/:msId', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    const msId = Number(req.params.msId);

    const [existing] = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, msId), eq(milestones.workspaceId, ws.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Milestone not found.' });

    const nextStatus = req.body.status ?? existing.status;
    const nextPayment = req.body.paymentStatus ?? existing.paymentStatus;
    const invoiceNumber =
      nextPayment !== 'unpaid' && !existing.invoiceNumber
        ? `DEMO-INV-${new Date().getFullYear()}-${1000 + existing.id}`
        : existing.invoiceNumber;

    const [updated] = await db
      .update(milestones)
      .set({
        status: nextStatus,
        paymentStatus: nextPayment,
        invoiceNumber,
        feedbackNote: req.body.feedbackNote ?? existing.feedbackNote,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, msId))
      .returning();

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'milestone_updated',
      summary: `Updated milestone "${updated.title}" (status: ${updated.status}, demo billing: ${updated.paymentStatus}).`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Update milestone failed:', err);
    return res.status(500).json({ error: 'Failed to update milestone.' });
  }
});

// Change-request flow (included in scope vs revised price/deadline)
router.post('/api/workspaces/:id/change-requests', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const schema = z.object({
      title: z.string().trim().min(3, 'Change request title is required.').max(160),
      description: z.string().trim().min(10, 'Provide written details for the requested modification.').max(2000),
      scopeType: z.enum(['included_in_scope', 'revised_terms']),
      priceDelta: z.number().int().min(0).default(0),
      revisedDeadline: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid change request.' });

    const [created] = await db
      .insert(changeRequests)
      .values({
        workspaceId: ws.id,
        requesterId: req.currentUser!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        scopeType: parsed.data.scopeType,
        priceDelta: parsed.data.scopeType === 'revised_terms' ? parsed.data.priceDelta : 0,
        revisedDeadline: parsed.data.scopeType === 'revised_terms' ? parsed.data.revisedDeadline || null : null,
        status: 'pending',
      })
      .returning();

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'change_request_created',
      summary: `Opened change request "${created.title}" (${created.scopeType === 'revised_terms' ? `+$${created.priceDelta}` : 'included in original scope'}).`,
    });

    const recipientId = req.currentUser!.id === ws.buyerId ? ws.sellerId : ws.buyerId;
    await db.insert(notifications).values({
      userId: recipientId,
      type: 'change_request',
      title: 'New scope change request',
      body: `${req.currentUser!.name} requested: ${created.title}`,
      linkPath: `/workspace/${ws.id}`,
    });

    return res.status(201).json({ ...created, requesterName: req.currentUser!.name });
  } catch (err) {
    console.error('Create change request failed:', err);
    return res.status(500).json({ error: 'Failed to submit change request.' });
  }
});

router.patch('/api/workspaces/:id/change-requests/:crId', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    const crId = Number(req.params.crId);

    const [cr] = await db
      .select()
      .from(changeRequests)
      .where(and(eq(changeRequests.id, crId), eq(changeRequests.workspaceId, ws.id)))
      .limit(1);
    if (!cr) return res.status(404).json({ error: 'Change request not found.' });

    const decision = String(req.body?.status || '');
    if (decision !== 'approved' && decision !== 'declined') {
      return res.status(400).json({ error: 'Decision must be approved or declined.' });
    }

    const [updated] = await db
      .update(changeRequests)
      .set({
        status: decision,
        responseNote: String(req.body?.responseNote || '').trim(),
        resolvedAt: new Date(),
      })
      .where(eq(changeRequests.id, crId))
      .returning();

    if (decision === 'approved' && cr.scopeType === 'revised_terms') {
      const [c] = await db.select().from(contracts).where(eq(contracts.id, ws.contractId)).limit(1);
      if (c) {
        await db
          .update(contracts)
          .set({
            agreedPrice: c.agreedPrice + cr.priceDelta,
            ...(cr.revisedDeadline ? { deadline: cr.revisedDeadline } : {}),
          })
          .where(eq(contracts.id, c.id));
      }
    }

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'change_request_resolved',
      summary: `${decision === 'approved' ? 'Approved' : 'Declined'} change request "${cr.title}".`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Resolve change request failed:', err);
    return res.status(500).json({ error: 'Failed to update change request.' });
  }
});

// Seller submits milestone deliverable or final handover
router.post('/api/workspaces/:id/submissions', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    if (req.currentUser!.id !== ws.sellerId && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the hired freelancer can submit deliverables.' });
    }

    const schema = z.object({
      submissionType: z.enum(['milestone', 'final_handover']).default('milestone'),
      milestoneId: z.number().int().nullable().optional(),
      summary: z.string().trim().min(10, 'Provide delivery summary and handover notes.').max(3000),
      deliverableLinks: z.array(z.object({ label: z.string().trim(), url: z.string().trim() })).default([]),
      fileIds: z.array(z.number().int()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid submission.' });

    const [created] = await db
      .insert(submissions)
      .values({
        workspaceId: ws.id,
        milestoneId: parsed.data.milestoneId ?? null,
        sellerId: req.currentUser!.id,
        submissionType: parsed.data.submissionType,
        summary: parsed.data.summary,
        deliverableLinks: parsed.data.deliverableLinks.filter((l) => l.url.length > 0),
        fileIds: parsed.data.fileIds,
        status: 'pending_review',
      })
      .returning();

    if (parsed.data.milestoneId) {
      await db
        .update(milestones)
        .set({ status: 'submitted', submittedNote: parsed.data.summary, updatedAt: new Date() })
        .where(and(eq(milestones.id, parsed.data.milestoneId), eq(milestones.workspaceId, ws.id)));
    }

    await db
      .update(workspaces)
      .set({
        status: 'submitted_for_review',
        ...(parsed.data.submissionType === 'final_handover'
          ? {
              handoverNotes: parsed.data.summary,
              handoverLinks: parsed.data.deliverableLinks,
              finalSubmittedAt: new Date(),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, ws.id));

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'submission_created',
      summary:
        parsed.data.submissionType === 'final_handover'
          ? 'Submitted Final Handover package for buyer approval.'
          : 'Submitted milestone deliverables for buyer review.',
    });

    await db.insert(notifications).values({
      userId: ws.buyerId,
      type: 'submission',
      title:
        parsed.data.submissionType === 'final_handover'
          ? 'Final handover submitted for approval'
          : 'Deliverable submitted for review',
      body: parsed.data.summary.slice(0, 140),
      linkPath: `/workspace/${ws.id}`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create submission failed:', err);
    return res.status(500).json({ error: 'Failed to submit deliverables.' });
  }
});

// Buyer approves or requests revisions on a submission
router.post('/api/workspaces/:id/submissions/:subId/review', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;
    if (req.currentUser!.id !== ws.buyerId && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the project buyer can approve or request revisions.' });
    }

    const subId = Number(req.params.subId);
    const [sub] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, subId), eq(submissions.workspaceId, ws.id)))
      .limit(1);
    if (!sub) return res.status(404).json({ error: 'Submission not found.' });

    const decision = String(req.body?.decision || '');
    const feedback = String(req.body?.feedback || '').trim();
    if (decision !== 'approved' && decision !== 'revision_requested') {
      return res.status(400).json({ error: 'Decision must be approved or revision_requested.' });
    }
    if (decision === 'revision_requested' && feedback.length < 5) {
      return res.status(400).json({ error: 'Please include specific revision feedback for the freelancer.' });
    }

    const [updatedSub] = await db
      .update(submissions)
      .set({
        status: decision,
        buyerFeedback: feedback,
        reviewedAt: new Date(),
      })
      .where(eq(submissions.id, subId))
      .returning();

    if (sub.milestoneId) {
      await db
        .update(milestones)
        .set({
          status: decision === 'approved' ? 'approved' : 'revision_requested',
          feedbackNote: feedback,
          updatedAt: new Date(),
        })
        .where(eq(milestones.id, sub.milestoneId));
    }

    const isFinalApproval = decision === 'approved' && (sub.submissionType === 'final_handover' || Boolean(req.body?.completeProject));
    const nextWsStatus = isFinalApproval
      ? 'completed'
      : decision === 'revision_requested'
      ? 'revision_requested'
      : 'active';

    await db
      .update(workspaces)
      .set({
        status: nextWsStatus,
        ...(isFinalApproval ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, ws.id));

    if (isFinalApproval) {
      await db.update(contracts).set({ status: 'completed' }).where(eq(contracts.id, ws.contractId));
      await db.update(projects).set({ status: 'closed', updatedAt: new Date() }).where(eq(projects.id, ws.projectId));
    }

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: decision === 'approved' ? 'submission_approved' : 'revision_requested',
      summary: isFinalApproval
        ? 'Approved final handover and marked the project completed.'
        : decision === 'approved'
        ? 'Approved milestone deliverables.'
        : `Requested revisions: ${feedback}`,
    });

    await db.insert(notifications).values({
      userId: ws.sellerId,
      type: 'submission_review',
      title: isFinalApproval
        ? 'Project approved and completed'
        : decision === 'approved'
        ? 'Deliverable approved'
        : 'Revision requested on deliverable',
      body: feedback || 'Review updated inside your workspace.',
      linkPath: `/workspace/${ws.id}`,
    });

    return res.json({ submission: updatedSub, workspaceStatus: nextWsStatus });
  } catch (err) {
    console.error('Review submission failed:', err);
    return res.status(500).json({ error: 'Failed to submit review decision.' });
  }
});

router.patch('/api/workspaces/:id/status', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const status = String(req.body?.status || '');
    const reason = String(req.body?.reason || '').trim();
    const allowed = new Set(['active', 'completed', 'cancelled', 'disputed']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid workspace status.' });

    if (status === 'completed' && req.currentUser!.id !== ws.buyerId && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Only the client can mark a workspace completed.' });
    }

    const [updated] = await db
      .update(workspaces)
      .set({
        status,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, ws.id))
      .returning();

    if (status === 'completed' || status === 'cancelled' || status === 'disputed') {
      await db.update(contracts).set({ status }).where(eq(contracts.id, ws.contractId));
      if (status === 'completed') {
        await db.update(projects).set({ status: 'closed', updatedAt: new Date() }).where(eq(projects.id, ws.projectId));
      }
    }

    if (status === 'disputed') {
      await db.insert(reports).values({
        reporterId: req.currentUser!.id,
        targetType: 'workspace_dispute',
        targetId: ws.id,
        reason: 'Workspace dispute opened',
        details: reason || 'Dispute escalated from project workspace.',
        status: 'open',
      });
    }

    await db.insert(activityEvents).values({
      workspaceId: ws.id,
      actorId: req.currentUser!.id,
      actorName: req.currentUser!.name,
      eventType: 'status_changed',
      summary: `Changed workspace status to "${status}"${reason ? ` — ${reason}` : ''}.`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Update workspace status failed:', err);
    return res.status(500).json({ error: 'Failed to update workspace status.' });
  }
});

// Structured mutual review after completion
router.post('/api/workspaces/:id/reviews', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const check = await loadAuthorizedWorkspace(req);
    if ('error' in check) return res.status(check.errorStatus).json({ error: check.error });
    const { ws } = check;

    const existingReviews = await db
      .select({ reviewerId: reviews.reviewerId })
      .from(reviews)
      .where(eq(reviews.workspaceId, ws.id));

    const eligibility = canSubmitReview(
      ws,
      req.currentUser!.id,
      existingReviews.map((r) => r.reviewerId)
    );
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.reason });
    }

    const schema = z.object({
      ratingCommunication: z.number().int().min(1).max(5),
      ratingQuality: z.number().int().min(1).max(5),
      ratingReliability: z.number().int().min(1).max(5),
      ratingProfessionalism: z.number().int().min(1).max(5),
      comment: z.string().trim().min(15, 'Written review must be at least 15 characters.').max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review.' });

    const isBuyer = req.currentUser!.id === ws.buyerId;
    const revieweeId = isBuyer ? ws.sellerId : ws.buyerId;
    const ratingOverall = Math.round(
      (parsed.data.ratingCommunication +
        parsed.data.ratingQuality +
        parsed.data.ratingReliability +
        parsed.data.ratingProfessionalism) /
        4
    );

    const [created] = await db
      .insert(reviews)
      .values({
        workspaceId: ws.id,
        projectId: ws.projectId,
        reviewerId: req.currentUser!.id,
        revieweeId,
        reviewerRole: isBuyer ? 'buyer' : 'seller',
        ratingOverall,
        ...parsed.data,
      })
      .returning();

    await db.insert(notifications).values({
      userId: revieweeId,
      type: 'review_received',
      title: 'New verified platform review received',
      body: `${req.currentUser!.name} left a ${ratingOverall}/5 review on your completed project.`,
      linkPath: `/reviews`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Submit review failed:', err);
    return res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// Reviews & completed project history
router.get('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const received = await db
      .select({
        review: reviews,
        reviewerName: users.name,
        projectTitle: projects.title,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .innerJoin(projects, eq(reviews.projectId, projects.id))
      .where(and(eq(reviews.revieweeId, userId), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt));

    const given = await db
      .select({
        review: reviews,
        revieweeName: users.name,
        projectTitle: projects.title,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.revieweeId, users.id))
      .innerJoin(projects, eq(reviews.projectId, projects.id))
      .where(eq(reviews.reviewerId, userId))
      .orderBy(desc(reviews.createdAt));

    return res.json({
      received: received.map((r) => ({ ...r.review, reviewerName: r.reviewerName, projectTitle: r.projectTitle })),
      given: given.map((r) => ({ ...r.review, revieweeName: r.revieweeName, projectTitle: r.projectTitle })),
    });
  } catch (err) {
    console.error('Fetch reviews failed:', err);
    return res.status(500).json({ error: 'Failed to load reviews.' });
  }
});

// Direct pre-hire messages & Notifications
router.get('/api/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const rows = await db
      .select()
      .from(directMessages)
      .where(or(eq(directMessages.senderId, userId), eq(directMessages.recipientId, userId)))
      .orderBy(desc(directMessages.createdAt))
      .limit(100);

    const otherIds = Array.from(new Set(rows.flatMap((m) => [m.senderId, m.recipientId])));
    const userRows = otherIds.length
      ? await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, otherIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return res.json(
      rows.map((m) => ({
        ...m,
        sender: userMap.get(m.senderId) || null,
        recipient: userMap.get(m.recipientId) || null,
      }))
    );
  } catch (err) {
    console.error('Fetch messages failed:', err);
    return res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/api/messages', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const recipientId = Number(req.body?.recipientId);
    const body = String(req.body?.body || '').trim();
    if (!Number.isInteger(recipientId) || !body) {
      return res.status(400).json({ error: 'Recipient and message body are required.' });
    }
    const [created] = await db
      .insert(directMessages)
      .values({
        projectId: req.body.projectId ? Number(req.body.projectId) : null,
        proposalId: req.body.proposalId ? Number(req.body.proposalId) : null,
        senderId: req.currentUser!.id,
        recipientId,
        body,
      })
      .returning();

    await db.insert(notifications).values({
      userId: recipientId,
      type: 'direct_message',
      title: `Message from ${req.currentUser!.name}`,
      body: body.slice(0, 140),
      linkPath: '/inbox',
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Send direct message failed:', err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.currentUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return res.json(list);
  } catch (err) {
    console.error('Fetch notifications failed:', err);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/api/notifications/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.body?.id ? Number(req.body.id) : null;
    if (id) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, req.currentUser!.id)));
    } else {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.currentUser!.id));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Mark notifications read failed:', err);
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      targetType: z.enum(['user', 'project', 'proposal', 'review', 'workspace_dispute']),
      targetId: z.number().int().positive(),
      reason: z.string().trim().min(4).max(160),
      details: z.string().trim().min(10).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report.' });

    const [created] = await db
      .insert(reports)
      .values({
        reporterId: req.currentUser!.id,
        ...parsed.data,
        status: 'open',
      })
      .returning();
    return res.status(201).json(created);
  } catch (err) {
    console.error('Submit report failed:', err);
    return res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
