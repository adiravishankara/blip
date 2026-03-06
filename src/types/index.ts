export type JobStatus = 'saved' | 'applying' | 'applied' | 'interviewing' | 'accepted' | 'rejected' | 'ghosted';
export type JobPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type WorkModePreference = 'remote' | 'hybrid' | 'onsite' | 'any';

export interface Job {
  id: string;
  user_id: string;
  status: JobStatus;
  priority: JobPriority;
  job_url?: string;
  job_title: string;
  company: string;
  location?: string;
  job_description?: string;
  keywords?: string[];
  team?: string;
  pay_scale?: string;
  days_posted?: number;
  date_added: string;
  resume_link?: string;
  cover_letter_link?: string;
  notes?: string;
  contact_person?: string;
  referred_by?: string;
  // Extended fields
  work_mode?: WorkMode;
  application_deadline?: string;  // ISO date string
  interview_date?: string;         // ISO datetime string
  offer_amount?: number;
  match_score?: number;            // 0-100
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
