-- Create scraped_jobs table for caching Firecrawl results
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    job_title TEXT,
    company_name TEXT,
    location TEXT,
    compensation TEXT,
    team_name TEXT,
    description TEXT,
    raw_data JSONB,
    last_scraped_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by URL
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_url ON public.scraped_jobs(url);

-- Enable RLS
ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert/update cache
-- This is a shared cache to save API credits across users
CREATE POLICY "Allow authenticated read access" ON public.scraped_jobs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert access" ON public.scraped_jobs
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update access" ON public.scraped_jobs
    FOR UPDATE TO authenticated USING (true);
