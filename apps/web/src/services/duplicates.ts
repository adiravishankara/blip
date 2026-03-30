import { supabase } from '../lib/supabase';
import { DuplicateCandidate } from '../types';
import { normalizeJobUrl } from '../utils/jobNormalization';

interface DuplicateLookupInput {
  userId: string;
  company: string;
  jobTitle: string;
  jobUrl?: string | null;
}

export async function findDuplicateCandidates(input: DuplicateLookupInput): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase.rpc('find_duplicate_jobs', {
    p_user_id: input.userId,
    p_company: input.company,
    p_job_title: input.jobTitle,
    p_job_url: normalizeJobUrl(input.jobUrl),
  });

  if (error) throw error;

  return ((data ?? []) as Array<{
    job_id: string;
    company: string;
    job_title: string;
    job_url?: string | null;
    severity: DuplicateCandidate['severity'];
    reason: string;
  }>).map(candidate => ({
    id: candidate.job_id,
    company: candidate.company,
    job_title: candidate.job_title,
    job_url: candidate.job_url,
    severity: candidate.severity,
    reason: candidate.reason,
  }));
}

export async function hasExactDuplicate(input: DuplicateLookupInput): Promise<boolean> {
  const candidates = await findDuplicateCandidates(input);
  return candidates.some(candidate => candidate.severity === 'exact');
}
