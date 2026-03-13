# Firecrawl test scripts

## `firecrawl-scrape.ps1`

Calls your ngrok-hosted Firecrawl instance and prints the extracted `data.json` payload in the same shape expected by `src/services/scraper.ts`.

### Examples

Basic (no API key):

```powershell
.\test\firecrawl-scrape.ps1 -Url "https://example.com"
```

With API key:

```powershell
.\test\firecrawl-scrape.ps1 -Url "https://example.com" -ApiKey "fc-YOUR-API-KEY"
```

Save raw response:

```powershell
.\test\firecrawl-scrape.ps1 -Url "https://example.com" -OutFile ".\test\firecrawl-raw.json"
```

If your self-hosted instance uses a different path:

```powershell
.\test\firecrawl-scrape.ps1 -Url "https://example.com" -ScrapePath "/v1/scrape"
```

