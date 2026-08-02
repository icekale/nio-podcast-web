# NIO Podcast Mobile Redesign

## Summary

Rebuild the current GitHub Pages podcast client as a mobile-only web/PWA experience based on the supplied NIO Radio references. The product remains a static React application with no account system or application backend.

The redesign replaces runtime album-ID probing with a generated catalog, adds reliable network errors, persists playback locally, introduces the reference-style home screen and queue sheet, repairs navigation and PWA installation, and adds automated regression coverage.

## Goals

- Match the supplied mobile UI hierarchy: recommendation hero, today's updates, persistent mini player, and queue bottom sheet.
- Keep the full NIO Radio catalog without making each visitor probe album IDs.
- Preserve queue, recently played episodes, current episode, and playback progress on the same device.
- Make network failures visible and retryable.
- Support mobile browser navigation, refresh, installation, safe areas, and offline shell loading.
- Deploy the verified result to the existing GitHub Pages site.

## Non-goals

- User accounts, cloud synchronization, or cross-device playback state.
- A custom application backend.
- Desktop-specific information architecture; desktop renders a centered mobile surface.
- Offline audio downloads. The app shell and catalog may work offline, but audio requires network access.
- Comments, social features, subscriptions, or recommendations based on user profiling.

## Architecture

### Static catalog

Add `scripts/generate-catalog.mjs` to probe the NIO public API outside the browser. It scans known album IDs with bounded concurrency and produces `public/data/albums.json` only after a complete successful run. A failed generation must leave the previous catalog intact.

Each catalog entry contains album metadata and the latest episode needed by the home screen:

```json
{
  "generatedAt": 1785660000000,
  "albums": [
    {
      "id": 5,
      "name": "资讯充电站·早间版",
      "description": "...",
      "imageUrl": "https://...",
      "host": "NIO Radio",
      "episodeCount": 2112,
      "latestEpisode": {
        "id": 196607,
        "title": "...",
        "duration": 373000,
        "onlineTime": 1785513600000,
        "audioUrl": "https://..."
      }
    }
  ]
}
```

Audio URLs are normalized to HTTPS when the same NIO CDN supports HTTPS. Catalog data is sorted by latest episode time. The generated file is checked into the repository so the site can build even if the upstream API is temporarily unavailable.

The deployment build reads the checked-in catalog. Catalog refresh is an explicit script and may later run from a scheduled GitHub Action; it is not part of every visitor session.

### Runtime API

The browser performs only these requests:

- Load `/nio-podcast-web/data/albums.json` once, with local cache fallback.
- Fetch episode pages for a selected album.
- Load the selected audio resource.

Episode requests throw typed errors for timeout, HTTP failure, invalid response, and offline state. Discovery and episode loading no longer convert failures into empty arrays.

### Application state

Use focused React modules rather than a global state library:

- `CatalogContext`: catalog loading, search, today's episodes, catalog error/retry.
- `PlayerContext`: current episode, queue, play/pause, progress, history, and persistence.
- Hash-based routes: home, search, and album detail, compatible with GitHub Pages refreshes.
- Queue sheet state represented in the hash query so browser Back closes the sheet before leaving the current screen.

## Mobile UI

### Home

The home screen follows the approved reference structure:

1. Safe-area-aware top bar with Back, `NIO Radio`, and Search.
2. Pale aqua recommendation hero showing the newest episode's artwork and metadata.
3. Teal `全部播放` button that queues today's episodes and starts the first one.
4. `今日更新（N）` list using up to the 12 newest episodes published today. If none were published today, show the 12 latest episodes under `最新更新`.
5. Persistent mini player above the bottom safe area.

Tapping an episode starts it and sets the visible list as the queue. Search opens a full mobile search screen backed by the static album catalog. Selecting an album opens its episode list route.

### Scrolled home state

After the hero scrolls away, the top bar becomes sticky and shows `今日推荐` plus a `继续播放` action when a resumable episode exists. Returning to the home route restores its scroll position.

### Mini player

The mini player contains artwork, truncated title, elapsed/total time, play/pause, and the queue button. It is constrained to the same 430px mobile surface on desktop and never covers the final list item. Title and album metadata render as separate block lines.

Tapping the queue button opens the queue sheet on top of the current screen. Playback continues. Tapping the artwork/title does not introduce a new full-player screen in this release.

### Queue sheet

The queue is a modal bottom sheet, not a page transition. It includes:

- Drag handle and rounded top corners.
- `播放列表` and `最近听过` tabs.
- Current item highlighting.
- Queue rows with artwork, title, album, duration, and progress.
- A row action for play next or remove from queue.
- Close by tapping the backdrop, swiping down beyond the threshold, pressing Escape, or using browser Back.

The first focus moves into the sheet, focus remains contained while open, and closing restores focus to the queue button.

### Album detail and search

Album detail retains the existing episode pagination but uses the new row styling and real error/empty states. Search filters the local full catalog and does not call the NIO API per keystroke.

## Persistence

Store a versioned JSON document under `nio_player_state_v2`:

```json
{
  "version": 2,
  "currentEpisode": {},
  "queue": [],
  "queueIndex": 0,
  "positionSeconds": 0,
  "history": [],
  "updatedAt": 1785660000000
}
```

Rules:

- Save progress at most every five seconds and on pause, page hide, episode change, and ended.
- Resume an episode only when saved progress is greater than 10 seconds and at least 30 seconds remain.
- Keep the 100 most recent unique history entries.
- Clear invalid or incompatible persisted data and start safely.
- Never store credentials or private user data.

## Error Handling

- Catalog unavailable with no cache: full-page retry state.
- Catalog refresh failure with cache: show cached data and a non-blocking stale-data notice.
- Episode page failure: inline retry row without discarding already loaded pages.
- Audio failure: mini-player error message and retry action; queue remains intact.
- Offline: keep the shell, catalog, queue, and history usable; disable actions that require uncached audio.

Errors shown to users use concise Chinese copy and do not expose raw exception messages.

## PWA and Assets

- Configure `vite-plugin-pwa` with the existing `/nio-podcast-web/` base.
- Set manifest `start_url` and `scope` to `/nio-podcast-web/`.
- Generate 180px, 192px, and 512px PNG icons from the existing favicon source.
- Include maskable icon metadata and correct Apple touch icon paths.
- Cache the application shell, catalog, icons, and built assets.
- Use network-first behavior for the catalog and no service-worker audio caching.

## Accessibility and Responsive Rules

- Target 320px through 430px mobile widths; desktop centers the same mobile surface.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Minimum interactive target is 44px.
- Small and secondary text meets WCAG AA contrast.
- Motion has a `prefers-reduced-motion` alternative.
- Lists, tabs, dialogs, loading states, errors, and progress expose correct semantics.
- Long Chinese and English titles truncate or wrap without overlapping controls.

## Testing

Add Vitest, Testing Library, and jsdom coverage for:

- Catalog normalization, HTTPS audio URLs, sorting, and generated-file atomicity.
- Catalog loading from network and cache fallback.
- Episode request error propagation.
- Queue creation, play-next/remove, history deduplication, and size limit.
- Persistence restore, invalid-state recovery, and progress throttling.
- Home recommendation and today's/latest fallback behavior.
- Queue button opening the sheet, tab switching, backdrop close, and browser Back close.
- Route refresh behavior and album error retry.
- PWA paths and required generated icons.

Run production build, tests, lint, and dependency audit before deployment. Browser verification covers 320x568 and 390x844 viewports, light/dark modes, reduced motion, queue interaction, refresh restore, playback, and GitHub Pages asset URLs.

## Deployment

1. Generate and review the full catalog.
2. Run tests, lint, production build, and local mobile browser checks.
3. Commit source, catalog, generated icons, and lockfile.
4. Push `main`.
5. Publish `dist` to the existing GitHub Pages branch using the repository deploy script.
6. Verify the live page, manifest, icons, service worker, catalog, episode loading, playback, and queue sheet.

## Acceptance Criteria

- A normal page load does not probe album IDs and does not create a request storm.
- The full generated album catalog is searchable.
- Home visually follows the approved reference and shows current update data.
- The mini-player queue button opens an in-place bottom sheet and playback continues.
- Queue, history, current episode, and progress survive refresh on the same device.
- Network failures show retryable states rather than empty success states.
- Browser Back closes the queue sheet, then navigates through app routes.
- No list content is hidden behind the mini player at supported mobile sizes.
- PWA installation opens `/nio-podcast-web/`; all declared icons return 200.
- Automated tests, lint, production build, and live GitHub Pages smoke checks pass.
