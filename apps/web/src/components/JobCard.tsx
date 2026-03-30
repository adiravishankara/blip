import { useMemo, useState } from 'react';
import { Job } from '../types';
import { Calendar, Flag, ExternalLink, Copy, Check, Bolt, Loader2 } from 'lucide-react';
import { buildJobHealth, isSuggestedFollowUpDue } from '../utils/jobHealth';
import { matchResumeForJob } from '../services/matchResume';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  allJobs?: Job[];
}

const PRIORITY_ICON = {
  low: <Flag className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />,
  medium: <Flag className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />,
  high: <Flag className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />,
  critical: <Flag className="w-3.5 h-3.5 text-red-500 fill-red-500" />,
};

export function JobCard({ job, onClick, selectionMode, isSelected, allJobs = [] }: JobCardProps) {
  const daysSinceAdded = Math.floor(
    (new Date().getTime() - new Date(job.date_added).getTime()) / (1000 * 60 * 60 * 24)
  );

  const health = useMemo(() => {
    const duplicateCandidates = allJobs
      .filter(other => other.id !== job.id)
      .filter(other => {
        const sameUrl = job.normalized_job_url && other.normalized_job_url && job.normalized_job_url === other.normalized_job_url;
        const sameCompanyTitle =
          other.company.trim().toLowerCase() === job.company.trim().toLowerCase() &&
          other.normalized_title &&
          job.normalized_title &&
          other.normalized_title === job.normalized_title;

        return Boolean(sameUrl || sameCompanyTitle);
      })
      .map(other => ({
        id: other.id,
        company: other.company,
        job_title: other.job_title,
        job_url: other.job_url,
        severity: 'exact' as const,
        reason: other.normalized_job_url === job.normalized_job_url ? 'matching_url' : 'matching_company_title',
      }));

    return buildJobHealth(job, {
      duplicateCandidates,
      followUp: null,
    });
  }, [allJobs, job]);

  const followUpDue = isSuggestedFollowUpDue(job);
  const [copied, setCopied] = useState(false);
  const [matching, setMatching] = useState(false);

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = `Read the docs, and edit the resume for the following role.
Role:
${job.job_title} - ${job.company}
${job.job_description ?? ''}

Resume:
`;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (matching) return;
    setMatching(true);
    try {
      await matchResumeForJob(job.id);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to match resume.');
    } finally {
      setMatching(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`h-[132px] min-h-[132px] max-h-[132px] flex flex-col overflow-hidden bg-white rounded border p-3 shadow-sm transition-all group select-none relative cursor-pointer
        ${selectionMode && isSelected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-blue-50/30'}
      `}
    >
      {selectionMode && (
        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm bg-white z-10
          ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}
        `}>
          {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
      )}

      <div className="flex flex-col gap-2 min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-gray-800 leading-tight group-hover:text-blue-600 transition-colors mb-1 truncate" title={job.job_title}>
            {job.job_title}
          </h3>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-tight truncate" title={job.company}>
              {job.company}
            </span>
            {job.job_url && (
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-blue-500 transition-colors"
                title="View Job Posting"
              >
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 min-h-[24px]">
          {health.duplicateSeverity !== 'none' && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              health.duplicateSeverity === 'exact' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {health.duplicateSeverity === 'exact' ? 'Duplicate' : 'Possible duplicate'}
            </span>
          )}
          {health.ageState !== 'healthy' && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              health.ageState === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {health.ageLabel}
            </span>
          )}
          {!health.ageLabel && followUpDue && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Follow up due
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100/50">
          <div className="flex items-center gap-2">
            <div>{PRIORITY_ICON[job.priority]}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMatch}
              title="Match resume"
              className={`opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded ${
                matching ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
              }`}
            >
              {matching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bolt className="w-3 h-3" />}
            </button>
            <button
              onClick={handleCopyPrompt}
              title="Copy resume prompt"
              className={`opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded ${
                copied ? 'text-emerald-500' : 'text-gray-400 hover:text-blue-500'
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
              <Calendar className="w-2.5 h-2.5" />
              <span>{daysSinceAdded}d</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

