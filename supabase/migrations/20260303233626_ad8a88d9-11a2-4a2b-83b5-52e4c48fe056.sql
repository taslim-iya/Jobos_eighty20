ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}';
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS job_titles text[] DEFAULT '{}';