
-- Application queue table for tracking auto-apply workflow
CREATE TABLE public.application_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  cover_letter TEXT,
  ai_answers JSONB DEFAULT '{}',
  notes TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own queue" ON public.application_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert to their own queue" ON public.application_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own queue" ON public.application_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete from their own queue" ON public.application_queue FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_application_queue_updated_at BEFORE UPDATE ON public.application_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
