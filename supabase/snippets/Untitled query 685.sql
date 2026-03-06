-- 1. Extend the profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS role_type text;

-- 2. Ensure the resumes bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup Storage Policies (if not already there)
CREATE POLICY "Users can upload resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can view own resumes" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
);
