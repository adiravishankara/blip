# Changelog

All notable changes to Blip are documented here.

## [0.2.0] - Unreleased

### Added
- Changelog to track project changes.
- Detailed setup docs in README: Supabase setup (schema.sql or migrations), Firecrawl API key + optional self-hosted URL.
- Optional `VITE_FIRECRAWL_API_URL` env var for self-hosted/local Firecrawl instances.

### Changed
- Kanban board: All cells now have uniform height; long text truncates with ellipsis.
- groupByCompany is now the default Kanban view (jobs grouped by company).
- Profile and Settings consolidated into a single Profile entry in the header.
- Global Reach map now renders an actual world map with location markers using react-simple-maps.
- Profile preferred locations now use city autocomplete for easier data entry.

### Fixed
- Global Reach map no longer appears blank.
- Location input in profile settings now has autocomplete suggestions.
