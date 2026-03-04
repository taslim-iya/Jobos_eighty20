
-- ═══════════════════════════════════════════════════════════════
-- 1. ALTER profiles: add new preference columns
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_tracks text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS locations text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS visa_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS keywords_include text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS keywords_exclude text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS salary_min integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS start_date text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS industries text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS company_blacklist text[] DEFAULT '{}'::text[];

-- ═══════════════════════════════════════════════════════════════
-- 2. ALTER jobs: add ingestion pipeline columns
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_job_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remote_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apply_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extracted_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hash text DEFAULT NULL;

-- Add unique constraint on source_job_url (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_job_url_unique ON public.jobs (source_job_url) WHERE source_job_url IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. CREATE sources table (admin-managed crawl sources)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  enabled boolean DEFAULT true,
  crawl_type text DEFAULT 'list' CHECK (crawl_type IN ('list', 'sitemap', 'single')),
  allowlist_paths text[] DEFAULT '{}'::text[],
  frequency_minutes integer DEFAULT 10080,
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- Admin-only write, all authenticated can read
CREATE POLICY "Admins can manage sources" ON public.sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view sources" ON public.sources
  FOR SELECT TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. CREATE crawl_runs table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz DEFAULT NULL,
  pages_crawled integer DEFAULT 0,
  errors text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crawl_runs" ON public.crawl_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view crawl_runs" ON public.crawl_runs
  FOR SELECT TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. CREATE raw_pages table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.raw_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  html_text text DEFAULT NULL,
  json_text jsonb DEFAULT NULL,
  hash text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage raw_pages" ON public.raw_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- 6. CREATE profile_job_matches table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profile_job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  match_score integer DEFAULT 0,
  match_reasons text[] DEFAULT '{}'::text[],
  status text DEFAULT 'new' CHECK (status IN ('new', 'saved', 'dismissed', 'applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, job_id)
);
ALTER TABLE public.profile_job_matches ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own matches (profile_id = their profile's id)
CREATE POLICY "Users can view their own matches" ON public.profile_job_matches
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own matches" ON public.profile_job_matches
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert matches" ON public.profile_job_matches
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all matches" ON public.profile_job_matches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- 7. CREATE admin_templates table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cv', 'cover', 'outreach', 'interview')),
  track text DEFAULT NULL,
  seniority text DEFAULT NULL,
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" ON public.admin_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active templates" ON public.admin_templates
  FOR SELECT TO authenticated
  USING (active = true);

-- ═══════════════════════════════════════════════════════════════
-- 8. CREATE admin_rules table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  json_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rules" ON public.admin_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active rules" ON public.admin_rules
  FOR SELECT TO authenticated
  USING (active = true);

-- ═══════════════════════════════════════════════════════════════
-- 9. CREATE uploads table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL DEFAULT 'user' CHECK (owner_type IN ('user', 'admin')),
  owner_id uuid NOT NULL,
  file_path text NOT NULL,
  file_type text DEFAULT NULL,
  extracted_json jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own uploads" ON public.uploads
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all uploads" ON public.uploads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add FK from jobs.source_id to sources
ALTER TABLE public.jobs ADD CONSTRAINT jobs_source_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE SET NULL;

-- Insert default match threshold rule
INSERT INTO public.admin_rules (name, json_rules, active) VALUES 
  ('match_config', '{"threshold": 50, "weights": {"skills": 30, "location": 20, "seniority": 20, "track": 20, "exclude_keywords": 10}, "seniority_mappings": {"undergrad": ["intern", "analyst", "graduate", "junior", "entry level", "summer"], "experienced": ["associate", "vp", "vice president", "director", "manager", "senior"]}}', true);
