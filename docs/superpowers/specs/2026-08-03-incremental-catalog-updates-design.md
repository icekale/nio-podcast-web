# Incremental Podcast Catalog Updates Design

**Date:** 2026-08-03

**Goal:** Refresh the NIO Radio catalog frequently during the day without rescanning all album IDs on every scheduled deployment.

## Architecture

The repository remains the catalog state store and GitHub Actions remains the scheduler and publisher; no backend service is introduced. The catalog generator has two modes: a full discovery scan over album IDs `1..2000`, and an incremental scan over the album IDs already present in `public/data/albums.json`. Weekday 07:30 Beijing time runs full discovery; the other configured weekday times and weekend 12:00/18:00 runs use the incremental mode.

The generated JSON is committed back to `main` only when episode or album data changes. The workflow then builds and publishes the PWA to `gh-pages`; unchanged runs stop before build and deployment. A workflow concurrency group prevents overlapping scans and deployments.

## Catalog Update Flow

1. Read the tracked `public/data/albums.json` as the previous catalog.
2. Full mode scans all configured IDs and produces the source-of-truth album set.
3. Incremental mode requests page 1 for each known album, compares the latest episode fields, and merges successful updates into the previous catalog.
4. A failed incremental request keeps the previous album record. A missing/empty response is not treated as deletion during incremental mode; full discovery remains responsible for reconciliation.
5. Compare album content without `generatedAt`. Preserve the previous file when content is unchanged; update `generatedAt` only for a real content change.
6. Commit the changed catalog with a bot identity and publish the matching build.

The current upstream API does not expose a global “changed since timestamp” endpoint, so the smallest reliable incremental unit is one page-1 request per known album. With roughly 565 known albums, this is substantially smaller than the current 2000-ID scan and still detects the newest episode for every known album.

## Client Freshness

`data/albums.json` is removed from the Workbox precache and served through a `NetworkFirst` runtime route with a bounded one-entry cache. `loadCatalog` requests the network copy and falls back through Service Worker cache, then the existing `localStorage` catalog cache. The app revalidates once when returning to the foreground after a short cooldown, so an already-open PWA can pick up a newly deployed catalog without a full reload. Existing artwork caching and the no-audio-cache boundary remain unchanged.

## Scheduled Workflow

The workflow supports both `schedule` and `workflow_dispatch`. It grants `contents: write`, checks out `main`, installs dependencies with `npm ci`, runs the selected catalog mode, and exits without a commit or deployment when `public/data/albums.json` is unchanged. The schedule uses UTC cron expressions for the agreed Beijing times. Weekend schedules run only the two incremental checks at 12:00 and 18:00 Beijing time.

## Failure Handling

- A full scan that finds no albums fails without replacing the existing catalog.
- Incremental request errors are logged and leave the prior album data intact.
- A failed build or deploy leaves the prior GitHub Pages version available.
- Workflow concurrency prevents a slow scan from racing a newer scan.
- Local and Service Worker caches remain available when the catalog endpoint is temporarily unreachable.

## Testing

- Unit-test incremental merging, sorting, changed-field detection, and preservation of records whose requests fail.
- Unit-test that unchanged catalogs preserve their serialized state and `generatedAt`.
- Update PWA configuration tests for the NetworkFirst catalog route and the existing image cache/no-audio-cache boundaries.
- Add an app test for foreground catalog revalidation with a cooldown and stale fallback behavior.
- Run the complete Vitest suite, lint, production build, and a dry-run workflow inspection before deployment.

## Scope Boundaries

This change does not introduce a server, change the NIO upstream API, or cache audio. The install prompt remains a separate UI feature and is not coupled to catalog generation.
