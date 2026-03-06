-- Add new fields for onboarding to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS role_type text;

-- Create resumes bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to view their own files
CREATE POLICY "Users can view own resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
