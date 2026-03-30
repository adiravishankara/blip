PRD: Blip Chrome Extension (Selection-First) + Resume Match Service

## 1) Goal

Build a Chrome extension that can create a Job in Blip with minimal scraping cost by using **what’s already on-screen** (DOM + user-highlighted text) and only falling back to Firecrawl when needed. Then compare that Job Description against the user’s **versioned resumes stored in Supabase**.

## 2) Product principles

- **Selection-first**: if the user highlights the job description and right-clicks, that selection is the primary source of truth.
- **DOM before Firecrawl**: try cheap extraction (document title + common selectors + page metadata) first; Firecrawl is a last resort.
- **One account**: authentication and data live in Supabase (same user as the Blip web app).
- **Fast feedback**: “Add Job” should feel instant; “Compare” should return results quickly and explain why.

## 3) Current system context (existing repo)

Blip already has:

- **Supabase client** in `src/lib/supabase.ts` (Vite env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Jobs table** (`public.jobs`) with fields like `job_title`, `company`, `location`, `job_description`, `job_url`, `keywords`, `match_score`.
- **Firecrawl scraping** support in the app, plus a shared **scrape cache** table (`public.scraped_jobs`) to reduce repeat Firecrawl calls.
- **Resume file storage bucket**: `storage.buckets('resumes')` with per-user folder policies.
- **User profile** data in `public.user_profiles` (includes `resume_links` JSON for now).

This extension should reuse these foundations rather than inventing parallel storage.

## 4) Core extension features

### A) Context menu actions (right-click)

When the user highlights text on a page, register:

1) **Add to Blip**
- **Input**: `selectionText` (required), `pageUrl`, plus best-effort `job_title`, `company`, `location` from DOM.
- **Role link**:
  - Always capture the URL of the page the user is currently viewing (`pageUrl`).
  - If the current page is a LinkedIn URL, allow the user to provide an **“actual role URL”** (the direct job posting link) and store that alongside the LinkedIn URL for canonical tracking.
- **Action**: create a Job in `public.jobs` for the signed-in user.
- **Output**: toast/notification with “Saved” and a deep link to the Job in the web app.

2) **Compare with Blip**
- **Input**: same payload as “Add to Blip”.
- **Action**: (a) create/update a Job, (b) run match against the user’s resume versions, (c) show ranked results in the side panel.
- **Result size**: show the **top 5** resume versions with scores + reasons.

### B) Side panel (primary UI)

- **Header**: signed-in user + Supabase connection status.
- **Extraction preview**: show what the extension captured (title/company/location + the selected JD text).
- **Match results**: ranked list of resume versions with a match score and top reasons.
- **Gap analysis**: “Missing keywords / skills” found in JD but not in the selected resume.

### C) Options page

- **Auth**: login/logout (Supabase).
- **Extraction settings**:
  - “Selection required for Add/Compare” (default ON).
  - “Allow Firecrawl fallback” (default OFF).
  - (Optional) “Site rules” for overrides per domain.

## 5) Selection-first extraction spec (avoid Firecrawl)

### A) User flow (the “easy mode” you described)

1. User highlights the main job description (they can grab exactly the body they want).
2. User right-clicks → “Add to Blip” or “Compare with Blip”.
3. Extension uses:
   - **JD**: the highlighted text (primary).
   - **Title**: extracted from DOM if possible (fallback: `document.title`).
   - **Company + Location**: extracted from DOM if possible (fallback: empty; user can edit later in app).

### B) What we extract (minimum viable payload)

- **job_url**: `location.href`
- **role_url** (canonical): defaults to `job_url`, but if user supplies an “actual role URL” (common for LinkedIn), store that as the canonical role URL and keep the current page URL as provenance.
- **job_description**: highlighted text (normalized whitespace)
- **job_title**: best-effort
- **company**: best-effort
- **location**: best-effort
- **raw_capture** (optional): small JSON blob of extraction hints (selector used, page title, timestamps)

### C) DOM extraction rules (cheap heuristics)

We should implement a simple strategy:

1) **Known selectors by site** (examples; expandable):
- Apple Jobs: `#jobdetails-postingtitle` for title
- Indeed: `#jobDescriptionText`
- LinkedIn: `.jobs-description-content__text`

2) **Generic fallbacks**:
- Title: `h1` → `document.title`
- Company/location: look for common labels near the header area (site-specific adapters over time)

### D) Firecrawl fallback (explicit, limited)

Only if:
- user has enabled “Allow Firecrawl fallback”, and
- selection is missing/too small, or title/company/location cannot be determined and user requests auto-fill.

When used:
- First check `public.scraped_jobs` by URL to avoid re-scraping.
- If not cached, call Firecrawl and upsert into `public.scraped_jobs`.

## 6) Resume sync, versioning, and match service (Supabase-backed)

### A) Resume upload (profile page)

In the Blip web app, add a way for the user to upload resumes to Supabase Storage:

- **Bucket**: `resumes` (already exists)
- **Path convention**: `${userId}/${resumeVersionId}/${filename}`
- **Metadata stored**: filename, uploaded_at, optional label (e.g. “Hardware v3”), source (manual upload)

`public.user_profiles.resume_links` can remain as a legacy pointer, but the match engine should be driven by a real resume versions table.

### B) Data model (new tables to support matching)

Create:

1) `public.resume_versions`
- `id` (uuid, pk)
- `user_id` (uuid, fk auth.users)
- `label` (text) — “Hardware Engineer”, “TPM”, etc.
- `storage_path` (text) — where the file lives in `resumes` bucket
- `extracted_text` (text) — normalized text used for embeddings/matching
- `created_at`, `updated_at`

2) `public.resume_version_embeddings`
- `resume_version_id` (uuid, pk/fk)
- `model` (text)
- `embedding` (vector)  (via pgvector)
- `updated_at`

3) (Optional) `public.job_embeddings`
- `job_id` (uuid, pk/fk)
- `model` (text)
- `embedding` (vector)
- `updated_at`

### C) Vectorization pipeline

When a resume is uploaded or changed:

1. **Extract text** from the resume file (PDF/DOCX) into `resume_versions.extracted_text`.
2. Generate embeddings for `extracted_text` and upsert into `resume_version_embeddings`.

When a job is added/compared:

1. Generate embeddings for the selected job description (or re-use cached job embedding).
2. Perform similarity search against the user’s resume embeddings.

This should be implemented as a backend service (Supabase Edge Function or the existing server layer) so secrets and model calls do not live in the extension.

## 7) Matching algorithm (v1)

We compute a hybrid score per resume version:

- **Semantic similarity (70%)**: cosine similarity between Job embedding and Resume embedding.
- **Keyword overlap (30%)**: overlap between extracted JD keywords and resume text.

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

The match service is not extension-only. The same logic should be triggerable from the web app so users can re-score any job at any time, even ones added via Firecrawl or manually.

### A) Button placements

1. **JobCard** (hover state, bottom-right action row)
   - Add a "Match" button (lightning bolt icon) next to the existing "Copy prompt" button.
   - Shows as a spinner while the service runs.
   - On success, immediately updates the `MatchScoreBadge` in-place.

2. **JobDetailModal** (action toolbar)
   - Add a "Match Resume" button (prominent, e.g. alongside the existing `Bolt` icon area).
   - On click, runs the match service and shows a ranked top-5 panel inside the modal.
   - Persists the best score back to `jobs.match_score` so the badge is live everywhere.

### B) Match service (what runs when the button is clicked)

Triggered by the web app or extension. Implemented as a **Supabase Edge Function** (`match-resume`):

**Input:**
```ts
{
  job_id: string;       // reference to public.jobs row
  user_id: string;      // inferred from auth token
  job_description: string; // from jobs.job_description
}
```

**Steps:**
1. Check `public.job_embeddings` for a cached embedding for this `job_id`. If missing or stale, call the embedding model and upsert.
2. Query `public.resume_version_embeddings` for all resume versions belonging to `user_id`. Compute cosine similarity against the job embedding using `pgvector` (`<=>` operator).
3. For each resume version, also compute keyword overlap against `resume_versions.extracted_text`.
4. Combine into a hybrid score: `(semanticSim * 0.7) + (keywordOverlap * 0.3)`.
5. Return the top 5, sorted by score descending.
6. Write the winning score back to `jobs.match_score` so `MatchScoreBadge` is updated automatically.

**Output:**
```ts
{
  results: [
    {
      resume_version_id: string;
      label: string;
      score: number;          // 0–100
      semantic_sim: number;
      keyword_overlap: number;
      matched_keywords: string[];
      missing_keywords: string[];
    }
  ]
}
```

### C) Score freshness / invalidation

- `jobs.match_score` should have a `match_score_updated_at` timestamp column.
- In the web app, display a subtle "stale" indicator if the score is older than 7 days or if a new resume version has been uploaded since the score was last computed.
- The "Match" button always forces a re-run regardless.

### D) No resumes edge case

If the user has no resume versions uploaded, clicking "Match Resume" should open the profile page's resume upload section with a nudge: "Upload at least one resume to compare."

## 9) Resume upload UI (Profile page)

Add a dedicated **Resume Versions** section to the existing `UserProfileModal` (or a new Profile page):

- **Upload**: drag-and-drop or file picker (PDF only, max 5MB per file).
- **List**: shows all uploaded resume versions with label, upload date, and a delete button.
- **Label**: user can rename each version (e.g., "Hardware Engineer v3", "TPM Lead").
- **Status**: each version shows an embedding status: `pending` → `processing` → `ready` (or `error`).
- **Trigger**: on successful upload, the backend automatically extracts text and generates embeddings.

The upload flow:
1. Client uploads file to `storage.resumes / ${userId}/${uuid}/${filename}`.
2. Client inserts a row into `public.resume_versions` with `storage_path`, `label`, `embedding_status: 'pending'`.
3. A Supabase Edge Function (`process-resume`) is triggered (via Supabase webhook or background queue):
   - Downloads the PDF from storage.
   - Extracts text (e.g., using a PDF-to-text library).
   - Updates `resume_versions.extracted_text`.
   - Generates embedding and upserts into `resume_version_embeddings`.
   - Sets `embedding_status: 'ready'`.

## 10) New Supabase migrations needed

The following DDL changes are required (not yet in the schema):

1. **Enable pgvector**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **`public.resume_versions`**
   ```sql
   CREATE TABLE public.resume_versions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
     label text NOT NULL,
     storage_path text NOT NULL,
     extracted_text text,
     embedding_status text NOT NULL DEFAULT 'pending'
       CHECK (embedding_status IN ('pending', 'processing', 'ready', 'error')),
     created_at timestamptz DEFAULT now() NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   ```

3. **`public.resume_version_embeddings`**
   ```sql
   CREATE TABLE public.resume_version_embeddings (
     resume_version_id uuid PRIMARY KEY REFERENCES public.resume_versions(id) ON DELETE CASCADE,
     model text NOT NULL,
     embedding vector(1536) NOT NULL,  -- adjust dims to match chosen model
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   ```

4. **`public.job_embeddings`**
   ```sql
   CREATE TABLE public.job_embeddings (
     job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
     model text NOT NULL,
     embedding vector(1536) NOT NULL,
     updated_at timestamptz DEFAULT now() NOT NULL
   );
   ```

5. **`jobs.match_score_updated_at`**
   ```sql
   ALTER TABLE public.jobs
     ADD COLUMN IF NOT EXISTS match_score_updated_at timestamptz;
   ```

6. **RPC for similarity search** (called by the edge function)
   ```sql
   CREATE OR REPLACE FUNCTION match_resumes(
     query_embedding vector(1536),
     match_user_id uuid,
     match_count int DEFAULT 5
   )
   RETURNS TABLE (
     resume_version_id uuid,
     label text,
     similarity float
   )
   LANGUAGE sql STABLE AS $$
     SELECT
       rv.id AS resume_version_id,
       rv.label,
       1 - (rve.embedding <=> query_embedding) AS similarity
     FROM public.resume_version_embeddings rve
     JOIN public.resume_versions rv ON rv.id = rve.resume_version_id
     WHERE rv.user_id = match_user_id
       AND rv.embedding_status = 'ready'
     ORDER BY rve.embedding <=> query_embedding
     LIMIT match_count;
   $$;
   ```

## 11) Success criteria

- **Firecrawl reduction**: majority of jobs can be added using selection-first without Firecrawl.
- **Latency**:
  - “Add to Blip” completes quickly (local extraction + Supabase insert).
  - “Compare with Blip” returns ranked resumes within ~3 seconds for typical resume counts.
- **Quality**: correct resume family (e.g., Hardware vs TPM) ranks #1 for relevant JDs.
- **Auth**: user session works across web app + extension (same Supabase auth user).