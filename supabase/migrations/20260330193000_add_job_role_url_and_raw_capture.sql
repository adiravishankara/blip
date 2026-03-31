/*
  # Add canonical role URL and raw capture metadata to jobs

  Keeps the existing `job_url` field as the provenance URL for where the user
  was when they captured the role, while `role_url` can store the canonical
  posting URL. `raw_capture` stores structured extraction metadata for future
  extension and debugging flows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'role_url'
  ) THEN
    ALTER TABLE public.jobs
      ADD COLUMN role_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'raw_capture'
  ) THEN
    ALTER TABLE public.jobs
      ADD COLUMN raw_capture jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jobs_user_role_url_idx
  ON public.jobs(user_id, role_url)
  WHERE role_url IS NOT NULL;
