/*
  # Job Application Tracker Schema

  ## Overview
  Creates the database schema for a job application tracking CRM system.

  ## New Tables
  
  ### `jobs`
  Main table for storing job applications with the following columns:
  - `id` (uuid, primary key) - Unique identifier for each job
  - `user_id` (uuid, foreign key) - References auth.users, tracks job owner
  - `status` (text) - Current status: saved, applying, applied, interviewing, accepted, rejected, ghosted
  - `job_url` (text) - Link to the job posting
  - `job_title` (text, required) - Title of the position
  - `company` (text, required) - Company name
  - `location` (text) - Job location
  - `job_description` (text) - Full job description
  - `keywords` (text[]) - Array of relevant keywords
  - `team` (text) - Team or department name
  - `pay_scale` (text) - Salary range or compensation info
  - `days_posted` (integer) - Number of days the role has been posted
  - `date_added` (timestamptz) - When user added this job to tracker
  - `resume_link` (text) - Link to resume used for this application
  - `cover_letter_link` (text) - Link to cover letter
  - `notes` (text) - General notes about the application
  - `contact_person` (text) - Name of recruiter or contact
  - `referred_by` (text) - Person who referred you
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `job_comments`
  Comments on job applications (Jira-style):
  - `id` (uuid, primary key) - Unique identifier
  - `job_id` (uuid, foreign key) - References jobs table
  - `user_id` (uuid, foreign key) - Comment author
  - `comment` (text, required) - Comment content
  - `created_at` (timestamptz) - When comment was created

  ## Security
  - Enable RLS on all tables
  - Users can only view/modify their own jobs
  - Users can only view/modify comments on their own jobs

  ## Important Notes
  1. All timestamps use timestamptz for proper timezone handling
  2. Foreign key constraints ensure data integrity
  3. Indexes on user_id and status for efficient queries
  4. Array type for keywords allows flexible tagging
*/

-- Create jobs table
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

-- Create job_comments table
CREATE TABLE IF NOT EXISTS job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_date_added_idx ON jobs(date_added);
CREATE INDEX IF NOT EXISTS job_comments_job_id_idx ON job_comments(job_id);

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY;

-- Jobs table policies
CREATE POLICY "Users can view own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Job comments policies
CREATE POLICY "Users can view comments on own jobs"
  ON job_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_comments.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments on own jobs"
  ON job_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_comments.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own comments"
  ON job_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON job_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on jobs table
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();