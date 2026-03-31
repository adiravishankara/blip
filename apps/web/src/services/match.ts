import { supabase } from '../lib/supabase';

export interface MatchResumeResult {
  resume_version_id: string;
  label: string;
  score: number;
  semantic_sim: number;
  keyword_overlap: number;
  matched_keywords: string[];
  missing_keywords: string[];
}

export interface MatchResumeResponse {
  results: MatchResumeResult[];
  resume_state: 'empty' | 'processing' | 'ready';
  total_resume_versions: number;
  ready_resume_versions: number;
}

export async function matchResumeForJob(jobId: string): Promise<MatchResumeResponse> {
  const { data, error } = await supabase.functions.invoke('match-resume', {
    body: { job_id: jobId },
  });

  if (error) throw error;

  return {
    results: (data?.results ?? []) as MatchResumeResult[],
    resume_state: (data?.resume_state ?? 'ready') as MatchResumeResponse['resume_state'],
    total_resume_versions: Number(data?.total_resume_versions ?? 0),
    ready_resume_versions: Number(data?.ready_resume_versions ?? 0),
  };
}
