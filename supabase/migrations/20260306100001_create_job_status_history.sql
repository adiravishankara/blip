/*
  # Job Status History

  ## New Table: `job_status_history`
  Automatically records every time a job's status changes.

  ## Columns
  - `id` (uuid, PK)
  - `job_id` (uuid, FK → jobs)
  - `user_id` (uuid, FK → auth.users) — denormalized for RLS
  - `from_status` (text, nullable) — null on initial insert
  - `to_status` (text, NOT NULL)
  - `changed_at` (timestamptz) — defaults to now()

  ## Trigger
  A BEFORE/AFTER UPDATE trigger on `jobs` inserts a row here whenever
  `status` changes. No frontend changes required — the DB handles it.

  ## Security
  RLS: users can only view history entries for their own jobs.
*/

-- Create the table
CREATE TABLE IF NOT EXISTS job_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_status text,
  to_status   text NOT NULL,
  changed_at  timestamptz DEFAULT now() NOT NULL
);

-- Index for fast per-job lookups
CREATE INDEX IF NOT EXISTS job_status_history_job_id_idx
  ON job_status_history(job_id);

CREATE INDEX IF NOT EXISTS job_status_history_changed_at_idx
  ON job_status_history(changed_at);

-- Enable RLS
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

-- Only the job owner can see history
CREATE POLICY "Users can view own job status history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function: auto-insert a history row on status change
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

-- Attach trigger to jobs table
DROP TRIGGER IF EXISTS trg_job_status_change ON jobs;
CREATE TRIGGER trg_job_status_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION record_job_status_change();

-- Also record the initial status when a job is first inserted
CREATE OR REPLACE FUNCTION record_initial_job_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO job_status_history (job_id, user_id, from_status, to_status)
  VALUES (NEW.id, NEW.user_id, NULL, NEW.status);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_initial_status ON jobs;
CREATE TRIGGER trg_job_initial_status
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION record_initial_job_status();
