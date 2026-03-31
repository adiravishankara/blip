export type CaptureAction = 'add' | 'compare';

export interface ExtensionSettings {
  selectionRequired: boolean;
}

export interface CapturePayload {
  id: string;
  action: CaptureAction;
  selectionText: string;
  pageUrl: string;
  pageTitle: string;
  roleUrl: string;
  jobTitle: string;
  company: string;
  location: string;
  rawCapture: Record<string, unknown>;
  createdAt: string;
}

export interface PendingCaptureState {
  status: 'pending' | 'processing' | 'ready' | 'error';
  capture: CapturePayload;
  jobId?: string;
  matchResults?: MatchResult[];
  resumeState?: 'empty' | 'processing' | 'ready';
  error?: string;
}

export interface MatchResult {
  resume_version_id: string;
  label: string;
  score: number;
  semantic_sim: number;
  keyword_overlap: number;
  matched_keywords: string[];
  missing_keywords: string[];
}

export interface MatchResponse {
  results: MatchResult[];
  resume_state: 'empty' | 'processing' | 'ready';
  total_resume_versions: number;
  ready_resume_versions: number;
}

export interface ContentCaptureResponse {
  ok: true;
  capture: Omit<CapturePayload, 'id' | 'action' | 'createdAt'>;
}
