[CmdletBinding()]
param(
  [string] $Url,

  # Your ngrok-hosted Firecrawl base URL (no trailing slash preferred)
  [string] $FirecrawlBaseUrl = "https://eb6d-61-64-25-61.ngrok-free.app",

  # Optional: If your Firecrawl instance requires an API key, pass it here (will be sent as: Authorization: Bearer <key>)
  [string] $ApiKey = "",

  # Optional: If your instance exposes a different endpoint path (defaults to Firecrawl v2)
  [string] $ScrapePath = "/v2/scrape",

  # Optional: Write raw response to disk for inspection
  [string] $OutFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $Url -or $Url.Trim().Length -eq 0) {
  Write-Host "Usage:"
  Write-Host "  .\test\firecrawl-scrape.ps1 -Url `"https://example.com`""
  Write-Host ""
  Write-Host "Optional:"
  Write-Host "  -ApiKey <key>          # sent as Authorization: Bearer <key>"
  Write-Host "  -FirecrawlBaseUrl <url> # default: $FirecrawlBaseUrl"
  Write-Host "  -ScrapePath </v2/scrape> # default: $ScrapePath"
  Write-Host "  -OutFile <path>        # save full response JSON"
  exit 1
}

function Clean-JobUrl([string] $InputUrl) {
  try {
    return ($InputUrl -split "\?")[0]
  } catch {
    return $InputUrl
  }
}

$cleanedUrl = Clean-JobUrl $Url
$endpoint = ($FirecrawlBaseUrl.TrimEnd("/") + $ScrapePath)

$schema = @{
  type       = "object"
  required   = @("job_title", "company_name", "description")
  properties = @{
    job_title    = @{ type = "string" }
    company_name = @{ type = "string" }
    team_name    = @{ type = "string" }
    location     = @{ type = "string" }
    compensation = @{ type = "string" }
    description  = @{
      type        = "string"
      description = "The full, exhaustive job description. DO NOT summarize. Include the role overview, responsibilities, requirements, qualifications, and benefits sections exactly as they appear."
    }
  }
}

$body = @{
  url             = $cleanedUrl
  onlyMainContent = $false
  maxAge          = 172800000
  formats         = @(
    @{
      type   = "json"
      schema = $schema
      prompt = "Extract the full job posting details. You must include the ENTIRE job description, including responsibilities, requirements, qualifications, and any provided pay/benefits information. DO NOT summarize or truncate any part of the job description."
    }
  )
} | ConvertTo-Json -Depth 20

$headers = @{
  "Content-Type" = "application/json"
}
if ($ApiKey -and $ApiKey.Trim().Length -gt 0) {
  $headers["Authorization"] = "Bearer $ApiKey"
}

Write-Host "POST $endpoint"
Write-Host "Target URL: $cleanedUrl"

try {
  $raw = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $body -TimeoutSec 120
} catch {
  # Surface response body when possible (common with Firecrawl errors)
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $respBody = $reader.ReadToEnd()
    throw "Request failed: $($_.Exception.Message)`nResponse body:`n$respBody"
  }
  throw
}

if ($OutFile -and $OutFile.Trim().Length -gt 0) {
  $raw | ConvertTo-Json -Depth 50 | Set-Content -Encoding UTF8 -Path $OutFile
  Write-Host "Saved raw response to: $OutFile"
}

# Normalize to the shape your app expects:
# Firecrawl v2 return format: { success: true, data: { json: { ... } } }
$extracted = $null
if ($raw -and $raw.data -and $raw.data.json) {
  $extracted = $raw.data.json
}

if (-not $extracted) {
  Write-Host "Raw response (no data.json found):"
  $raw | ConvertTo-Json -Depth 50
  exit 2
}

Write-Host ""
Write-Host "Extracted JSON (data.json):"
$extracted | ConvertTo-Json -Depth 50

