import { supabase } from '../lib/supabase';

export interface ResumeVersionSummary {
  id: string;
  label: string;
  storage_path: string;
  embedding_status: 'pending' | 'processing' | 'ready' | 'error';
  embedding_model?: string | null;
  updated_at: string;
  created_at: string;
}

export async function processResumeVersion(resumeVersionId: string) {
  const { data, error } = await supabase.functions.invoke('process-resume', {
    body: { resume_version_id: resumeVersionId },
  });

  if (error) throw error;
  return data;
}

export async function fetchResumeVersion(resumeVersionId: string): Promise<ResumeVersionSummary | null> {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('id,label,storage_path,embedding_status,embedding_model,updated_at,created_at')
    .eq('id', resumeVersionId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ResumeVersionSummary | null;
}

export async function updateResumeVersionLabel(resumeVersionId: string, label: string) {
  const { error } = await supabase
    .from('resume_versions')
    .update({
      label,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resumeVersionId);

  if (error) throw error;
}

export async function deleteResumeVersion(resume: ResumeVersionSummary) {
  const { error: storageError } = await supabase.storage
    .from('resumes')
    .remove([resume.storage_path]);

  if (storageError) throw storageError;

  const { error: deleteRowError } = await supabase
    .from('resume_versions')
    .delete()
    .eq('id', resume.id);

  if (deleteRowError) throw deleteRowError;
}

export async function waitForResumeProcessing(
  resumeVersionId: string,
  options?: { timeoutMs?: number; intervalMs?: number; onTick?: (resume: ResumeVersionSummary | null) => void }
) {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const resume = await fetchResumeVersion(resumeVersionId);
    options?.onTick?.(resume);

    if (!resume) return null;
    if (resume.embedding_status === 'ready' || resume.embedding_status === 'error') return resume;

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return fetchResumeVersion(resumeVersionId);
}
