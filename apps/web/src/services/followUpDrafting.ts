import { Job, UserProfile } from '../types';

export interface GenerateDraftInput {
  userProfile: UserProfile | null;
  job: Job;
  contactName?: string | null;
  daysSinceLastActivity: number;
  followUpReason: string;
  recentComments: string[];
}

export interface DraftResult {
  subject: string;
  body: string;
}

const FOLLOW_UP_DRAFT_URL = import.meta.env.VITE_FOLLOW_UP_DRAFT_URL;
const FOLLOW_UP_DRAFT_API_KEY = import.meta.env.VITE_FOLLOW_UP_DRAFT_API_KEY;

function buildFallbackDraft(input: GenerateDraftInput): DraftResult {
  const recipient = input.contactName?.trim() || 'there';
  const role = input.job.job_title;
  const company = input.job.company;

  return {
    subject: `Following up on ${role} at ${company}`,
    body: [
      `Hi ${recipient},`,
      '',
      `I wanted to follow up on the ${role} opportunity at ${company}. ${input.followUpReason}`,
      '',
      'I remain interested in the role and would appreciate any update you can share on the timeline or next steps.',
      '',
      'Thank you,',
      input.userProfile?.full_name || input.userProfile?.display_name || 'Candidate',
    ].join('\n'),
  };
}

export async function generateFollowUpDraft(input: GenerateDraftInput): Promise<DraftResult> {
  if (!FOLLOW_UP_DRAFT_URL) {
    return buildFallbackDraft(input);
  }

  const response = await fetch(FOLLOW_UP_DRAFT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(FOLLOW_UP_DRAFT_API_KEY ? { Authorization: `Bearer ${FOLLOW_UP_DRAFT_API_KEY}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return buildFallbackDraft(input);
  }

  const data = (await response.json()) as Partial<DraftResult>;
  if (!data.subject || !data.body) {
    return buildFallbackDraft(input);
  }

  return {
    subject: data.subject,
    body: data.body,
  };
}
