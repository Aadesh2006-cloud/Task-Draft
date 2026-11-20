-- Briefline Supabase PostgreSQL Schema
-- Paste and run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oiuxxbydopwimyseztza/sql/new

-- 1. Registered & Signed-In Users Directory (PII protected by RLS; server-only writes)
CREATE TABLE IF NOT EXISTS public.briefline_users (
  id INTEGER PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  active_role TEXT NOT NULL DEFAULT 'buyer',
  can_buy BOOLEAN NOT NULL DEFAULT TRUE,
  can_sell BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  sign_in_count INTEGER NOT NULL DEFAULT 1,
  last_sign_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Chronological Sign-In Audit Log (every login / signup / Google sign-in)
CREATE TABLE IF NOT EXISTS public.briefline_sign_ins (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.briefline_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active_role TEXT NOT NULL DEFAULT 'buyer',
  auth_method TEXT NOT NULL,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefline_sign_ins_signed_in_at
  ON public.briefline_sign_ins (signed_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_briefline_sign_ins_email
  ON public.briefline_sign_ins (email);

-- 3. Project Briefs Mirror
CREATE TABLE IF NOT EXISTS public.briefline_projects (
  id INTEGER PRIMARY KEY,
  buyer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  subcategory TEXT DEFAULT '',
  required_skills JSONB DEFAULT '[]'::jsonb,
  budget_type TEXT NOT NULL DEFAULT 'fixed',
  budget_min INTEGER NOT NULL DEFAULT 0,
  budget_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  deadline TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Private Uploaded Files Metadata Mirror
CREATE TABLE IF NOT EXISTS public.briefline_files (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  scope TEXT NOT NULL,
  scope_ref_id INTEGER,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security on all tables
-- Note: briefline_users, briefline_sign_ins, and briefline_files have NO public anon policies,
-- keeping user PII private to your Supabase Dashboard/SQL Editor and the server secret key.
ALTER TABLE public.briefline_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefline_sign_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefline_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefline_files ENABLE ROW LEVEL SECURITY;

-- Public read of open public briefs only; writes restricted to server secret key
DROP POLICY IF EXISTS "Public read open briefs" ON public.briefline_projects;
CREATE POLICY "Public read open briefs"
  ON public.briefline_projects
  FOR SELECT
  USING (status = 'open' AND visibility = 'public');

-- 5. Convenience Summary View for studying website sign-ins in Table Editor or SQL Editor
CREATE OR REPLACE VIEW public.v_website_sign_ins AS
SELECT
  u.id AS user_id,
  u.name,
  u.email,
  u.active_role AS role,
  u.auth_provider,
  u.email_verified,
  u.sign_in_count AS total_sign_ins,
  u.last_sign_in_at,
  u.created_at AS registered_at
FROM public.briefline_users u
ORDER BY u.last_sign_in_at DESC;
