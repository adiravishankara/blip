# Job Health Features Plan

This document turns the selected roadmap items into an implementation-ready plan for Blip:

- Follow-up automation
- Duplicate detection
- SLA / aging indicators

The plan assumes we keep the current product model centered on `jobs` and layer these features on top of the existing dashboard, kanban board, and job detail modal.

## Product Direction

These three features fit best as one shared concept: `job health`.

Each job can have health signals such as:

- `duplicate_risk`
- `age_state`
- `follow_up_state`

That gives us one consistent way to:

- show badges on cards
- filter jobs by attention needed
- summarize problems on the dashboard
- surface action panels in the job detail modal

## Current App Surfaces

The current implementation already gives us the right insertion points:

- Job creation: `src/components/AddJobModal.tsx`
- Scraped job creation: `src/services/scraper.ts`
- Board rendering: `src/components/KanbanBoard.tsx`
- Card rendering: `src/components/JobCard.tsx`
- Dashboard analytics: `src/components/HomeView.tsx`
- Job editing and detail view: `src/components/JobDetailModal.tsx`
- Filters: `src/hooks/useJobFilters.ts`
- Shared models: `src/types/index.ts`
- Database schema: `schema.sql`

## Shared Domain Model

### New derived concepts

These can start as frontend-derived values:

- `DuplicateSeverity = 'none' | 'possible' | 'exact'`
- `AgeState = 'healthy' | 'warning' | 'overdue'`
- `FollowUpState = 'none' | 'upcoming' | 'due' | 'dismissed' | 'sent'`

### Suggested TypeScript additions

Add view-model types in `src/types/index.ts` or in a dedicated `src/types/jobHealth.ts`:

```ts
export type DuplicateSeverity = 'none' | 'possible' | 'exact';
export type AgeState = 'healthy' | 'warning' | 'overdue';
export type FollowUpState = 'none' | 'upcoming' | 'due' | 'dismissed' | 'sent';

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
  status: 'suggested' | 'drafted' | 'sent' | 'dismissed';
  reason: string;
  draft_subject?: string | null;
  draft_body?: string | null;
  sent_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  updated_at: string;
}
```

## Schema Changes

## 1. Duplicate detection

### Jobs table additions

Add normalized columns to `jobs`:

- `normalized_job_url text`
- `normalized_title text`

Optional future-facing columns:

- `canonical_job_id uuid references jobs(id)`
- `duplicate_group_id uuid`

### Indexes

Add indexes scoped to duplicate lookups:

- `(user_id, normalized_job_url)`
- `(user_id, company, normalized_title)`

### Database helpers

Add one SQL function to keep detection logic centralized:

```sql
find_duplicate_jobs(
  p_user_id uuid,
  p_company text,
  p_job_title text,
  p_job_url text
)
```

The function should:

- normalize URL and title
- return exact matches by URL
- return exact matches by `company + normalized_title`
- optionally return likely matches by same company and fuzzy-similar title

For v1, exact and simple likely matching are enough. We do not need merge logic yet.

## 2. SLA / aging indicators

### Jobs table additions

For v1, we can compute aging from existing fields:

- `status`
- `date_added`
- `updated_at`
- `interview_date`

Recommended addition for cleaner logic:

- `last_meaningful_activity_at timestamptz`

This field should be updated when:

- status changes
- notes are updated
- comments are added
- follow-up is marked sent

This gives a better signal than `updated_at`, which may change for cosmetic edits later.

### Optional preferences table

Not needed for v1, but useful later:

- `user_sla_preferences`

This would allow custom thresholds per status. For now, use app defaults.

## 3. Follow-up automation

### New table

Add `job_follow_ups`:

```sql
create table if not exists job_follow_ups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  due_at timestamptz not null,
  status text not null check (status in ('suggested', 'drafted', 'sent', 'dismissed')),
  reason text not null,
  draft_subject text,
  draft_body text,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### Indexes

- `(user_id, status, due_at)`
- `(job_id, created_at desc)`

### RLS

Mirror the existing `jobs` table ownership model:

- select own follow-ups
- insert own follow-ups
- update own follow-ups
- delete own follow-ups if needed

### Trigger behavior

Optional but recommended:

- update `updated_at` automatically
- update `jobs.last_meaningful_activity_at` when a follow-up is marked `sent`

## Frontend Utility Layer

Add a small shared utility/service layer:

- `src/utils/jobNormalization.ts`
- `src/utils/jobHealth.ts`
- `src/services/followUps.ts`

### `jobNormalization.ts`

Responsibilities:

- normalize job title
- normalize company name for matching
- clean job URLs consistently

Suggested helpers:

```ts
normalizeJobTitle(title: string): string
normalizeCompanyName(company: string): string
normalizeJobUrl(url: string): string | null
```

### `jobHealth.ts`

Responsibilities:

- compute age state from job status and timestamps
- compute follow-up recommendations
- format UI labels

Suggested helpers:

```ts
getAgeState(job: Job, now = new Date()): AgeState
getAgeLabel(job: Job, now = new Date()): string | null
getSuggestedFollowUp(job: Job, now = new Date()): { dueAt: string; reason: string } | null
buildJobHealth(job: Job, followUp?: JobFollowUp | null): JobHealth
```

### `followUps.ts`

Responsibilities:

- load follow-ups
- create recommendation records
- mark follow-up sent or dismissed
- request LLM draft generation

Suggested helpers:

```ts
listFollowUpsForUser(userId: string): Promise<JobFollowUp[]>
createSuggestedFollowUp(job: Job): Promise<JobFollowUp>
markFollowUpSent(followUpId: string): Promise<void>
dismissFollowUp(followUpId: string): Promise<void>
generateFollowUpDraft(input: GenerateDraftInput): Promise<DraftResult>
```

## UI Changes By Feature

## 1. Duplicate detection

### `src/components/AddJobModal.tsx`

Add duplicate checks when:

- URL changes
- title changes
- company changes

UX:

- show inline warning area under title/company/URL fields
- list top duplicate candidates
- allow user to:
  - open existing job
  - continue anyway

Behavior:

- do not hard-block by default
- hard-block only exact URL duplicates if you want stricter data hygiene later

### `src/services/scraper.ts`

Before inserting into `jobs`:

- call duplicate detection using the cleaned URL and scraped company/title
- if exact duplicate found:
  - do not insert a new job
  - mark scraping job `completed`
  - store result metadata in `scraping_jobs.data`, for example:

```json
{
  "duplicate": true,
  "duplicate_job_id": "uuid",
  "duplicate_reason": "matching_url"
}
```

- if likely duplicate found:
  - either skip insert or insert with warning metadata

Recommended v1:

- skip insert for exact duplicate
- allow insert for likely duplicate but tag it in UI

### `src/components/JobCard.tsx`

Add a small badge when:

- job is exact duplicate
- job has likely duplicates

### `src/components/JobDetailModal.tsx`

Add a `Duplicates` section:

- show duplicate candidates
- explain reason: matching URL, same company/title, similar title
- future placeholder for merge action

## 2. SLA / aging indicators

### Aging rules for v1

Default thresholds:

- `saved`: warning at 5 days, overdue at 7 days
- `applying`: warning at 3 days, overdue at 5 days
- `applied`: warning at 7 days, overdue at 10 days
- `interviewing`: warning at 4 days, overdue at 6 days unless `interview_date` is upcoming
- `accepted`, `rejected`, `ghosted`: no SLA indicator

### `src/components/JobCard.tsx`

Add health chips such as:

- `Stale`
- `Overdue`
- `Follow up due`
- `3d old`

Keep the chip count small to avoid card noise. Recommended max: 2.

### `src/components/KanbanBoard.tsx`

Add column-level summaries:

- overdue count per status
- maybe a small red dot or count beside the existing total badge

Optional:

- sort overdue jobs to the top within each column

### `src/components/HomeView.tsx`

Add dashboard widgets:

- `Needs attention`
- `Follow-up due`
- `Oldest untouched`

Also add a short list of the top 3 or 5 jobs needing action.

### `src/hooks/useJobFilters.ts`

Add filters:

- `attentionOnly: boolean`
- `overdueOnly: boolean`
- `followUpDueOnly: boolean`

These should work on the derived `JobHealth` values.

## 3. Follow-up automation

### `src/components/JobDetailModal.tsx`

Add a `Follow-up` section in the sidebar or main content area:

- due date
- reason
- draft status
- buttons:
  - `Generate draft`
  - `Mark sent`
  - `Dismiss`

If a draft exists, show:

- subject
- message body
- copy button

### `src/components/HomeView.tsx`

Add a small queue card:

- jobs with follow-ups due soon or overdue
- quick action opens the job detail modal

### Optional later

Add a global panel for all follow-up tasks if this grows beyond a few cards.

## LLM Drafting Integration

This should be isolated behind one service boundary so model/provider changes do not spread through the app.

### New service

- `src/services/followUpDrafting.ts`

### Suggested input

```ts
interface GenerateDraftInput {
  userProfile: UserProfile | null;
  job: Job;
  contactName?: string | null;
  daysSinceLastActivity: number;
  followUpReason: string;
  recentComments: string[];
}
```

### Suggested output

```ts
interface DraftResult {
  subject: string;
  body: string;
}
```

### Prompting guidance

Generate concise outreach that is:

- polite
- specific to the company and role
- not overly eager or robotic
- short enough for email or LinkedIn

Recommended v1 product behavior:

- generate draft only on demand
- let the user edit/copy it
- do not auto-send

## Data Flow Changes

## Manual add flow

1. User enters URL, title, company.
2. Client normalizes inputs.
3. Client checks duplicate candidates.
4. User sees warning if needed.
5. On submit, insert normalized values too.

## Scrape flow

1. URL is cleaned before enqueue.
2. Scraper extracts structured data.
3. Before final insert, duplicate detection runs.
4. Exact duplicates are skipped and logged in scraping result metadata.
5. Non-duplicates are inserted with normalized fields.

## Job detail flow

1. Job modal loads comments and status history.
2. It should also load:
   - latest follow-up
   - duplicate candidates if any
3. User can:
   - generate draft
   - mark sent
   - dismiss

## Suggested Milestones

## Milestone 1: Duplicate detection foundation

Scope:

- normalized columns in schema
- duplicate detection SQL helper
- utility functions in frontend
- inline warnings in add modal
- scrape-time duplicate check

Acceptance criteria:

- exact duplicate URL is detected before insert
- duplicate warning appears in manual add flow
- scraping the same URL twice does not create two job rows

## Milestone 2: SLA / aging indicators

Scope:

- shared aging calculation utility
- chips on job cards
- overdue counts on board
- dashboard attention widgets
- filter support

Acceptance criteria:

- jobs in stale states are visually distinct
- users can filter to only attention-needing jobs
- dashboard highlights oldest untouched and follow-up-due jobs

## Milestone 3: Follow-up workflow

Scope:

- `job_follow_ups` table
- follow-up recommendation logic
- follow-up panel in job detail
- mark sent and dismiss actions
- dashboard due queue

Acceptance criteria:

- follow-up suggestions are created for eligible jobs
- user can mark a follow-up sent or dismissed
- due follow-ups appear in both dashboard and job detail

## Milestone 4: LLM-assisted drafting

Scope:

- draft generation service
- UI to generate and display draft
- persistence of subject/body on follow-up record

Acceptance criteria:

- user can generate a draft from a due follow-up
- draft includes role/company context
- draft can be copied and edited before sending

## File-Level Change List

### Database

- `schema.sql`

### Types

- `src/types/index.ts`
- optional new `src/types/jobHealth.ts`

### Components

- `src/components/AddJobModal.tsx`
- `src/components/JobCard.tsx`
- `src/components/KanbanBoard.tsx`
- `src/components/HomeView.tsx`
- `src/components/JobDetailModal.tsx`

### Hooks

- `src/hooks/useJobFilters.ts`

### Services and utils

- `src/services/scraper.ts`
- new `src/services/followUps.ts`
- new `src/services/followUpDrafting.ts`
- new `src/utils/jobNormalization.ts`
- new `src/utils/jobHealth.ts`

## Risks and Decisions

### Duplicate detection false positives

Risk:

- companies often repost similar roles
- title normalization can over-collapse legitimate openings

Decision:

- exact URL duplicates are strong enough to block or skip
- title/company matches should warn, not hard-block

### Aging noise

Risk:

- too many badges can make the board noisy

Decision:

- keep thresholds conservative
- show only top health indicators on cards
- let filters/dashboard carry the deeper signal

### Follow-up automation trust

Risk:

- bad timing or over-eager reminders can feel spammy

Decision:

- suggestions first, automation later
- generate drafts, do not send automatically

## Recommended Build Order

1. Ship duplicate detection first.
2. Add job health calculations and SLA indicators.
3. Add follow-up records and UI.
4. Add LLM drafting last.

This sequence reduces data-quality issues first, then surfaces actionability, then adds automation on top of clean signals.
