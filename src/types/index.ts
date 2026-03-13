export type JobStatus = 'saved' | 'applying' | 'applied' | 'interviewing' | 'accepted' | 'rejected' | 'ghosted';
export type JobPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type WorkModePreference = 'remote' | 'hybrid' | 'onsite' | 'any';
export type DuplicateSeverity = 'none' | 'possible' | 'exact';
export type AgeState = 'healthy' | 'warning' | 'overdue';
export type FollowUpState = 'none' | 'upcoming' | 'due' | 'dismissed' | 'sent';
export type JobFollowUpStatus = 'suggested' | 'drafted' | 'sent' | 'dismissed';

export interface Job {
  id: string;
  user_id: string;
  status: JobStatus;
  priority: JobPriority;
  job_url?: string | null;
  job_title: string;
  company: string;
  location?: string | null;
  job_description?: string | null;
  keywords?: string[] | null;
  team?: string | null;
  pay_scale?: string | null;
  days_posted?: number | null;
  date_added: string;
  resume_link?: string | null;
  cover_letter_link?: string | null;
  notes?: string | null;
  contact_person?: string | null;
  referred_by?: string | null;
  normalized_job_url?: string | null;
  normalized_title?: string | null;
  last_meaningful_activity_at?: string | null;
  // Extended fields
  work_mode?: WorkMode | null;
  application_deadline?: string | null;
  interview_date?: string | null;
  offer_amount?: number | null;
  match_score?: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobComment {
  id: string;
  job_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface JobStatusHistoryEntry {
  id: string;
  job_id: string;
  user_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  changed_at: string;
}

export interface DuplicateCandidate {
  id: string;
  company: string;
  job_title: string;
  job_url?: string | null;
  severity: DuplicateSeverity;
  reason: string;
}

export interface JobHealth {
  duplicateSeverity: DuplicateSeverity;
  ageState: AgeState;
  ageLabel: string | null;
  followUpState: FollowUpState;
  followUpLabel: string | null;
}

export interface JobFollowUp {
  id: string;
  job_id: string;
  user_id: string;
  due_at: string;
  status: JobFollowUpStatus;
  reason: string;
  draft_subject?: string | null;
  draft_body?: string | null;
  sent_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeLink {
  label: string;
  url: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  role_type?: string;
  display_name?: string;
  target_roles: string[];
  preferred_locations: string[];
  min_salary?: number;
  work_mode_preference: WorkModePreference;
  resume_links: ResumeLink[];
  bio?: string;
  created_at: string;
  updated_at: string;
}
