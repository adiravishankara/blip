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

export async function matchResumeForJob(jobId: string): Promise<MatchResumeResult[]> {
  const { data, error } = await supabase.functions.invoke('match-resume', {
    body: { job_id: jobId },
  });

  if (error) throw error;
  return (data?.results ?? []) as MatchResumeResult[];
}

