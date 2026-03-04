
-- Fix the overly permissive INSERT policy on profile_job_matches
-- Drop the permissive one, replace with admin-only insert (edge function uses service role)
DROP POLICY IF EXISTS "System can insert matches" ON public.profile_job_matches;
