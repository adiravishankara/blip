# Blip

**The Ultimate Job Application Tracker & Automation Engine**

Blip is a high-performance, Jira-inspired job hunting dashboard designed to take the friction out of the "applying" phase. Stop juggling spreadsheets and start managing your career search like a pro.

---

## Preview

| Dashboard | Job Details | Kanban Board |
| :---: | :---: | :---: |
| ![Dashboard](public/assets/dashboard.png) | ![Job Detail](public/assets/job.png) | ![Kanban Board](public/assets/kanban.png) |

---

## Features

- **Smart Scraping Engine**: Powered by Firecrawl. Paste a job URL and watch Blip extract the title, company, description, and salary details automatically.
- **Jira-Style Kanban Board**: Drag-and-drop your applications through stages. From "Backlog" to "Offer", keep your pipeline organized.
- **Real-time Analytics**: A dedicated dashboard featuring success rate donuts, application timelines, and role distribution charts.
- **Background Processing**: A dedicated worker handles scraping jobs concurrently, ensuring your UI stays snappy.
- **Profile Management**: Store your resume links, cover letters, and career preferences in one secure place.
- **Global Reach**: integrated city/country lookups for accurate job location tracking.

---

## Tech Stack

- **Core**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend/Auth**: [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Data Viz**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- A [Supabase](https://supabase.com/) account
- A [Firecrawl](https://firecrawl.dev/) API Key

### 2. Installation
```bash
git clone https://github.com/adiravishankara/blip.git
cd blip
npm install
```

### 3. Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com/).
2. In **Project Settings → API**, copy your project URL and `anon` public key.
3. **Set up the database schema** using one of the options below:

   **Option A: Single schema file (recommended for new projects)**  
   Open the Supabase Dashboard → **SQL Editor**, paste the contents of `schema.sql`, and run it. This creates all tables, RLS policies, and functions in one go.

   **Option B: Migrations (if schema.sql fails or for incremental setup)**  
   Run migrations in chronological order via the SQL Editor, or use the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Or manually run each file in `supabase/migrations/` in order (oldest first).

### 4. Firecrawl Setup

1. Sign up at [firecrawl.dev](https://firecrawl.dev/) and obtain an API key.
2. **Using Firecrawl Cloud:** No extra config. Set `VITE_FIRECRAWL_API_KEY` in your env.
3. **Using self-hosted/local Firecrawl:** Also set `VITE_FIRECRAWL_API_URL` to your API base URL (e.g. `http://localhost:3002/v2/scrape`).

### 5. Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_FIRECRAWL_API_KEY=your_firecrawl_api_key
# Optional: For self-hosted Firecrawl only
# VITE_FIRECRAWL_API_URL=http://localhost:3002/v2/scrape
```

### 6. Run the App

1. Create an account in the app (or use your preferred auth provider).
2. Start the dev server:

```bash
npm run dev
```

---

## Project Structure

- `/src/components`: UI components (Modals, Kanban, Dashboard)
- `/src/hooks`: Custom React hooks for business logic
- `/src/lib`: Supabase client configuration
- `/schema.sql`: Full schema for one-shot setup
- `/supabase/migrations`: Database schema history (alternative to schema.sql)
- `/src/components/ScrapingWorker.tsx`: The logic for background job processing

---

## License
MIT

Built with ❤️ by [Adi](https://github.com/adiravishankara)
