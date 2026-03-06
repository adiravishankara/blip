/*
  # Add Extended Job Columns

  ## Changes
  - `work_mode` (text): 'remote' | 'hybrid' | 'onsite'
  - `application_deadline` (date): deadline to submit application
  - `interview_date` (timestamptz): next scheduled interview
  - `offer_amount` (numeric): offer amount if accepted
  - `match_score` (numeric 0-100): future AI-computed match score vs user profile
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'work_mode'
  ) THEN
    ALTER TABLE jobs ADD COLUMN work_mode text
      CHECK (work_mode IN ('remote', 'hybrid', 'onsite'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'application_deadline'
  ) THEN
    ALTER TABLE jobs ADD COLUMN application_deadline date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'interview_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN interview_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'offer_amount'
  ) THEN
    ALTER TABLE jobs ADD COLUMN offer_amount numeric(12, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'match_score'
  ) THEN
    ALTER TABLE jobs ADD COLUMN match_score numeric(5, 2)
      CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100));
  END IF;
END $$;
