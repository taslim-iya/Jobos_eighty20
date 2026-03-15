
-- Add salary and job_type columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_type text;

-- Add unique constraint on (user_id, source_job_url) for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_id_source_job_url_idx 
  ON public.jobs (user_id, source_job_url) 
  WHERE source_job_url IS NOT NULL;

-- Update crawl_type check constraint to include 'job_board'
ALTER TABLE public.sources DROP CONSTRAINT sources_crawl_type_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_crawl_type_check 
  CHECK (crawl_type = ANY (ARRAY['list', 'sitemap', 'single', 'job_board']));

-- Seed the 5 job board sources
INSERT INTO public.sources (name, base_url, crawl_type, enabled, notes, allowlist_paths) VALUES
  ('eFinancialCareers', 'https://www.efinancialcareers.co.uk/jobs/', 'job_board', true, 'UK finance job board', ARRAY[]::text[]),
  ('Glassdoor UK', 'https://www.glassdoor.co.uk/jobs/', 'job_board', true, 'Glassdoor UK job listings', ARRAY[]::text[]),
  ('Google Jobs', 'https://www.google.com/webhp?udm=8/', 'job_board', true, 'Google Jobs search', ARRAY[]::text[]),
  ('Indeed UK', 'https://uk.indeed.com/', 'job_board', true, 'Indeed UK job listings', ARRAY[]::text[]),
  ('LinkedIn Jobs', 'https://www.linkedin.com/jobs/search/', 'job_board', true, 'LinkedIn public job search', ARRAY[]::text[])
ON CONFLICT DO NOTHING;
