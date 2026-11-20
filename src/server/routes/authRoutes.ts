import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  buyerProfiles,
  notifications,
  portfolioItems,
  projects,
  proposals,
  reviews,
  sellerProfiles,
  storedFiles,
  users,
  workspaces,
} from '../../db/schema.ts';
import {
  calculateBuyerCompletion,
  calculateSellerCompletion,
  canAccessFile,
  validateUploadFile,
} from '../../utils/domain.ts';
import {
  type AuthRequest,
  createSessionToken,
  ensureProfilesForUser,
  hashPassword,
  optionalAuth,
  requireAuth,
  requireUnrestricted,
  sanitizeUser,
  verifyPassword,
} from '../auth.ts';
import { mirrorFileToSupabaseStorage, recordSignInToSupabase } from '../supabase.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required (at least 2 characters).').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  roleChoice: z.enum(['buyer', 'seller', 'both']).default('buyer'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

async function buildAccountPayload(userId: number) {
  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) return null;
  await ensureProfilesForUser(userId, userRow.name);

  const [buyerProfile] = await db.select().from(buyerProfiles).where(eq(buyerProfiles.userId, userId)).limit(1);
  const [sellerProfile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
  const portfolio = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.sellerId, userId))
    .orderBy(desc(portfolioItems.createdAt));

  let cvFile: { id: number; fileName: string; sizeBytes: number; createdAt: Date } | null = null;
  if (sellerProfile?.cvFileId) {
    const [f] = await db
      .select({
        id: storedFiles.id,
        fileName: storedFiles.fileName,
        sizeBytes: storedFiles.sizeBytes,
        createdAt: storedFiles.createdAt,
      })
      .from(storedFiles)
      .where(eq(storedFiles.id, sellerProfile.cvFileId))
      .limit(1);
    if (f) cvFile = f;
  }

  const unreadNotifs = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return {
    user: sanitizeUser(userRow),
    buyerProfile: buyerProfile || null,
    sellerProfile: sellerProfile || null,
    cvFile,
    portfolio,
    unreadNotifications: unreadNotifs.length,
    buyerCompletion: calculateBuyerCompletion(buyerProfile || null),
    sellerCompletion: calculateSellerCompletion(sellerProfile || null, portfolio.length),
  };
}

router.post('/api/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details.' });
    }
    const { name, email, password, roleChoice } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const canBuy = roleChoice === 'buyer' || roleChoice === 'both';
    const canSell = roleChoice === 'seller' || roleChoice === 'both';
    const activeRole = roleChoice === 'seller' ? 'seller' : 'buyer';
    const verificationToken = crypto.randomBytes(12).toString('hex');

    const [created] = await db
      .insert(users)
      .values({
        uid: `local_${crypto.randomUUID()}`,
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        name,
        canBuy,
        canSell,
        activeRole,
        emailVerified: false,
        verificationToken,
      })
      .returning();

    await ensureProfilesForUser(created.id, created.name);
    await db.insert(notifications).values({
      userId: created.id,
      type: 'welcome',
      title: 'Welcome to Briefline',
      body: 'Complete your profile and verify your email to unlock full marketplace trust signals.',
      linkPath: '/onboarding',
    });

    void recordSignInToSupabase({
      user: created,
      authMethod: 'email_signup',
      ipAddress: req.ip || String(req.headers['x-forwarded-for'] || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    const token = createSessionToken(created.id, created.uid);
    const payload = await buildAccountPayload(created.id);
    return res.status(201).json({
      token,
      devVerificationCode: verificationToken,
      ...payload,
    });
  } catch (err) {
    console.error('Register failed:', err);
    return res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials.' });
    }
    const normalizedEmail = parsed.data.email.toLowerCase();
    const [found] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!found || !verifyPassword(parsed.data.password, found.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    void recordSignInToSupabase({
      user: found,
      authMethod: 'email_login',
      ipAddress: req.ip || String(req.headers['x-forwarded-for'] || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    const token = createSessionToken(found.id, found.uid);
    const payload = await buildAccountPayload(found.id);
    return res.json({ token, ...payload });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/api/auth/demo-login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase();
    const allowedDemoEmails = new Set([
      'maya@northstar.demo',
      'liam@studiofield.demo',
      'priya@atelier.demo',
      'admin@briefline.demo',
    ]);
    if (!allowedDemoEmails.has(email)) {
      return res.status(400).json({ error: 'Unknown demo account selected.' });
    }
    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!found) {
      return res.status(404).json({ error: 'Demo account is not seeded yet.' });
    }
    void recordSignInToSupabase({
      user: found,
      authMethod: 'demo_login',
      ipAddress: req.ip || String(req.headers['x-forwarded-for'] || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    const token = createSessionToken(found.id, found.uid);
    const payload = await buildAccountPayload(found.id);
    return res.json({ token, ...payload });
  } catch (err) {
    console.error('Demo login failed:', err);
    return res.status(500).json({ error: 'Could not switch demo account.' });
  }
});

router.post('/api/auth/verify-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const payload = await buildAccountPayload(userId);
    return res.json({ verified: true, ...payload });
  } catch (err) {
    console.error('Verify email failed:', err);
    return res.status(500).json({ error: 'Verification failed.' });
  }
});

router.post('/api/auth/request-reset', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email address is required.' });
    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!found) {
      // Avoid user enumeration in responses while still giving clear UX
      return res.json({
        message: 'If an account matches that email, a reset token has been generated.',
      });
    }
    const token = crypto.randomBytes(6).toString('hex');
    await db.update(users).set({ resetToken: token, updatedAt: new Date() }).where(eq(users.id, found.id));
    return res.json({
      message: 'Password reset token generated (development preview shown below).',
      devResetToken: token,
    });
  } catch (err) {
    console.error('Password reset request failed:', err);
    return res.status(500).json({ error: 'Could not generate reset token.' });
  }
});

router.post('/api/auth/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().trim().email(),
      token: z.string().trim().min(4),
      newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset input.' });
    }
    const [found] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, parsed.data.email.toLowerCase()), eq(users.resetToken, parsed.data.token)))
      .limit(1);
    if (!found) {
      return res.status(400).json({ error: 'Reset token is invalid or has already been used.' });
    }
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(parsed.data.newPassword),
        resetToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, found.id));
    return res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    console.error('Password reset failed:', err);
    return res.status(500).json({ error: 'Could not reset password.' });
  }
});

router.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (bearer && !bearer.startsWith('local.') && req.currentUser) {
      void recordSignInToSupabase({
        user: req.currentUser,
        authMethod: 'google_firebase',
        ipAddress: req.ip || String(req.headers['x-forwarded-for'] || ''),
        userAgent: String(req.headers['user-agent'] || ''),
      });
    }
    const payload = await buildAccountPayload(req.currentUser!.id);
    if (!payload) return res.status(404).json({ error: 'Account not found.' });
    return res.json(payload);
  } catch (err) {
    console.error('Fetch me failed:', err);
    return res.status(500).json({ error: 'Failed to load account profile.' });
  }
});

router.patch('/api/auth/role', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const schema = z.object({
      activeRole: z.enum(['buyer', 'seller', 'admin']).optional(),
      canBuy: z.boolean().optional(),
      canSell: z.boolean().optional(),
      name: z.string().trim().min(2).max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role update payload.' });
    }
    const current = req.currentUser!;
    const nextCanBuy = parsed.data.canBuy ?? current.canBuy;
    const nextCanSell = parsed.data.canSell ?? current.canSell;
    let nextActive = parsed.data.activeRole ?? (current.activeRole as 'buyer' | 'seller' | 'admin');

    if (nextActive === 'admin' && !current.isAdmin) {
      return res.status(403).json({ error: 'Only administrators can switch to Admin role.' });
    }
    if (nextActive === 'buyer' && !nextCanBuy) {
      return res.status(400).json({ error: 'Enable Buyer capability before switching to Buyer mode.' });
    }
    if (nextActive === 'seller' && !nextCanSell) {
      return res.status(400).json({ error: 'Enable Seller capability before switching to Seller mode.' });
    }

    await db
      .update(users)
      .set({
        canBuy: nextCanBuy,
        canSell: nextCanSell,
        activeRole: nextActive,
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const payload = await buildAccountPayload(userId);
    return res.json(payload);
  } catch (err) {
    console.error('Role switch failed:', err);
    return res.status(500).json({ error: 'Failed to update account roles.' });
  }
});

router.put('/api/profiles/buyer', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      organizationName: z.string().trim().max(160).default(''),
      description: z.string().trim().max(2500).default(''),
      website: z.string().trim().max(300).default(''),
      industry: z.string().trim().max(120).default(''),
      contactPreference: z.string().trim().max(200).default('Platform messages'),
      location: z.string().trim().max(160).default(''),
      timezone: z.string().trim().max(80).default('UTC'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid buyer profile data.' });
    }
    const userId = req.currentUser!.id;
    await db
      .insert(buyerProfiles)
      .values({ userId, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: buyerProfiles.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      });
    const payload = await buildAccountPayload(userId);
    return res.json(payload);
  } catch (err) {
    console.error('Buyer profile update failed:', err);
    return res.status(500).json({ error: 'Failed to save buyer profile.' });
  }
});

router.put('/api/profiles/seller', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      headline: z.string().trim().max(180).default(''),
      bio: z.string().trim().max(3500).default(''),
      skills: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
      experience: z
        .array(
          z.object({
            role: z.string().trim().max(120),
            company: z.string().trim().max(120),
            period: z.string().trim().max(80),
            summary: z.string().trim().max(600),
          })
        )
        .max(15)
        .default([]),
      education: z
        .array(
          z.object({
            degree: z.string().trim().max(140),
            institution: z.string().trim().max(140),
            year: z.string().trim().max(20),
          })
        )
        .max(10)
        .default([]),
      languages: z.array(z.string().trim().max(50)).max(15).default([]),
      pricingPreference: z.enum(['fixed', 'hourly', 'both']).default('both'),
      hourlyRate: z.number().int().min(0).max(2000).nullable().optional(),
      currency: z.string().trim().min(3).max(5).default('USD'),
      availability: z.enum(['available', 'limited', 'unavailable']).default('available'),
      location: z.string().trim().max(160).default(''),
      timezone: z.string().trim().max(80).default('UTC'),
      cvFileId: z.number().int().nullable().optional(),
      portfolioLinks: z
        .array(z.object({ label: z.string().trim().max(100), url: z.string().trim().max(300) }))
        .max(10)
        .default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid seller profile data.' });
    }
    const userId = req.currentUser!.id;
    const { cvFileId, hourlyRate, ...rest } = parsed.data;
    const updatePayload = {
      ...rest,
      hourlyRate: hourlyRate ?? null,
      ...(cvFileId !== undefined ? { cvFileId } : {}),
      updatedAt: new Date(),
    };
    await db
      .insert(sellerProfiles)
      .values({ userId, ...updatePayload })
      .onConflictDoUpdate({
        target: sellerProfiles.userId,
        set: updatePayload,
      });
    const payload = await buildAccountPayload(userId);
    return res.json(payload);
  } catch (err) {
    console.error('Seller profile update failed:', err);
    return res.status(500).json({ error: 'Failed to save seller profile.' });
  }
});

router.post('/api/profiles/portfolio', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(3, 'Title is required.').max(140),
      description: z.string().trim().min(10, 'Description is required.').max(2000),
      toolsUsed: z.array(z.string().trim().max(50)).max(15).default([]),
      rolePerformed: z.string().trim().max(120).default(''),
      externalUrl: z.string().trim().max(300).default(''),
      imageUrl: z.string().trim().max(500).default(''),
      fileId: z.number().int().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid portfolio item.' });
    }
    const [item] = await db
      .insert(portfolioItems)
      .values({
        sellerId: req.currentUser!.id,
        ...parsed.data,
        fileId: parsed.data.fileId ?? null,
      })
      .returning();
    return res.status(201).json(item);
  } catch (err) {
    console.error('Add portfolio failed:', err);
    return res.status(500).json({ error: 'Failed to add portfolio item.' });
  }
});

router.delete('/api/profiles/portfolio/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Portfolio item not found.' });
    if (existing.sellerId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
    return res.json({ deleted: true });
  } catch (err) {
    console.error('Delete portfolio failed:', err);
    return res.status(500).json({ error: 'Failed to delete portfolio item.' });
  }
});

router.get('/api/sellers/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (!Number.isInteger(sellerId)) return res.status(400).json({ error: 'Invalid seller ID.' });

    const [userRow] = await db.select().from(users).where(eq(users.id, sellerId)).limit(1);
    if (!userRow || !userRow.canSell) {
      return res.status(404).json({ error: 'Freelancer profile not found.' });
    }
    const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId)).limit(1);
    const portfolio = await db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.sellerId, sellerId))
      .orderBy(desc(portfolioItems.createdAt));

    const sellerReviews = await db
      .select({
        id: reviews.id,
        projectId: reviews.projectId,
        projectTitle: projects.title,
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
      .innerJoin(projects, eq(reviews.projectId, projects.id))
      .where(and(eq(reviews.revieweeId, sellerId), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt));

    const completedWorkspaces = await db
      .select({ id: workspaces.id, projectId: workspaces.projectId, completedAt: workspaces.completedAt })
      .from(workspaces)
      .where(and(eq(workspaces.sellerId, sellerId), eq(workspaces.status, 'completed')));

    // Determine whether viewer is permitted to access private CV
    let canViewCv = false;
    let cvMeta: { id: number; fileName: string; sizeBytes: number } | null = null;
    if (profile?.cvFileId && req.currentUser) {
      if (req.currentUser.isAdmin || req.currentUser.id === sellerId) {
        canViewCv = true;
      } else {
        // Check if currentUser is buyer of a project this seller proposed to
        const buyerProposals = await db
          .select({ id: proposals.id })
          .from(proposals)
          .innerJoin(projects, eq(proposals.projectId, projects.id))
          .where(and(eq(proposals.sellerId, sellerId), eq(projects.buyerId, req.currentUser.id)))
          .limit(1);
        canViewCv = buyerProposals.length > 0;
      }
      if (canViewCv) {
        const [f] = await db
          .select({ id: storedFiles.id, fileName: storedFiles.fileName, sizeBytes: storedFiles.sizeBytes })
          .from(storedFiles)
          .where(eq(storedFiles.id, profile.cvFileId))
          .limit(1);
        if (f) cvMeta = f;
      }
    }

    const avgRating =
      sellerReviews.length > 0
        ? Number((sellerReviews.reduce((sum, r) => sum + r.ratingOverall, 0) / sellerReviews.length).toFixed(1))
        : null;

    return res.json({
      seller: {
        id: userRow.id,
        name: userRow.name,
        avatarUrl: userRow.avatarUrl,
        emailVerified: userRow.emailVerified,
        isDemo: userRow.isDemo,
        createdAt: userRow.createdAt,
      },
      profile: profile
        ? {
            ...profile,
            cvFileId: canViewCv ? profile.cvFileId : null,
          }
        : null,
      hasPrivateCv: Boolean(profile?.cvFileId),
      canViewCv,
      cvMeta,
      portfolio,
      reviews: sellerReviews,
      completedCount: completedWorkspaces.length,
      avgRating,
    });
  } catch (err) {
    console.error('Fetch seller profile failed:', err);
    return res.status(500).json({ error: 'Failed to load freelancer profile.' });
  }
});

// Secure file upload with MIME/size validation and workspace version tracking
router.post('/api/files/upload', requireAuth, requireUnrestricted, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      scope: z.enum(['cv', 'portfolio', 'project_ref', 'proposal_sample', 'workspace']),
      scopeRefId: z.number().int().nullable().optional(),
      fileName: z.string().trim().min(1).max(180),
      mimeType: z.string().trim().min(1).max(120),
      contentBase64: z.string().min(1),
      versionGroup: z.string().trim().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid file upload payload.' });
    }

    const { scope, scopeRefId, fileName, mimeType, contentBase64, versionGroup } = parsed.data;
    const cleanedBase64 = contentBase64.includes(',') ? contentBase64.split(',')[1] : contentBase64;
    const rawBuffer = Buffer.from(cleanedBase64, 'base64');
    const validation = validateUploadFile(fileName, mimeType, rawBuffer.byteLength);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // If workspace scope, verify participant authorization
    if (scope === 'workspace') {
      if (!scopeRefId) return res.status(400).json({ error: 'Workspace ID is required for workspace uploads.' });
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, scopeRefId)).limit(1);
      if (!ws) return res.status(404).json({ error: 'Workspace not found.' });
      if (!req.currentUser!.isAdmin && ws.buyerId !== req.currentUser!.id && ws.sellerId !== req.currentUser!.id) {
        return res.status(403).json({ error: 'You are not authorized to upload files to this workspace.' });
      }
    }

    // Compute version number for workspace uploads sharing the same file name or versionGroup
    let nextVersion = 1;
    const groupKey = versionGroup || fileName.toLowerCase();
    if (scope === 'workspace' && scopeRefId) {
      const existing = await db
        .select({ version: storedFiles.version })
        .from(storedFiles)
        .where(
          and(
            eq(storedFiles.scope, 'workspace'),
            eq(storedFiles.scopeRefId, scopeRefId),
            eq(storedFiles.versionGroup, groupKey)
          )
        )
        .orderBy(desc(storedFiles.version))
        .limit(1);
      if (existing.length > 0) {
        nextVersion = existing[0].version + 1;
      }
    }

    const isPublic = scope === 'portfolio' || scope === 'project_ref';
    const [stored] = await db
      .insert(storedFiles)
      .values({
        ownerId: req.currentUser!.id,
        scope,
        scopeRefId: scopeRefId ?? null,
        fileName,
        mimeType,
        sizeBytes: rawBuffer.byteLength,
        contentBase64: cleanedBase64,
        version: nextVersion,
        versionGroup: groupKey,
        isPublic,
      })
      .returning({
        id: storedFiles.id,
        ownerId: storedFiles.ownerId,
        scope: storedFiles.scope,
        scopeRefId: storedFiles.scopeRefId,
        fileName: storedFiles.fileName,
        mimeType: storedFiles.mimeType,
        sizeBytes: storedFiles.sizeBytes,
        version: storedFiles.version,
        versionGroup: storedFiles.versionGroup,
        isPublic: storedFiles.isPublic,
        createdAt: storedFiles.createdAt,
      });

    if (scope === 'cv') {
      await db
        .insert(sellerProfiles)
        .values({ userId: req.currentUser!.id, cvFileId: stored.id, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: sellerProfiles.userId,
          set: { cvFileId: stored.id, updatedAt: new Date() },
        });
    }

    void mirrorFileToSupabaseStorage({
      fileId: stored.id,
      scope,
      ownerId: req.currentUser!.id,
      fileName,
      mimeType,
      buffer: rawBuffer,
    });

    return res.status(201).json(stored);
  } catch (err) {
    console.error('File upload failed:', err);
    return res.status(500).json({ error: 'File upload failed.' });
  }
});

// Strictly permission-controlled file download/preview endpoint
router.get('/api/files/:id/download', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const fileId = Number(req.params.id);
    if (!Number.isInteger(fileId)) return res.status(400).json({ error: 'Invalid file ID.' });

    const [file] = await db.select().from(storedFiles).where(eq(storedFiles.id, fileId)).limit(1);
    if (!file) return res.status(404).json({ error: 'File not found.' });

    let isWorkspaceParticipant = false;
    let isBuyerOfSubmittedProposal = false;

    if (req.currentUser) {
      if (file.scope === 'workspace' && file.scopeRefId) {
        const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, file.scopeRefId)).limit(1);
        if (ws && (ws.buyerId === req.currentUser.id || ws.sellerId === req.currentUser.id)) {
          isWorkspaceParticipant = true;
        }
      }
      if (file.scope === 'cv' || file.scope === 'proposal_sample') {
        const match = await db
          .select({ id: proposals.id })
          .from(proposals)
          .innerJoin(projects, eq(proposals.projectId, projects.id))
          .where(and(eq(proposals.sellerId, file.ownerId), eq(projects.buyerId, req.currentUser.id)))
          .limit(1);
        isBuyerOfSubmittedProposal = match.length > 0;
      }
    }

    const allowed = canAccessFile(req.currentUser || null, file, {
      isWorkspaceParticipant,
      isBuyerOfSubmittedProposal,
    });

    if (!allowed) {
      return res.status(req.currentUser ? 403 : 401).json({
        error: 'Access denied. This private file is restricted to authorized participants.',
      });
    }

    const asJson = req.query.format === 'json';
    if (asJson) {
      const previewText =
        file.mimeType.startsWith('text/')
          ? Buffer.from(file.contentBase64, 'base64').toString('utf8')
          : null;
      return res.json({
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        version: file.version,
        previewText,
        contentBase64: file.contentBase64,
      });
    }

    const buffer = Buffer.from(file.contentBase64, 'base64');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('File download failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve file.' });
  }
});

// List platform directory of sellers (public non-sensitive profiles only)
router.get('/api/talents', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        isDemo: users.isDemo,
        headline: sellerProfiles.headline,
        skills: sellerProfiles.skills,
        hourlyRate: sellerProfiles.hourlyRate,
        currency: sellerProfiles.currency,
        availability: sellerProfiles.availability,
        location: sellerProfiles.location,
      })
      .from(users)
      .innerJoin(sellerProfiles, eq(users.id, sellerProfiles.userId))
      .where(and(eq(users.canSell, true), eq(users.isRestricted, false)));

    return res.json(rows);
  } catch (err) {
    console.error('Fetch talents failed:', err);
    return res.status(500).json({ error: 'Failed to load freelancer directory.' });
  }
});

export default router;
