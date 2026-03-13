import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { findDuplicateCandidates } from '../services/duplicates';
import { generateFollowUpDraft } from '../services/followUpDrafting';
import { createSuggestedFollowUp, dismissFollowUp, getLatestFollowUpForJob, markFollowUpSent, saveFollowUpDraft } from '../services/followUps';
import { DuplicateCandidate, Job, JobComment, JobFollowUp } from '../types';
import { getDaysSince, getJobReferenceDate, getSuggestedFollowUp } from '../utils/jobHealth';
import { supabase } from '../lib/supabase';

interface JobHealthPanelProps {
  job: Job;
  onUpdate: () => void;
}

export function JobHealthPanel({ job, onUpdate }: JobHealthPanelProps) {
  const { profile } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [followUp, setFollowUp] = useState<JobFollowUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [recentComments, setRecentComments] = useState<JobComment[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [duplicateData, followUpData, commentsData] = await Promise.all([
          findDuplicateCandidates({
            userId: job.user_id,
            company: job.company,
            jobTitle: job.job_title,
            jobUrl: job.job_url || null,
          }),
          getLatestFollowUpForJob(job.id),
          supabase
            .from('job_comments')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(3),
        ]);

        if (!active) return;
        setDuplicates(duplicateData.filter(candidate => candidate.id !== job.id));
        setFollowUp(followUpData);
        setRecentComments(((commentsData.data ?? []) as JobComment[]));
      } catch (error) {
        console.error('Failed to load job health data:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [job.company, job.id, job.job_title, job.job_url, job.user_id]);

  const suggestedFollowUp = useMemo(() => getSuggestedFollowUp(job), [job]);

  const ensureFollowUp = async () => {
    if (followUp) return followUp;
    const created = await createSuggestedFollowUp(job);
    if (created) {
      setFollowUp(created);
      return created;
    }
    return null;
  };

  const handleGenerateDraft = async () => {
    setWorking(true);
    try {
      const currentFollowUp = await ensureFollowUp();
      if (!currentFollowUp) return;

      const draft = await generateFollowUpDraft({
        userProfile: profile,
        job,
        contactName: job.contact_person,
        daysSinceLastActivity: getDaysSince(getJobReferenceDate(job)),
        followUpReason: currentFollowUp.reason,
        recentComments: recentComments.map(comment => comment.comment),
      });

      const saved = await saveFollowUpDraft(currentFollowUp.id, draft);
      setFollowUp(saved);
      onUpdate();
    } catch (error) {
      console.error('Failed to generate draft:', error);
    } finally {
      setWorking(false);
    }
  };

  const handleMarkSent = async () => {
    if (!followUp) return;
    setWorking(true);
    try {
      const updated = await markFollowUpSent(followUp.id);
      setFollowUp(updated);
      onUpdate();
    } finally {
      setWorking(false);
    }
  };

  const handleDismiss = async () => {
    if (!followUp) return;
    setWorking(true);
    try {
      const updated = await dismissFollowUp(followUp.id);
      setFollowUp(updated);
      onUpdate();
    } finally {
      setWorking(false);
    }
  };

  const copyDraft = async () => {
    if (!followUp?.draft_body) return;
    await navigator.clipboard.writeText(followUp.draft_body);
  };

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Duplicate Check</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading duplicate candidates...</div>
        ) : duplicates.length === 0 ? (
          <p className="text-sm text-slate-500">No duplicate candidates found.</p>
        ) : (
          <div className="space-y-2">
            {duplicates.map(candidate => (
              <div key={candidate.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{candidate.company} · {candidate.job_title}</div>
                    <div className="text-xs text-slate-500">{candidate.reason.replace(/_/g, ' ')}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${candidate.severity === 'exact' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                    {candidate.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Follow-up</h3>
          {working && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {!followUp && suggestedFollowUp && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 mb-3">
            <div className="font-semibold">Follow-up recommended</div>
            <div className="mt-1">{suggestedFollowUp.reason}</div>
            <button
              onClick={handleGenerateDraft}
              disabled={working}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-semibold disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Create draft
            </button>
          </div>
        )}

        {!followUp && !suggestedFollowUp && (
          <p className="text-sm text-slate-500">No follow-up needed based on the current job status and activity.</p>
        )}

        {followUp && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 capitalize">{followUp.status}</div>
                  <div className="text-xs text-slate-500">{followUp.reason}</div>
                </div>
                {followUp.status === 'sent' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
            </div>

            {!followUp.draft_body && followUp.status !== 'dismissed' && followUp.status !== 'sent' && (
              <button
                onClick={handleGenerateDraft}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Generate draft
              </button>
            )}

            {followUp.draft_body && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 space-y-2">
                {followUp.draft_subject && <div className="text-sm font-semibold text-slate-900">{followUp.draft_subject}</div>}
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{followUp.draft_body}</pre>
                <button onClick={copyDraft} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  <Copy className="w-4 h-4" />
                  Copy draft
                </button>
              </div>
            )}

            {followUp.status !== 'sent' && followUp.status !== 'dismissed' && (
              <div className="flex items-center gap-2">
                <button onClick={handleMarkSent} disabled={working} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  Mark sent
                </button>
                <button onClick={handleDismiss} disabled={working} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

