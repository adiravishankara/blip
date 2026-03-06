/*
  # User Profiles

  ## New Table: `user_profiles`
  Stores job seeker preferences used for filtering and future match scoring.

  ## Columns
  - `id` (uuid, PK = auth.uid())
  - `user_id` (uuid, UNIQUE FK → auth.users)
  - `display_name` (text)
  - `target_roles` (text[]) — e.g. ["Software Engineer", "ML Engineer"]
  - `preferred_locations` (text[]) — e.g. ["Remote", "San Francisco"]
  - `min_salary` (integer) — annual, in USD
  - `work_mode_preference` (text) — 'remote' | 'hybrid' | 'onsite' | 'any'
  - `resume_links` (jsonb) — array of { label: string, url: string }
  - `bio` (text) — short blurb about the candidate
  - `created_at` / `updated_at` (timestamptz)

  ## Security
  RLS: users can only SELECT/INSERT/UPDATE their own profile.
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name          text,
  target_roles          text[] DEFAULT '{}',
  preferred_locations   text[] DEFAULT '{}',
  min_salary            integer CHECK (min_salary IS NULL OR min_salary >= 0),
  work_mode_preference  text DEFAULT 'any'
    CHECK (work_mode_preference IN ('remote', 'hybrid', 'onsite', 'any')),
  resume_links          jsonb DEFAULT '[]'::jsonb,
  bio                   text,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at (reuse the function created in the initial migration)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
