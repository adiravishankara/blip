-- =============================================================================
-- Blip - Full Supabase Schema (Single Run)
-- =============================================================================
-- Run this file to set up the entire database schema on a Supabase instance.
-- Usage: psql "YOUR_SUPABASE_DB_URL" -f supabase/schema.sql
-- Or paste into Supabase Dashboard > SQL Editor
--
-- Prerequisites: Supabase project (auth.users and storage schema must exist)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Jobs & Job Comments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applying', 'applied', 'interviewing', 'accepted', 'rejected', 'ghosted')),
  job_url text,
  job_title text NOT NULL,
  company text NOT NULL,
  location text,
  job_description text,
  keywords text[],
  team text,
  pay_scale text,
  days_posted integer DEFAULT 0,
  date_added timestamptz DEFAULT now() NOT NULL,
  resume_link text,
  cover_letter_link text,
  notes text,
  contact_person text,
  referred_by text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_date_added_idx ON jobs(date_added);
CREATE INDEX IF NOT EXISTS job_comments_job_id_idx ON job_comments(job_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own jobs" ON jobs;
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view comments on own jobs" ON job_comments;
CREATE POLICY "Users can view comments on own jobs" ON job_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_comments.job_id AND jobs.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert comments on own jobs" ON job_comments;
CREATE POLICY "Users can insert comments on own jobs" ON job_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_comments.job_id AND jobs.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own comments" ON job_comments;
CREATE POLICY "Users can update own comments" ON job_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments" ON job_comments;
CREATE POLICY "Users can delete own comments" ON job_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. Priority & Extended Job Columns
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'priority') THEN
    ALTER TABLE jobs ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'work_mode') THEN
    ALTER TABLE jobs ADD COLUMN work_mode text CHECK (work_mode IN ('remote', 'hybrid', 'onsite'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'application_deadline') THEN
    ALTER TABLE jobs ADD COLUMN application_deadline date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'interview_date') THEN
    ALTER TABLE jobs ADD COLUMN interview_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'offer_amount') THEN
    ALTER TABLE jobs ADD COLUMN offer_amount numeric(12, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'match_score') THEN
    ALTER TABLE jobs ADD COLUMN match_score numeric(5, 2) CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Job Status History
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS job_status_history_job_id_idx ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS job_status_history_changed_at_idx ON job_status_history(changed_at);

ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own job status history" ON job_status_history;
CREATE POLICY "Users can view own job status history" ON job_status_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION record_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_status_history (job_id, user_id, from_status, to_status)
    VALUES (NEW.id, NEW.user_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_initial_job_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO job_status_history (job_id, user_id, from_status, to_status)
  VALUES (NEW.id, NEW.user_id, NULL, NEW.status);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_status_change ON jobs;
CREATE TRIGGER trg_job_status_change AFTER UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION record_job_status_change();

DROP TRIGGER IF EXISTS trg_job_initial_status ON jobs;
CREATE TRIGGER trg_job_initial_status AFTER INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION record_initial_job_status();

-- -----------------------------------------------------------------------------
-- 4. User Profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name text,
  target_roles text[] DEFAULT '{}',
  preferred_locations text[] DEFAULT '{}',
  min_salary integer CHECK (min_salary IS NULL OR min_salary >= 0),
  work_mode_preference text DEFAULT 'any' CHECK (work_mode_preference IN ('remote', 'hybrid', 'onsite', 'any')),
  resume_links jsonb DEFAULT '[]'::jsonb,
  bio text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. Scraped Jobs Cache
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text UNIQUE NOT NULL,
  job_title text,
  company_name text,
  location text,
  compensation text,
  team_name text,
  description text,
  raw_data jsonb,
  last_scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_url ON public.scraped_jobs(url);

ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.scraped_jobs;
CREATE POLICY "Allow authenticated read access" ON public.scraped_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.scraped_jobs;
CREATE POLICY "Allow authenticated insert access" ON public.scraped_jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update access" ON public.scraped_jobs;
CREATE POLICY "Allow authenticated update access" ON public.scraped_jobs FOR UPDATE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- 6. Extended User Profiles & Storage
-- -----------------------------------------------------------------------------
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS role_type text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload resumes') THEN
    CREATE POLICY "Users can upload resumes" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can view own resumes') THEN
    CREATE POLICY "Users can view own resumes" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete own resumes') THEN
    CREATE POLICY "Users can delete own resumes" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Scraping Jobs Queue
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scraping jobs" ON public.scraping_jobs;
CREATE POLICY "Users can view their own scraping jobs" ON public.scraping_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own scraping jobs" ON public.scraping_jobs;
CREATE POLICY "Users can insert their own scraping jobs" ON public.scraping_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own scraping jobs" ON public.scraping_jobs;
CREATE POLICY "Users can update their own scraping jobs" ON public.scraping_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON public.scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON public.scraping_jobs(user_id);

-- -----------------------------------------------------------------------------
-- 8. Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scraping_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_jobs;
  END IF;
END $$;
