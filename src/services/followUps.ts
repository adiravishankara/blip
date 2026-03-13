import { supabase } from '../lib/supabase';
import { Job, JobFollowUp, JobFollowUpStatus } from '../types';
import { DEFAULT_FOLLOW_UP_BUSINESS_DAYS, addBusinessDays, getSuggestedFollowUp } from '../utils/jobHealth';

const ACTIVE_FOLLOW_UP_STATUSES: JobFollowUpStatus[] = ['suggested', 'drafted'];

export async function listFollowUpsForUser(userId: string): Promise<JobFollowUp[]> {
  const { data, error } = await supabase.from('job_follow_ups').select('*').eq('user_id', userId).order('due_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobFollowUp[];
}

export async function listFollowUpsForJob(jobId: string): Promise<JobFollowUp[]> {
  const { data, error } = await supabase.from('job_follow_ups').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobFollowUp[];
}

export async function getLatestFollowUpForJob(jobId: string): Promise<JobFollowUp | null> {
  const { data, error } = await supabase.from('job_follow_ups').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as JobFollowUp | null) ?? null;
}

export async function createSuggestedFollowUp(job: Job): Promise<JobFollowUp | null> {
  const suggestion = getSuggestedFollowUp(job);
  if (!suggestion) return null;

  const { data: existing, error: existingError } = await supabase
    .from('job_follow_ups')
    .select('*')
    .eq('job_id', job.id)
    .in('status', ACTIVE_FOLLOW_UP_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as JobFollowUp;

  const { data, error } = await supabase
    .from('job_follow_ups')
    .insert({ job_id: job.id, user_id: job.user_id, due_at: suggestion.dueAt, status: 'suggested', reason: suggestion.reason })
    .select('*')
    .single();

  if (error) throw error;
  return data as JobFollowUp;
}

export async function saveFollowUpDraft(followUpId: string, draft: { subject: string; body: string }): Promise<JobFollowUp> {
  const { data, error } = await supabase
    .from('job_follow_ups')
    .update({ draft_subject: draft.subject, draft_body: draft.body, status: 'drafted' })
    .eq('id', followUpId)
    .select('*')
    .single();

  if (error) throw error;
  return data as JobFollowUp;
}

export async function markFollowUpSent(followUpId: string): Promise<JobFollowUp> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('job_follow_ups')
    .update({ status: 'sent', sent_at: timestamp })
    .eq('id', followUpId)
    .select('*')
    .single();

  if (error) throw error;
  return data as JobFollowUp;
}

export async function dismissFollowUp(followUpId: string): Promise<JobFollowUp> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('job_follow_ups')
    .update({ status: 'dismissed', dismissed_at: timestamp })
    .eq('id', followUpId)
    .select('*')
    .single();

  if (error) throw error;
  return data as JobFollowUp;
}

export async function resetFollowUpDefault(followUpId: string): Promise<JobFollowUp> {
  const dueAt = addBusinessDays(new Date(), DEFAULT_FOLLOW_UP_BUSINESS_DAYS).toISOString();
  const { data, error } = await supabase
    .from('job_follow_ups')
    .update({ status: 'suggested', due_at: dueAt, dismissed_at: null, sent_at: null })
    .eq('id', followUpId)
    .select('*')
    .single();

  if (error) throw error;
  return data as JobFollowUp;
}
