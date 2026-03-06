/*
  # Add Priority Field to Jobs Table

  ## Changes
  - Adds `priority` column to jobs table with values: low, medium, high, critical
  - Default priority is 'medium'

  ## Details
  - `priority` (text) - Job application priority level for tracking important opportunities
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE jobs ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;
