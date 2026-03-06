-- Seed file for local development
-- Create a test user in auth.users (Supabase local specific)
-- Password for 'abcd1234' hashed for local development if needed, 
-- but normally we use supabase.auth.signUp or the dashboard.
-- For local seed, we insert into auth.users

DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- 1. Create User in Auth Schema with all required fields
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    test_user_id,
    'authenticated',
    'authenticated',
    'test@yopmail.com',
    crypt('abcd1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"testy klee"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = now(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- 2. Create User Profile
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
      INSERT INTO public.user_profiles (user_id, full_name, email, role_type, target_roles, preferred_locations, work_mode_preference, display_name)
      VALUES (
        test_user_id,
        'testy klee',
        'test@yopmail.com',
        'Hardware Engineer',
        ARRAY['Hardware Architect', 'Systems Engineer', 'PCB Designer', 'Firmware Engineer', 'Robotics Engineer'],
        ARRAY['Toronto', 'San Francisco', 'New York'],
        'hybrid',
        'Testy'
      ) ON CONFLICT (user_id) DO UPDATE 
      SET full_name = EXCLUDED.full_name, role_type = EXCLUDED.role_type, email = EXCLUDED.email;
  END IF;

  -- 3. Create 5 Random Job Roles
  INSERT INTO public.jobs (user_id, job_title, company, location, status, priority, job_description, date_added)
  VALUES 
    (test_user_id, 'Senior Hardware Engineer', 'Tesla', 'Toronto, ON', 'applying', 'high', 'Lead the design of next-gen vehicle electronics.', now() - interval '2 days'),
    (test_user_id, 'Hardware Architect', 'Apple', 'Cupertino, CA (Remote)', 'interviewing', 'critical', 'Designing custom silicon and hardware platforms.', now() - interval '5 days'),
    (test_user_id, 'Robotics Systems Engineer', 'Boston Dynamics', 'Toronto, ON', 'saved', 'medium', 'Integration of sensing and actuation for bipedal robots.', now() - interval '1 day'),
    (test_user_id, 'PCB Design Engineer', 'North', 'Kitchener, ON', 'applied', 'medium', 'High-speed digital and mixed-signal PCB design.', now() - interval '10 days'),
    (test_user_id, 'Firmware Developer', 'AMD', 'Markham, ON', 'saved', 'low', 'Low-level software development for GPU sub-systems.', now() - interval '3 days')
  ON CONFLICT DO NOTHING;

END $$;
