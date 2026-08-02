# NIO Radio Navigation, Performance, and Cache Design

## Summary

Repair the mobile web app's nested Back behavior, preserve search and album-directory context, stop playback progress updates from rerendering the full catalog, and add bounded caching that reduces repeat server requests without storing audio files.

The application remains a static React PWA deployed on GitHub Pages. This change does not add a backend, account system, or desktop-specific experience.

## Goals

- Make in-app Back navigation follow the complete route history, including Albums -> Search -> Album -> Search -> Albums.
- Preserve the search query and filtered results after visiting an album.
- Restore the album-directory scroll position after returning from album detail.
- Prevent audio `timeupdate` events from remapping all catalog rows.
- Reduce repeat catalog, episode-list, and artwork requests while keeping data reasonably fresh.
- Keep failures retryable and prevent failed responses from entering caches.
- Deploy the verified change to the existing GitHub Pages site.

## Non-goals

- Offline audio playback or downloaded episodes.
- Persistent episode-page storage in IndexedDB.
- A custom proxy, API server, or user account.
- Desktop-specific navigation or layout changes.
- Replacing the existing visual design.

## Navigation And View State

### Route history

Remove the single `backHash` value. Each navigation entry records an app-owned history depth in `window.history.state`. Internal navigation pushes a new entry, browser Back and Forward consume those entries, and route state is updated from `popstate` and `hashchange` events.

The visible Back control calls browser history when the current entry has an earlier in-app entry. A direct visit to Search or Album without an in-app predecessor uses a deterministic fallback: Search returns Home and Album returns Albums. Queue opening remains its own history entry so Back closes the queue before leaving the screen.

### Search state

Store the search term in the Search hash as `q`, for example `#/search?q=radio`. Input changes replace the current history entry instead of adding one entry per keystroke. The router parses and serializes this value, so Back, Forward, refresh, and album round trips restore the same query.

Queue helpers must retain unrelated query parameters. Opening and closing the queue on Search changes only `queue=1` and must not remove `q`.

### Scroll restoration

Set `history.scrollRestoration` to `manual` while the application is mounted. Before internal navigation, save the current document scroll position by route hash without the queue parameter. After the destination screen renders, restore its saved position; a route with no saved position starts at the top.

Opening the album directory from Home therefore starts at the top, while returning from an album restores the previous directory position. Queue open and close do not reset the underlying screen's scroll.

## Rendering Performance

The catalog object remains stable between catalog refreshes. Wrap the Albums, Search, Album, and shared album-results components with `React.memo`, and pass stable callbacks from `App`. These screens do not consume player progress, so an audio `timeupdate` changes only the player-dependent UI.

Home continues to rerender because it displays playback progress. Album-directory rows use `content-visibility: auto` and a fixed intrinsic row size as a progressive enhancement. Browsers without support retain the existing list behavior.

Full list virtualization is intentionally excluded. Memoization removes the repeated 565-row work during playback, while native document scrolling keeps scroll restoration and accessibility simple.

## Caching

### Static catalog

Include `data/albums.json` in the Workbox precache manifest. Its content revision changes with each deployment, so a new service worker installs the updated catalog while repeat visits use the local response. Remove the `no-store` fetch option so normal browser caching also works when a service worker is unavailable.

Keep the existing localStorage catalog as an offline and network-failure fallback. A successful catalog load replaces that fallback. A failed refresh with a valid cached catalog shows cached data and the existing stale notice; a first load with no valid cache keeps the full-page retry state.

### Episode pages

Add a module-local memory cache around `getEpisodes`. The key contains album ID, page number, and page size. A successful result remains valid for 10 minutes.

If an identical request is already running, subsequent callers receive the same promise rather than sending another POST. Rejected requests are removed immediately and are never cached. The cache is intentionally cleared by page reload, which limits stale data and memory use without adding persistent storage complexity.

### Artwork

Use a Workbox `CacheFirst` runtime route for image requests. Accept same-origin and opaque cross-origin image responses, retain at most 150 entries, and expire entries after 30 days. This cache covers album artwork but does not match audio requests.

### Audio

Do not add a service-worker route for audio. Audio files are large and may require Range requests; persistent caching could consume substantial phone storage and interfere with seeking. The CDN and browser remain responsible for ordinary HTTP caching.

## Error And Update Behavior

- Catalog network failure uses valid local data when available and exposes manual refresh.
- Episode API timeout, offline, HTTP, and invalid-response errors retain the current inline retry behavior.
- Episode request failures do not consume the 10-minute TTL, so Retry performs a new network request.
- Catalog and service-worker updates do not interrupt current audio playback.
- Corrupt localStorage data is ignored, matching current behavior.

## Testing

Follow test-driven development and verify each regression test fails for the original defect before implementing the fix.

Automated coverage must include:

- Albums -> Search -> Album -> Back -> Search -> Back -> Albums.
- Search query persistence through album navigation, Back, and refresh parsing.
- Queue query changes preserving the Search `q` parameter.
- Album-directory scroll restoration and first-entry top reset.
- Catalog screens not rerendering on audio `timeupdate`.
- Concurrent identical episode requests sharing one fetch.
- Episode cache hits before 10 minutes and refresh after expiry.
- Failed episode requests not being cached.
- PWA catalog precache, bounded artwork cache, and absence of audio runtime caching.

Run the full Vitest suite, lint, production build, dependency audit, and `git diff --check`. Browser verification covers 320x568 and 390x844 viewports, nested Back navigation, restored scroll, repeated album visits, playback progress, service-worker registration, and browser console errors.

## Deployment

After all checks pass:

1. Commit the source and test changes on `main`.
2. Push `main` to GitHub.
3. Run the existing `npm run deploy` command.
4. Verify the live GitHub Pages application, catalog, service worker, album request, artwork caching, navigation, and playback.

## Acceptance Criteria

- Nested Back controls never become stuck on the same hash.
- Returning from album detail restores both Search query state and album-directory scroll state.
- Audio progress events do not rerender the full album directory.
- Reopening the same episode page within 10 minutes sends no additional API request.
- Simultaneous identical episode requests send exactly one API request.
- Repeat visits load the versioned static catalog and previously viewed artwork from local caches where available.
- Audio is never stored by the service worker.
- Failed responses remain retryable and do not poison caches.
- Tests, lint, build, audit, mobile browser checks, deployment, and live smoke checks pass.
