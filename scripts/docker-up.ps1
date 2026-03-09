# Run Blip full stack: Supabase + Firecrawl + Ollama + Frontend
# Usage: .\scripts\docker-up.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting Supabase..." -ForegroundColor Cyan
npx supabase start
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStarting Docker stack (Firecrawl, Ollama, Frontend)..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nBlip is running:" -ForegroundColor Green
Write-Host "  Frontend:     http://localhost:3000"
Write-Host "  Supabase:     http://127.0.0.1:54321"
Write-Host "  Supabase UI:  http://127.0.0.1:54323"
Write-Host "  Firecrawl:    http://localhost:3002"
Write-Host "  Ollama:       http://localhost:11434"
