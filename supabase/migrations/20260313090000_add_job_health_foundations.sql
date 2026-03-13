/*
  # Job Health Foundations

  Adds normalized duplicate-detection fields and activity tracking to jobs.
  Safe to run from Supabase SQL Editor.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'normalized_job_url'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN normalized_job_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'normalized_title'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN normalized_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'last_meaningful_activity_at'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN last_meaningful_activity_at timestamptz DEFAULT now() NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_job_title(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      lower(coalesce(input, '')),
      '[^a-z0-9]+',
      ' ',
      'g'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_job_url(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  raw_url text := nullif(trim(input), '');
  without_protocol text;
  host_part text;
  path_part text;
BEGIN
  IF raw_url IS NULL THEN
    RETURN NULL;
  END IF;

  without_protocol := regexp_replace(raw_url, '^https?://', '', 'i');
  without_protocol := split_part(without_protocol, '#', 1);
  without_protocol := split_part(without_protocol, '?', 1);
  without_protocol := regexp_replace(without_protocol, '/+$', '');

  host_part := split_part(without_protocol, '/', 1);
  path_part := substr(without_protocol, length(host_part) + 1);

  host_part := lower(regexp_replace(host_part, '^www\.', '', 'i'));
  path_part := regexp_replace(path_part, '/+', '/', 'g');
  path_part := regexp_replace(path_part, '/+$', '');

  IF path_part = '' THEN
    RETURN host_part;
  END IF;

  RETURN host_part || path_part;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_job_health_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_job_url := public.normalize_job_url(NEW.job_url);
  NEW.normalized_title := public.normalize_job_title(NEW.job_title);

  IF TG_OP = 'INSERT' THEN
    NEW.last_meaningful_activity_at := COALESCE(NEW.last_meaningful_activity_at, NEW.created_at, now());
    RETURN NEW;
  END IF;

  IF NEW.last_meaningful_activity_at IS NULL THEN
    NEW.last_meaningful_activity_at := COALESCE(NEW.updated_at, now());
  ELSIF OLD.status IS DISTINCT FROM NEW.status
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.job_description IS DISTINCT FROM NEW.job_description
    OR OLD.interview_date IS DISTINCT FROM NEW.interview_date
    OR OLD.application_deadline IS DISTINCT FROM NEW.application_deadline THEN
    NEW.last_meaningful_activity_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_health_fields ON public.jobs;
CREATE TRIGGER trg_sync_job_health_fields
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_health_fields();

UPDATE public.jobs
SET
  normalized_job_url = public.normalize_job_url(job_url),
  normalized_title = public.normalize_job_title(job_title),
  last_meaningful_activity_at = COALESCE(last_meaningful_activity_at, updated_at, created_at, now())
WHERE normalized_job_url IS DISTINCT FROM public.normalize_job_url(job_url)
   OR normalized_title IS DISTINCT FROM public.normalize_job_title(job_title)
   OR last_meaningful_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS jobs_user_normalized_job_url_idx
  ON public.jobs(user_id, normalized_job_url)
  WHERE normalized_job_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_user_company_normalized_title_idx
  ON public.jobs(user_id, lower(company), normalized_title)
  WHERE normalized_title IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_last_meaningful_activity_idx
  ON public.jobs(user_id, last_meaningful_activity_at DESC);

CREATE OR REPLACE FUNCTION public.touch_job_activity_from_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.jobs
  SET last_meaningful_activity_at = COALESCE(NEW.created_at, now())
  WHERE id = NEW.job_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_job_activity_from_comment ON public.job_comments;
CREATE TRIGGER trg_touch_job_activity_from_comment
  AFTER INSERT ON public.job_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_job_activity_from_comment();

CREATE OR REPLACE FUNCTION public.find_duplicate_jobs(
  p_user_id uuid,
  p_company text,
  p_job_title text,
  p_job_url text
)
RETURNS TABLE (
  job_id uuid,
  company text,
  job_title text,
  job_url text,
  severity text,
  reason text
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized_input AS (
    SELECT
      public.normalize_job_url(p_job_url) AS normalized_job_url,
      public.normalize_job_title(p_job_title) AS normalized_title,
      lower(trim(coalesce(p_company, ''))) AS normalized_company
  ),
  exact_url AS (
    SELECT
      j.id AS job_id,
      j.company,
      j.job_title,
      j.job_url,
      'exact'::text AS severity,
      'matching_url'::text AS reason,
      1 AS sort_order
    FROM public.jobs j
    CROSS JOIN normalized_input i
    WHERE j.user_id = p_user_id
      AND i.normalized_job_url IS NOT NULL
      AND j.normalized_job_url = i.normalized_job_url
  ),
  exact_title AS (
    SELECT
      j.id AS job_id,
      j.company,
      j.job_title,
      j.job_url,
      'exact'::text AS severity,
      'matching_company_title'::text AS reason,
      2 AS sort_order
    FROM public.jobs j
    CROSS JOIN normalized_input i
    WHERE j.user_id = p_user_id
      AND i.normalized_title IS NOT NULL
      AND lower(trim(j.company)) = i.normalized_company
      AND j.normalized_title = i.normalized_title
  ),
  likely_title AS (
    SELECT
      j.id AS job_id,
      j.company,
      j.job_title,
      j.job_url,
      'possible'::text AS severity,
      'similar_company_title'::text AS reason,
      3 AS sort_order
    FROM public.jobs j
    CROSS JOIN normalized_input i
    WHERE j.user_id = p_user_id
      AND i.normalized_title IS NOT NULL
      AND lower(trim(j.company)) = i.normalized_company
      AND j.normalized_title IS NOT NULL
      AND j.normalized_title <> i.normalized_title
      AND (
        j.normalized_title LIKE i.normalized_title || '%'
        OR i.normalized_title LIKE j.normalized_title || '%'
      )
  ),
  combined AS (
    SELECT * FROM exact_url
    UNION ALL
    SELECT * FROM exact_title
    UNION ALL
    SELECT * FROM likely_title
  )
  SELECT DISTINCT ON (job_id)
    job_id,
    company,
    job_title,
    job_url,
    severity,
    reason
  FROM combined
  ORDER BY job_id, sort_order;
$$;
