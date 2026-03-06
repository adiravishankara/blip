-- Enable Realtime for the relevant tables
-- This is necessary for the frontend to receive updates via supabase.channel().on('postgres_changes', ...)
-- Check if the publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
