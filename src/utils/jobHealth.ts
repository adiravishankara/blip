import { AgeState, DuplicateCandidate, DuplicateSeverity, FollowUpState, Job, JobFollowUp, JobHealth } from '../types';
import { normalizeCompanyName, normalizeJobTitle, normalizeJobUrl } from './jobNormalization';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const STATUS_THRESHOLDS: Partial<Record<Job['status'], { warning: number; overdue: number }>> = {
  saved: { warning: 5, overdue: 7 },
  applying: { warning: 3, overdue: 5 },
  applied: { warning: 7, overdue: 10 },
  interviewing: { warning: 4, overdue: 6 },
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getJobReferenceDate(job: Job): Date {
  return (
    parseDate(job.last_meaningful_activity_at) ??
    parseDate(job.updated_at) ??
    parseDate(job.date_added) ??
    new Date()
  );
}

export function getDaysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_IN_MS));
}

export function getAgeState(job: Job, now = new Date()): AgeState {
  const thresholds = STATUS_THRESHOLDS[job.status];
  if (!thresholds) return 'healthy';

  const interviewDate = parseDate(job.interview_date);
  if (job.status === 'interviewing' && interviewDate && interviewDate >= now) {
    return 'healthy';
  }

  const ageInDays = getDaysSince(getJobReferenceDate(job), now);
  if (ageInDays >= thresholds.overdue) return 'overdue';
  if (ageInDays >= thresholds.warning) return 'warning';
  return 'healthy';
}

export function getAgeLabel(job: Job, now = new Date()): string | null {
  const thresholds = STATUS_THRESHOLDS[job.status];
  if (!thresholds) return null;

  const referenceDate = getJobReferenceDate(job);
  const ageInDays = getDaysSince(referenceDate, now);
  const state = getAgeState(job, now);

  if (state === 'healthy') return `${ageInDays}d active`;
  if (state === 'warning') return `Stale ${ageInDays}d`;
  return `Overdue ${ageInDays}d`;
}

export function getSuggestedFollowUp(job: Job, now = new Date()): { dueAt: string; reason: string } | null {
  const referenceDate = getJobReferenceDate(job);
  const ageInDays = getDaysSince(referenceDate, now);

  if (job.status === 'applied' && ageInDays >= 7) {
    return {
      dueAt: now.toISOString(),
      reason: 'No update since application was submitted.',
    };
  }

  if (job.status === 'interviewing') {
    const interviewDate = parseDate(job.interview_date);
    if (interviewDate && interviewDate > now) {
      return null;
    }

    if (ageInDays >= 5) {
      return {
        dueAt: now.toISOString(),
        reason: 'No interview follow-up or next step has been recorded.',
      };
    }
  }

  return null;
}

export function getFollowUpState(followUp: JobFollowUp | null | undefined, now = new Date()): FollowUpState {
  if (!followUp) return 'none';
  if (followUp.status === 'dismissed') return 'dismissed';
  if (followUp.status === 'sent') return 'sent';

  const dueDate = parseDate(followUp.due_at);
  if (!dueDate) return 'none';

  return dueDate <= now ? 'due' : 'upcoming';
}

export function getFollowUpLabel(followUp: JobFollowUp | null | undefined, now = new Date()): string | null {
  const state = getFollowUpState(followUp, now);
  if (state === 'none') return null;
  if (state === 'dismissed') return 'Dismissed';
  if (state === 'sent') return 'Sent';

  const dueDate = parseDate(followUp?.due_at);
  if (!dueDate) return null;

  const days = getDaysSince(dueDate, now);
  return state === 'due' ? `Follow up due ${days}d` : `Follow up scheduled`;
}

export function getDuplicateSeverity(job: Job, candidates: DuplicateCandidate[]): DuplicateSeverity {
  const currentUrl = normalizeJobUrl(job.job_url);
  const currentCompany = normalizeCompanyName(job.company);
  const currentTitle = normalizeJobTitle(job.job_title);

  for (const candidate of candidates) {
    if (candidate.id === job.id) continue;

    if (currentUrl && normalizeJobUrl(candidate.job_url) === currentUrl) {
      return 'exact';
    }

    if (
      normalizeCompanyName(candidate.company) === currentCompany &&
      normalizeJobTitle(candidate.job_title) === currentTitle
    ) {
      return 'exact';
    }
  }

  return candidates.some(candidate => candidate.id !== job.id) ? 'possible' : 'none';
}

export function buildJobHealth(
  job: Job,
  options?: {
    duplicateCandidates?: DuplicateCandidate[];
    followUp?: JobFollowUp | null;
    now?: Date;
  }
): JobHealth {
  const now = options?.now ?? new Date();
  const duplicateSeverity = getDuplicateSeverity(job, options?.duplicateCandidates ?? []);
  const ageState = getAgeState(job, now);
  const followUpState = getFollowUpState(options?.followUp, now);

  return {
    duplicateSeverity,
    ageState,
    ageLabel: getAgeLabel(job, now),
    followUpState,
    followUpLabel: getFollowUpLabel(options?.followUp, now),
  };
}
