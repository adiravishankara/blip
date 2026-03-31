PRD: Blip Chrome Extension (Selection-First) + Shared Resume Match Service

## 1) Goal

Build a Chrome extension that can create a Job in Blip with minimal scraping cost by using what is already on-screen (DOM + user-highlighted text) and only falling back to Firecrawl when needed. Then compare that Job Description against the user's versioned resumes stored in Supabase.

The extension and the web app must share the same Supabase-backed resume matching service.

## 2) Product principles

- Selection-first: if the user highlights the job description and right-clicks, that selection is the primary source of truth.
- DOM before Firecrawl: try cheap extraction (document title + common selectors + page metadata) first; Firecrawl is a last resort.
- One account: authentication and data live in Supabase (same user as the Blip web app).
- Fast feedback: "Add Job" should feel instant; "Compare" should return results quickly and explain why.
- Shared matching backend: the web app and extension both call the same `match-resume` Supabase Edge Function.

## 3) Current system context (existing repo)

Blip already has:

- Supabase client in `src/lib/supabase.ts` (Vite env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Jobs table (`public.jobs`) with fields like `job_title`, `company`, `location`, `job_description`, `job_url`, `keywords`, and `match_score`.
- Firecrawl scraping support in the app, plus a shared scrape cache table (`public.scraped_jobs`) to reduce repeat Firecrawl calls.
- Resume file storage bucket: `storage.buckets('resumes')` with per-user folder policies.
- User profile data in `public.user_profiles` (includes `resume_links` JSON for now).
- Resume matching foundations in Supabase:
  - `public.resume_versions`
  - `public.resume_version_embeddings`
  - `public.job_embeddings`
  - `public.match_resumes(...)`
  - `match-resume` Edge Function

This extension should reuse these foundations rather than inventing parallel storage or matching logic.

## 3.1) Repo structure (Turborepo)

Blip is a monorepo:

- `apps/web`: the Blip web app (Vite + React) deployed to Vercel
- `apps/extension`: the Chrome extension (Manifest V3) distributed via the Chrome Web Store
- `packages/shared`: shared TypeScript utilities/types used by both
- `supabase`: database migrations + Edge Functions used by both web + extension

## 4) Core extension features

### A) Context menu actions (right-click)

When the user highlights text on a page, register:

1. `Add to Blip`
- Input: `selectionText` (required), `pageUrl`, plus best-effort `job_title`, `company`, `location` from DOM.
- Role link behavior:
  - Always capture the URL of the page the user is currently viewing as `job_url`.
  - Allow an optional canonical `role_url` for the actual posting URL when the current page is only provenance (especially LinkedIn).
- Action: create a Job in `public.jobs` for the signed-in user.
- Output: toast/notification with "Saved" and a deep link to the Job in the web app.

2. `Compare with Blip`
- Input: same payload as `Add to Blip`.
- Action:
  - create or update a Job
  - run the shared resume match service
  - show ranked results in the side panel
- Result size: show the top 5 resume versions with scores and reasons.

### B) Side panel (primary UI)

- Header: signed-in user + Supabase connection status.
- Extraction preview: show what the extension captured (title/company/location + the selected JD text).
- Match results: ranked list of resume versions with a match score and top reasons.
- Gap analysis: "Missing keywords / skills" found in the JD but not in the selected resume.

### C) Options page

- Auth: login/logout (Supabase).
  - The extension cannot directly reuse the web app session; it maintains its own Supabase session stored in extension storage.
- Extraction settings:
  - "Selection required for Add/Compare" (default ON).
  - "Allow Firecrawl fallback" (default OFF).
  - Optional site rules for overrides per domain.

## 5) Selection-first extraction spec (avoid Firecrawl)

### A) User flow

1. User highlights the main job description.
2. User right-clicks `Add to Blip` or `Compare with Blip`.
3. Extension uses:
   - JD: the highlighted text (primary)
   - Title: extracted from DOM if possible (fallback: `document.title`)
   - Company + Location: extracted from DOM if possible (fallback: empty; user can edit later in app)

### B) Minimum viable payload

- `job_url`: `location.href` for the page the user is on
- `role_url`: defaults to `job_url`, but may be overridden with the actual posting URL
- `job_description`: highlighted text (normalized whitespace)
- `job_title`: best-effort
- `company`: best-effort
- `location`: best-effort
- `raw_capture`: optional JSON blob with extraction hints (selector used, page title, timestamps, source page metadata)

### C) DOM extraction rules

Simple strategy:

1. Known selectors by site (expandable):
- Apple Jobs: `#jobdetails-postingtitle` for title
- Indeed: `#jobDescriptionText`
- LinkedIn: `.jobs-description-content__text`

2. Generic fallbacks:
- Title: `h1`, then `document.title`
- Company/location: look for common labels near the header area, then improve with site-specific adapters over time

### D) Firecrawl fallback

Only if:

- user has enabled "Allow Firecrawl fallback", and
- selection is missing/too small, or title/company/location cannot be determined and user requests auto-fill.

When used:

- First check `public.scraped_jobs` by URL to avoid re-scraping.
- If not cached, call Firecrawl and upsert into `public.scraped_jobs`.

## 6) Resume sync, versioning, and match service (Supabase-backed)

### A) Resume upload (profile page)

In the Blip web app, add a way for the user to upload resumes to Supabase Storage:

- Bucket: `resumes`
- Path convention: `${userId}/${resumeVersionId}/${filename}`
- Metadata stored: filename, uploaded_at, optional label (for example "Hardware v3"), source (manual upload)

`public.user_profiles.resume_links` can remain as a legacy pointer, but the match engine should be driven by a real resume versions table.

### B) Data model

Use:

1. `public.resume_versions`
- `id` (uuid, pk)
- `user_id` (uuid, fk auth.users)
- `label` (text)
- `storage_path` (text)
- `extracted_text` (text)
- `embedding_status` (`pending` | `processing` | `ready` | `error`)
- `embedding_model` (text)
- `created_at`, `updated_at`

2. `public.resume_version_embeddings`
- `resume_version_id` (uuid, pk/fk)
- `model` (text)
- `embedding` (`extensions.vector(384)`)
- `updated_at`

3. `public.job_embeddings`
- `job_id` (uuid, pk/fk)
- `model` (text)
- `embedding` (`extensions.vector(384)`)
- `updated_at`

The embedding model for v1 is `gte-small`, which uses 384 dimensions in this repo.

### C) Vectorization pipeline

When a resume is uploaded or changed:

1. Upload the file to Storage.
2. Create a `resume_versions` row.
3. Trigger `process-resume`.
4. `process-resume` extracts text from the PDF, stores normalized text, generates the `gte-small` embedding, and marks the row `ready`.

When a job is added or compared:

1. Generate or reuse a cached job embedding.
2. Run vector similarity against the user's resume embeddings.
3. Compute a hybrid score and return the top 5.

## 7) Matching algorithm (v1)

Hybrid score per resume version:

- Semantic similarity (70%): cosine similarity between Job embedding and Resume embedding
- Keyword overlap (30%): overlap between extracted JD keywords and resume text

Scoring sketch:

```ts
const matchScore = (semanticSim: number, keywordOverlap: number) =>
  semanticSim * 0.7 + keywordOverlap * 0.3;
```

Output per resume:

- total score (0-100)
- top matched terms / concepts
- missing keywords list

## 8) "Match Resume" in the main Blip web app

The match service is not extension-only. The same logic must be triggerable from the web app so users can re-score any job at any time, including jobs added manually or via Firecrawl.

### A) Button placements

1. `JobCard`
- Add a Match button in the hover action row near the copy button.
- Show a spinner while the service runs.
- On success, update the visible `MatchScoreBadge`.

2. `JobDetailModal`
- Add a prominent `Match Resume` button in the header/action area.
- On click, run the match service and show a ranked top-5 panel inside the modal.
- Persist the best score back to `jobs.match_score` so the badge updates everywhere.

### B) Match service

Implemented as the `match-resume` Supabase Edge Function.

Input:

```ts
{
  job_id: string;
}
```

Steps:

1. Check `public.job_embeddings` for a cached embedding for this `job_id`. Reuse it when fresh; regenerate when missing or stale.
2. Query `public.resume_version_embeddings` for the user's resume versions with `public.match_resumes(...)`.
3. For each resume version, compute keyword overlap against `resume_versions.extracted_text`.
4. Combine into a hybrid score: `(semanticSim * 0.7) + (keywordOverlap * 0.3)`.
5. Return the top 5, sorted by score descending.
6. Write the winning score back to `jobs.match_score` and update `jobs.match_score_updated_at`.

Output:

```ts
{
  results: [
    {
      resume_version_id: string;
      label: string;
      score: number;
      semantic_sim: number;
      keyword_overlap: number;
      matched_keywords: string[];
      missing_keywords: string[];
    }
  ];
}
```

### C) Score freshness / invalidation

- `jobs.match_score_updated_at` tracks when the displayed score was last computed.
- The web app should show a subtle stale indicator if the score is older than 7 days or if a newer resume version exists.
- The Match button always forces a re-run.

### D) No resumes edge case

If the user has no resume versions uploaded, clicking Match Resume should guide them to upload at least one resume in their profile.

## 9) Resume upload UI (Profile page)

Add a dedicated Resume Versions section to the existing profile experience:

- Upload: drag-and-drop or file picker (PDF only, max 5 MB per file)
- List: all uploaded resume versions with label, upload date, and delete action
- Label: user can rename each version
- Status: `pending` -> `processing` -> `ready` or `error`
- Trigger: on upload, the backend automatically extracts text and generates embeddings

Upload flow:

1. Client uploads file to `storage.resumes / ${userId}/${uuid}/${filename}`.
2. Client inserts a row into `public.resume_versions` with `storage_path`, `label`, and `embedding_status: 'pending'`.
3. Client invokes `process-resume`.
4. `process-resume` downloads the PDF, extracts text, updates `resume_versions.extracted_text`, upserts into `resume_version_embeddings`, and sets `embedding_status`.

## 10) Supabase changes required

The repo should include:

- `CREATE EXTENSION IF NOT EXISTS vector` in a Supabase-compatible migration
- `public.resume_versions`
- `public.resume_version_embeddings`
- `public.job_embeddings`
- `jobs.match_score_updated_at`
- `public.match_resumes(...)`
- follow-up fields needed by the extension:
  - `public.jobs.role_url`
  - optional `public.jobs.raw_capture`

## 11) Success criteria

- Firecrawl reduction: most jobs can be added via selection-first without Firecrawl.
- Latency:
  - `Add to Blip` completes quickly via DOM extraction + one insert
  - `Match Resume` returns top-5 results in about 3 seconds
  - resume processing completes asynchronously after upload
- Quality: the correct resume family ranks first for relevant job descriptions.
- Auth:
  - web app and extension use the same Supabase project and user accounts
  - the extension session is separate and persists inside the extension
- Consistency:
  - the web app and extension call the same matching backend and render the same score shape
