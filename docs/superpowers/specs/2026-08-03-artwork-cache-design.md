# Artwork Cache Tuning Design

## Goal

Keep album artwork fast and reliable without adding a server-side image cache.

## Change

- Raise the Service Worker artwork runtime cache limit from `150` to `700` entries so the full 565-album directory plus episode artwork fits in one cache pass.
- Switch the artwork strategy from `CacheFirst` to `StaleWhileRevalidate` so returning users see cached covers instantly while the browser refreshes them in the background.
- Keep the 30-day expiration and the existing `nio-artwork-v1` cache name so current cached covers remain usable.

## Files

- `vite.config.js`: artwork runtime-cache handler and `maxEntries`.
- `src/pwa.test.js`: assert the new strategy and limit.
- `README.md`: update the cache-strategy bullet.

## Non-goals

- No server-side image proxy or repository-stored covers.
- No change to audio caching, catalog caching, or PWA precache scope.
