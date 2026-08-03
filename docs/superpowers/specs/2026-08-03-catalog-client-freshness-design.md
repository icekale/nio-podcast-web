# Catalog Client Freshness Design

**Date:** 2026-08-03

**Goal:** Keep the home and all-albums catalog summaries aligned with newly published episodes within five minutes while an installed PWA remains open, without interrupting playback or repeatedly transferring the full catalog when it has not changed.

## Root Cause

The static catalog and a fresh browser session already contain the newest episode title. The mismatch occurs only in a long-lived app session: the home and all-albums screens keep the catalog loaded into React state, while an album detail screen requests current episode data separately. The app currently refreshes the catalog only at startup or when it returns to the foreground after a 15-minute cooldown, so the two views can temporarily show different versions.

## Refresh Controller

Keep catalog loading centralized in `App`. Add a five-minute freshness window and one shared in-flight request reference so all automatic and manual triggers reuse the same request.

Automatic refresh is eligible when the current catalog request is at least five minutes old and one of these events occurs:

1. A visible-page five-minute timer fires.
2. The document returns to the foreground.
3. Navigation enters the home or all-albums screen.

The timer does not request data while the document is hidden. Initial loading still runs immediately. Manual retry bypasses the freshness window but reuses any request already in progress. These rules cap normal foreground checks at one per five minutes and prevent the timer, visibility, and route effects from issuing duplicate requests together.

## Cache And Data Flow

Change the catalog fetch cache mode from `no-store` to `no-cache`. GitHub Pages supplies an `ETag`, so unchanged checks can be conditionally revalidated instead of transferring the approximately 543 KB JSON body every time. Workbox remains `NetworkFirst` with its single cached catalog entry, and `localStorage` remains the final offline fallback.

When a refresh returns a newer catalog, replace the catalog state atomically. The existing selectors then update both the home episode list and each all-albums subtitle from the same snapshot. No player, queue, route, or visual state is reset.

## User Experience And Failure Handling

Automatic refreshes are non-blocking: the current list remains visible, playback continues, and no full-page loading state appears. If a request fails, the current catalog stays available and the existing stale/error notice can offer a manual retry. Initial loading behavior and offline fallback remain unchanged.

This change adds no controls, animations, backend service, or catalog generation changes.

## Testing

Use test-driven development for the behavioral change:

- Reproduce a long-lived session whose initial catalog has an old episode title, then advance five minutes and verify that the new catalog replaces it without a reload.
- Verify that navigation to all albums triggers an eligible refresh and renders the new subtitle.
- Verify that overlapping timer, visibility, and route triggers share one request.
- Verify that hidden documents do not poll and that returning to the foreground refreshes when due.
- Verify that `loadCatalog` uses conditional revalidation and preserves the existing timeout and cache fallback behavior.
- Run the focused tests, full test suite, lint, production build, and live mobile-width verification before deployment.

## Success Criteria

- Home and all-albums summaries update within five minutes of the catalog becoming available to the client.
- An eligible route or foreground transition refreshes immediately rather than waiting for the next timer tick.
- No more than one automatic catalog request starts within a five-minute window.
- Unchanged checks avoid retransferring the full catalog when HTTP conditional caching is available.
- Playback, navigation, offline fallback, and both GitHub Pages URLs continue to work.
