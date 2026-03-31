/*
  # Resume Matching Foundations (pgvector + embeddings)

  Adds the minimum database pieces needed to:
  - store resume versions and their embeddings (gte-small => 384 dims)
  - store job description embeddings
  - run similarity search via RPC (PostgREST-compatible)
  - persist match score freshness on jobs
*/

-- Enable pgvector under the standard Supabase extensions schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
  ) THEN
    CREATE EXTENSION vector WITH SCHEMA extensions;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Resume Versions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL,
  storage_path text NOT NULL,
  extracted_text text,
  embedding_status text NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'ready', 'error')),
  embedding_model text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx ON public.resume_versions(user_id);
CREATE INDEX IF NOT EXISTS resume_versions_status_idx ON public.resume_versions(embedding_status);

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own resume versions" ON public.resume_versions;
CREATE POLICY "Users can view own resume versions"
  ON public.resume_versions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own resume versions" ON public.resume_versions;
CREATE POLICY "Users can insert own resume versions"
  ON public.resume_versions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own resume versions" ON public.resume_versions;
CREATE POLICY "Users can update own resume versions"
  ON public.resume_versions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own resume versions" ON public.resume_versions;
CREATE POLICY "Users can delete own resume versions"
  ON public.resume_versions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_resume_versions_updated_at ON public.resume_versions;
CREATE TRIGGER update_resume_versions_updated_at
  BEFORE UPDATE ON public.resume_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2) Resume Embeddings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resume_version_embeddings (
  resume_version_id uuid PRIMARY KEY REFERENCES public.resume_versions(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding extensions.vector(384) NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.resume_version_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own resume embeddings" ON public.resume_version_embeddings;
CREATE POLICY "Users can view own resume embeddings"
  ON public.resume_version_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.resume_versions rv
      WHERE rv.id = resume_version_embeddings.resume_version_id
        AND rv.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can upsert own resume embeddings" ON public.resume_version_embeddings;
CREATE POLICY "Users can upsert own resume embeddings"
  ON public.resume_version_embeddings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.resume_versions rv
      WHERE rv.id = resume_version_embeddings.resume_version_id
        AND rv.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.resume_versions rv
      WHERE rv.id = resume_version_embeddings.resume_version_id
        AND rv.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Job Embeddings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_embeddings (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding extensions.vector(384) NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.job_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own job embeddings" ON public.job_embeddings;
CREATE POLICY "Users can view own job embeddings"
  ON public.job_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_embeddings.job_id
        AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can upsert own job embeddings" ON public.job_embeddings;
CREATE POLICY "Users can upsert own job embeddings"
  ON public.job_embeddings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_embeddings.job_id
        AND j.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_embeddings.job_id
        AND j.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4) Match score freshness on jobs
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'match_score_updated_at'
  ) THEN
    ALTER TABLE public.jobs
      ADD COLUMN match_score_updated_at timestamptz;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) RPC: similarity search for a user's resumes (PostgREST compatible)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_resumes (
  query_embedding extensions.vector(384),
  match_user_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  resume_version_id uuid,
  label text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rv.id AS resume_version_id,
    rv.label,
    1 - (rve.embedding <=> query_embedding) AS similarity
  FROM public.resume_version_embeddings rve
  JOIN public.resume_versions rv ON rv.id = rve.resume_version_id
  WHERE rv.user_id = match_user_id
    AND rv.embedding_status = 'ready'
  ORDER BY rve.embedding <=> query_embedding
  LIMIT match_count;
$$;

