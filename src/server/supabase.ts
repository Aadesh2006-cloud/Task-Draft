import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = 'briefline-files';

let adminClient: SupabaseClient | null = null;
let bucketReadyPromise: Promise<boolean> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * Lazily returns a server-only Supabase admin client authenticated with SUPABASE_SECRET_KEY.
 * Never import this module in frontend code.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  adminClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

/**
 * Ensures a private `briefline-files` Supabase Storage bucket exists for mirroring private uploads.
 */
export async function ensureSupabaseStorageBucket(): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    try {
      const { data: buckets, error: listErr } = await client.storage.listBuckets();
      if (listErr) {
        console.warn('Supabase listBuckets warning:', listErr.message);
        bucketReadyPromise = null;
        return false;
      }
      const exists = (buckets || []).some((b) => b.name === STORAGE_BUCKET);
      if (!exists) {
        const { error: createErr } = await client.storage.createBucket(STORAGE_BUCKET, {
          public: false,
          fileSizeLimit: 4 * 1024 * 1024,
        });
        if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
          console.warn('Supabase createBucket warning:', createErr.message);
          bucketReadyPromise = null;
          return false;
        }
      }
      return true;
    } catch (err) {
      console.warn('Supabase storage bucket check failed:', err);
      bucketReadyPromise = null;
      return false;
    }
  })();

  return bucketReadyPromise;
}

/**
 * Mirrors a validated private upload (CV, sample, or workspace deliverable) to private Supabase Storage.
 * Returns the storage path on success or null if Supabase is unavailable (non-fatal backup).
 */
export async function mirrorFileToSupabaseStorage(params: {
  fileId: number;
  scope: string;
  ownerId: number;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const ready = await ensureSupabaseStorageBucket();
  if (!ready) return null;

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  const storagePath = `${params.scope}/owner_${params.ownerId}/${params.fileId}_${safeName}`;

  try {
    const { error } = await client.storage.from(STORAGE_BUCKET).upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
    if (error) {
      console.warn('Supabase storage upload warning:', error.message);
      return null;
    }

    // Optionally mirror file metadata row if `briefline_files` table has been created in Supabase SQL
    try {
      await client.from('briefline_files').upsert(
        {
          id: params.fileId,
          owner_id: params.ownerId,
          scope: params.scope,
          file_name: params.fileName,
          mime_type: params.mimeType,
          size_bytes: params.buffer.byteLength,
          storage_path: storagePath,
          is_public: false,
        },
        { onConflict: 'id' }
      );
    } catch {
      // Optional table mirror; ignore if SQL schema hasn't been applied yet
    }

    return storagePath;
  } catch (err) {
    console.warn('Supabase storage mirror error:', err);
    return null;
  }
}

/**
 * Mirrors a project brief record into Supabase's `briefline_projects` table when the table is provisioned.
 */
export async function mirrorProjectToSupabase(project: {
  id: number;
  buyerId: number;
  title: string;
  brief: string;
  categoryId: number;
  subcategory?: string | null;
  requiredSkills?: string[] | null;
  budgetType: string;
  budgetMin: number;
  budgetMax?: number | null;
  currency: string;
  deadline?: string | null;
  status: string;
  visibility: string;
}): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;
  try {
    const { error } = await client.from('briefline_projects').upsert(
      {
        id: project.id,
        buyer_id: project.buyerId,
        title: project.title,
        brief: project.brief,
        category_id: project.categoryId,
        subcategory: project.subcategory || '',
        required_skills: project.requiredSkills || [],
        budget_type: project.budgetType,
        budget_min: project.budgetMin,
        budget_max: project.budgetMax ?? null,
        currency: project.currency,
        deadline: project.deadline || '',
        status: project.status,
        visibility: project.visibility,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

const recentFirebaseSignIns = new Map<string, number>();

/**
 * Mirrors user account profile and sign-in event into Supabase's
 * `briefline_users` and `briefline_sign_ins` tables (once provisioned via supabase/schema.sql).
 */
export async function recordSignInToSupabase(params: {
  user: {
    id: number;
    uid: string;
    name: string;
    email: string;
    activeRole: string;
    canBuy: boolean;
    canSell: boolean;
    isAdmin: boolean;
    emailVerified: boolean;
    createdAt?: Date | string;
  };
  authMethod: 'email_signup' | 'email_login' | 'google_firebase' | 'demo_login';
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;

  // Deduplicate repeated Firebase token verifications within a 15-minute window
  if (params.authMethod === 'google_firebase') {
    const now = Date.now();
    const lastLogged = recentFirebaseSignIns.get(params.user.uid) || 0;
    if (now - lastLogged < 15 * 60 * 1000) {
      return true;
    }
    recentFirebaseSignIns.set(params.user.uid, now);
  }

  const provider =
    params.authMethod === 'google_firebase'
      ? 'google_firebase'
      : params.authMethod === 'demo_login'
        ? 'demo'
        : 'email';

  const nowIso = new Date().toISOString();

  try {
    const { data: existing } = await client
      .from('briefline_users')
      .select('sign_in_count')
      .eq('id', params.user.id)
      .maybeSingle();

    const nextCount = typeof existing?.sign_in_count === 'number' ? existing.sign_in_count + 1 : 1;

    const { error: userErr } = await client.from('briefline_users').upsert(
      {
        id: params.user.id,
        uid: params.user.uid,
        name: params.user.name,
        email: params.user.email,
        active_role: params.user.activeRole,
        can_buy: params.user.canBuy,
        can_sell: params.user.canSell,
        is_admin: params.user.isAdmin,
        email_verified: params.user.emailVerified,
        auth_provider: provider,
        sign_in_count: nextCount,
        last_sign_in_at: nowIso,
        created_at: params.user.createdAt ? new Date(params.user.createdAt).toISOString() : nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (userErr) return false;

    const { error: logErr } = await client.from('briefline_sign_ins').insert({
      user_id: params.user.id,
      name: params.user.name,
      email: params.user.email,
      active_role: params.user.activeRole,
      auth_method: params.authMethod,
      ip_address: (params.ipAddress || '').slice(0, 80),
      user_agent: (params.userAgent || '').slice(0, 240),
      signed_in_at: nowIso,
    });

    return !logErr;
  } catch {
    return false;
  }
}

/**
 * Verifies live server-side connectivity to Supabase (Storage & Auth APIs) without leaking credentials.
 */
export async function checkSupabaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  storageBucketReady: boolean;
  projectUrlHost: string | null;
  error?: string;
}> {
  const url = process.env.SUPABASE_URL || null;
  const client = getSupabaseAdmin();
  if (!client || !url) {
    return {
      configured: false,
      connected: false,
      storageBucketReady: false,
      projectUrlHost: null,
    };
  }
  try {
    const storageBucketReady = await ensureSupabaseStorageBucket();
    const host = new URL(url).host;
    return {
      configured: true,
      connected: storageBucketReady,
      storageBucketReady,
      projectUrlHost: host,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      storageBucketReady: false,
      projectUrlHost: null,
      error: err instanceof Error ? err.message : 'Supabase check failed',
    };
  }
}
