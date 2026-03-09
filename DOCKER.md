# Blip Docker Setup

Run Supabase, Firecrawl, Ollama (Llama), and the Blip frontend together.

## Prerequisites

- **Docker** and **Docker Compose**
- **Firecrawl repo** cloned as a sibling of `blip`:
  ```text
  REPOSITORIES/
  ├── blip/           # this project
  └── firecrawl/      # git clone https://github.com/mendableai/firecrawl
  ```

## Quick Start

### 1. Start Supabase (database + auth)

From the `blip` directory:

```bash
npx supabase start
```

Note the output: API URL (e.g. `http://127.0.0.1:54321`), anon key, etc.

### 2. Configure environment

```bash
cp .env.docker.example .env
```

Edit `.env` and set:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `supabase status`
- Optionally `OLLAMA_MODEL_NAME` and `OLLAMA_EMBEDDING_MODEL` for Firecrawl AI

### 3. Start the stack

```bash
docker compose up -d
```

Or use the convenience script (Windows PowerShell):

```powershell
.\scripts\docker-up.ps1
```

First run will build Firecrawl and the frontend (may take 10+ minutes).

### 4. Apply migrations

```bash
npx supabase db push
# or, if migrations are already applied: npx supabase db reset
```

### 5. Open the app

- **Frontend**: http://localhost:3000
- **Supabase Studio**: http://127.0.0.1:54323
- **Firecrawl** (API): http://localhost:3002
- **Ollama**: http://localhost:11434

## Optional: Pull an Ollama model

To use Firecrawl’s AI extraction with Ollama:

```bash
docker compose exec ollama ollama pull gemma3:1b
```

Then set in `.env`:

```
OLLAMA_MODEL_NAME=gemma3:1b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

Restart Firecrawl:

```bash
docker compose restart firecrawl-api
```

## Troubleshooting

- **"Cannot find firecrawl"**: Ensure `firecrawl` is cloned next to `blip` at `../firecrawl`.
- **Supabase connection errors**: Run `npx supabase start` before `docker compose up`.
- **Firecrawl build fails**: Check RAM (≥8 GB recommended) and disk space.
