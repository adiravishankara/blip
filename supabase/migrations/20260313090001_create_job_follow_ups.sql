/*
  # Job Follow Ups

  Adds follow-up records and activity tracking hooks.
  Safe to run from Supabase SQL Editor.
*/

CREATE TABLE IF NOT EXISTS public.job_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('suggested', 'drafted', 'sent', 'dismissed')),
  reason text NOT NULL,
  draft_subject text,
  draft_body text,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.job_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own follow ups" ON public.job_follow_ups;
CREATE POLICY "Users can view own follow ups"
  ON public.job_follow_ups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own follow ups" ON public.job_follow_ups;
CREATE POLICY "Users can insert own follow ups"
  ON public.job_follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own follow ups" ON public.job_follow_ups;
CREATE POLICY "Users can update own follow ups"
  ON public.job_follow_ups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own follow ups" ON public.job_follow_ups;
CREATE POLICY "Users can delete own follow ups"
  ON public.job_follow_ups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_follow_ups_user_status_due_idx
  ON public.job_follow_ups(user_id, status, due_at);

CREATE INDEX IF NOT EXISTS job_follow_ups_job_created_idx
  ON public.job_follow_ups(job_id, created_at DESC);

DROP TRIGGER IF EXISTS update_job_follow_ups_updated_at ON public.job_follow_ups;
CREATE TRIGGER update_job_follow_ups_updated_at
  BEFORE UPDATE ON public.job_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.touch_job_activity_from_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.jobs
    SET last_meaningful_activity_at = COALESCE(NEW.sent_at, now())
    WHERE id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_job_activity_from_follow_up ON public.job_follow_ups;
CREATE TRIGGER trg_touch_job_activity_from_follow_up
  AFTER INSERT OR UPDATE ON public.job_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_job_activity_from_follow_up();
