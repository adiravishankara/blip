# Firecrawl evaluation script - runs scrape and outputs in ScrapedJobData structure
# Usage: .\scripts\firecrawl-eval.ps1 [payload-file]

param(
    [string]$PayloadPath = "firecrawl-markdown-payload.json",
    [string]$ApiUrl = "http://localhost:3002/v2/scrape"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$blipRoot = Split-Path -Parent $scriptDir
$payloadFile = Join-Path $blipRoot $PayloadPath

if (-not (Test-Path $payloadFile)) {
    Write-Error "Payload file not found: $payloadFile"
}

$body = Get-Content $payloadFile -Raw
$response = Invoke-WebRequest -Uri $ApiUrl -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
$result = $response.Content | ConvertFrom-Json

if (-not $result.success) {
    Write-Error "Firecrawl request failed"
}

$data = $result.data

# ScrapedJobData structure (from scraper.ts)
$job = @{
    job_title    = ""
    company_name = ""
    location     = ""
    compensation = ""
    team_name    = ""
    description  = ""
}

# Use JSON extraction if available (LLM ran)
if ($data.json) {
    $job.job_title    = if ($data.json.job_title) { $data.json.job_title } else { "" }
    $job.company_name = if ($data.json.company_name) { $data.json.company_name } else { "" }
    $job.location     = if ($data.json.location) { $data.json.location } else { "" }
    $job.compensation = if ($data.json.compensation) { $data.json.compensation } else { "" }
    $job.team_name    = if ($data.json.team_name) { $data.json.team_name } else { "" }
    $job.description  = if ($data.json.description) { $data.json.description } else { "" }
    Write-Host "`n--- ScrapedJobData (from JSON extraction) ---`n" -ForegroundColor Cyan
} else {
    # Fallback: parse from metadata + markdown
    $meta = $data.metadata
    $md = if ($data.markdown) { $data.markdown } else { "" }
    
    $job.job_title    = if ($meta.ogTitle) { $meta.ogTitle } else { ($meta.title -replace " at .*$", "") }
    $job.company_name = if ($meta.title -match " at (.+)$") { $Matches[1] } else { "" }
    $job.location     = if ($meta.ogDescription) { $meta.ogDescription } else { "" }
    
    # Extract compensation from markdown
    if ($md -match '\$[\d,]+[-\s]*\$?[\d,]+') {
        $job.compensation = ($Matches[0] -replace "`n", " ").Trim()
    }
    if ($md -match '(?s)Region 1.*?\$[\d,]+[-\s]*\$?[\d,]+.*?Region 2.*?\$[\d,]+[-\s]*\$?[\d,]+') {
        $job.compensation = ($Matches[0] -replace "`n", " " -replace "\s+", " ").Trim()
    }
    
    $job.description  = $md
    Write-Host "`n--- ScrapedJobData (parsed from markdown/metadata - no LLM json) ---`n" -ForegroundColor Yellow
}

# Output in ScrapedJobData structure
Write-Host "job_title:    " -NoNewline; Write-Host $job.job_title
Write-Host "company_name: " -NoNewline; Write-Host $job.company_name
Write-Host "location:     " -NoNewline; Write-Host $job.location
Write-Host "compensation: " -NoNewline; Write-Host $job.compensation
Write-Host "team_name:    " -NoNewline; Write-Host $job.team_name
Write-Host "description:  " -NoNewline
if ($job.description.Length -gt 300) {
    Write-Host $job.description.Substring(0, 300) + "..."
} else {
    Write-Host $job.description
}
Write-Host "`n--- Full description length: $($job.description.Length) chars ---`n"

# Write full ScrapedJobData to file for easy viewing
$outFile = Join-Path $blipRoot "firecrawl-eval-output.json"
@{
    job_title    = $job.job_title
    company_name = $job.company_name
    location     = $job.location
    compensation = $job.compensation
    team_name    = $job.team_name
    description  = $job.description
} | ConvertTo-Json -Depth 1 | Set-Content $outFile -Encoding UTF8
Write-Host "Full ScrapedJobData written to: $outFile" -ForegroundColor Green
