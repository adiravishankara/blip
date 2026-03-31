import { createClient } from '@supabase/supabase-js';
import { DEFAULT_WEB_APP_URL } from './constants';
import type { CapturePayload, MatchResponse } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the extension build.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export function getBlipWebUrl() {
  return import.meta.env.VITE_BLIP_WEB_URL || DEFAULT_WEB_APP_URL;
}

export async function createJobFromCapture(capture: CapturePayload) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw userError ?? new Error('Please sign in to Blip.');

  const payload = {
    user_id: user.id,
    status: 'saved',
    job_url: capture.pageUrl,
    role_url: capture.roleUrl || capture.pageUrl,
    job_title: capture.jobTitle || 'Untitled Role',
    company: capture.company || new URL(capture.pageUrl).hostname.replace(/^www\./, ''),
    location: capture.location || null,
    job_description: capture.selectionText || null,
    raw_capture: capture.rawCapture,
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('id, job_title, company, match_score, match_score_updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function matchResumeForJob(jobId: string): Promise<MatchResponse> {
  const { data, error } = await supabase.functions.invoke('match-resume', {
    body: { job_id: jobId },
  });

  if (error) throw error;

  return {
    results: (data?.results ?? []) as MatchResponse['results'],
    resume_state: (data?.resume_state ?? 'ready') as MatchResponse['resume_state'],
    total_resume_versions: Number(data?.total_resume_versions ?? 0),
    ready_resume_versions: Number(data?.ready_resume_versions ?? 0),
  };
}
