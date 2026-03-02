-- Add url column to jobs table for storing job application links
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS url text;
