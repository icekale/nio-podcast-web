# NIO Podcast Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the request-heavy album browser with a reliable mobile NIO Radio PWA whose mini-player queue button opens the approved in-place bottom sheet.

**Architecture:** Keep the existing React/Vite single-page app and split only the stateful domains that need independent tests: catalog/API normalization, hash routing, and player persistence/queue operations. The browser consumes a checked-in static album catalog and fetches episode pages only after the user opens an album. One persistent audio element owns playback while screens and the queue sheet are views over the same state.

**Tech Stack:** React 19, Vite 8, Vitest, Testing Library, jsdom, lucide-react, vite-plugin-pwa, GitHub Pages

---

### Task 1: Test and build the catalog/API boundary

**Files:**
- Modify: `package.json`
- Modify: `src/api.js`
- Create: `src/catalog.js`
- Create: `src/api.test.js`
- Create: `src/catalog.test.js`

- [ ] **Step 1: Add the test harness and failing API/catalog tests**

Add `test`, `test:watch`, and `lint` scripts plus Vitest, jsdom, Testing Library, lucide-react, and vite-plugin-pwa dependencies. Test these public contracts:

```js
expect(normalizeAudioUrl('http://cdn.example/audio.aac')).toBe('https://cdn.example/audio.aac')
expect(sortAlbumsByLatest([{ id: 1, latestEpisode: { onlineTime: 1 } }, { id: 2, latestEpisode: { onlineTime: 2 } }])[0].id).toBe(2)
await expect(getEpisodes(5, 1, 30, failingFetch)).rejects.toMatchObject({ code: 'HTTP_ERROR' })
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/api.test.js src/catalog.test.js`

Expected: FAIL because typed errors and catalog helpers do not exist.

- [ ] **Step 3: Implement the minimum boundary**

`src/api.js` exports `ApiError`, `getEpisodes`, and normalization helpers. It uses an 8-second abort timeout, validates `result`, throws `OFFLINE`, `TIMEOUT`, `HTTP_ERROR`, or `INVALID_RESPONSE`, and never converts failure into an empty success. `src/catalog.js` exports sorting, today's/latest selection, cache read/write, and catalog loading with stale-cache fallback.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/api.test.js src/catalog.test.js`

Expected: all catalog/API tests pass with no warnings.

### Task 2: Generate an atomic static catalog

**Files:**
- Create: `scripts/generate-catalog.mjs`
- Create: `scripts/catalog-generator.js`
- Create: `scripts/catalog-generator.test.js`
- Create: `public/data/albums.json`
- Modify: `package.json`

- [ ] **Step 1: Write the failing atomicity test**

```js
await expect(writeCatalogAtomically(target, catalog, failingRename)).rejects.toThrow()
expect(await readFile(target, 'utf8')).toBe(previousCatalog)
```

Also verify bounded concurrency and descending latest-episode order.

- [ ] **Step 2: Run the generator test and verify RED**

Run: `npm test -- scripts/catalog-generator.test.js`

Expected: FAIL because the generator helpers do not exist.

- [ ] **Step 3: Implement and run generation**

Probe IDs 1–2000 with bounded concurrency, normalize each non-empty album from its newest episode, write a temporary sibling file, validate it, and rename it over `public/data/albums.json` only after every request completes. Add `npm run catalog`.

- [ ] **Step 4: Verify generated data**

Run: `npm run catalog && npm test -- scripts/catalog-generator.test.js`

Expected: the JSON parses, contains unique albums, is sorted, and the test passes.

### Task 3: Test and implement hash navigation

**Files:**
- Create: `src/router.js`
- Create: `src/router.test.js`

- [ ] **Step 1: Write failing route tests**

```js
expect(parseHash('#/album/23')).toEqual({ screen: 'album', albumId: 23, queueOpen: false })
expect(parseHash('#/search?queue=1')).toEqual({ screen: 'search', queueOpen: true })
expect(closeQueueHash('#/album/23?queue=1')).toBe('#/album/23')
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/router.test.js`

Expected: FAIL because route parsing is missing.

- [ ] **Step 3: Implement the minimum hash router helpers**

Support `#/`, `#/search`, and `#/album/:id` plus `queue=1`. Invalid hashes normalize to home. Opening the sheet adds query state; browser Back removes it before leaving the route.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- src/router.test.js`

Expected: all route tests pass.

### Task 4: Test and implement player state

**Files:**
- Create: `src/playerState.js`
- Create: `src/playerState.test.js`

- [ ] **Step 1: Write failing queue/history/persistence tests**

Cover queue replacement, play next, remove, automatic advance, unique MRU history capped at 100, invalid JSON recovery, v2 validation, and the resume rule:

```js
expect(canResume({ positionSeconds: 11, durationSeconds: 60 })).toBe(true)
expect(canResume({ positionSeconds: 11, durationSeconds: 35 })).toBe(false)
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/playerState.test.js`

Expected: FAIL because reducer and persistence helpers are missing.

- [ ] **Step 3: Implement pure state operations**

Use a versioned `nio_player_state_v2` document. Save at most every five seconds during playback and immediately on pause, hide, episode change, and ended. Keep only serializable episode fields and discard incompatible data.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- src/playerState.test.js`

Expected: all player-state tests pass.

### Task 5: Build the approved home, search, album, mini-player, and queue sheet

**Files:**
- Replace: `src/App.jsx`
- Replace: `src/App.css`
- Create: `src/App.test.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write failing UI behavior tests**

Render with a small catalog and fake audio. Verify the newest episode appears in `今日推荐`, no-today fallback reads `最新更新`, `全部播放` creates the visible queue, the mini-player button named `打开播放列表` opens a dialog without changing the screen, tabs switch, backdrop/Escape/Back close it, and album failures expose `重新加载`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the reference home and queue dialog are missing.

- [ ] **Step 3: Implement the mobile app shell**

Use one `App` state owner and one persistent `<audio>` element. Render semantic screen components, 44px controls, a fixed mini-player constrained to 430px, and a portal/native dialog-style bottom sheet. Preserve focus, lock background scroll, support pointer swipe-down, Escape, backdrop click, and hash Back. Use lucide icons for Back, Search, Play/Pause, Clock, ListMusic, MoreHorizontal, and AudioLines.

- [ ] **Step 4: Apply the approved visual system**

Use a restrained white/ink palette with pale aqua `#e8f7f7` hero and teal `#00b9b5` action/current states. Match the reference hierarchy: roomy hero, square program art, concise metadata, unframed episode rows, and a white queue sheet over a muted backdrop. Support safe areas, 320–430px widths, centered desktop surface, system sans typography, dark mode tokens, reduced motion, focus-visible, zoom, long titles, and player-safe list padding.

- [ ] **Step 5: Run UI tests and verify GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all UI behavior tests pass without React act or accessibility warnings.

### Task 6: Repair PWA paths and assets

**Files:**
- Modify: `vite.config.js`
- Modify: `index.html`
- Replace: `public/manifest.json`
- Create: `public/icon-180.png`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Create: `src/pwa.test.js`

- [ ] **Step 1: Write failing PWA path tests**

Assert manifest `start_url` and `scope` equal `/nio-podcast-web/`, every icon exists at its declared size, Vite base remains `/nio-podcast-web/`, and HTML uses base-safe relative asset links.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/pwa.test.js`

Expected: FAIL because current paths point at site root and PNG icons are absent.

- [ ] **Step 3: Configure service worker and assets**

Register `VitePWA` with app-shell/catalog precache, network-first catalog runtime caching, and no audio runtime route. Generate 180/192/512 PNGs from `public/favicon.svg`, add maskable metadata, and set light/dark theme metadata consistently.

- [ ] **Step 4: Run tests and production build**

Run: `npm test -- src/pwa.test.js && npm run build`

Expected: tests pass and `dist/` contains manifest, icons, service worker, catalog, and hashed assets under the repository base.

### Task 7: Browser QA and accessibility polish

**Files:**
- Modify only files implicated by observed defects.

- [ ] **Step 1: Start the production-like local server**

Run: `npm run build && npm run preview -- --host 127.0.0.1`

- [ ] **Step 2: Inspect required states**

At 320x568 and 390x844 verify home initial/scrolled states, search, album loading/error, mini-player, queue/current/history tabs, backdrop/swipe/Escape/Back close, refresh restoration, offline shell, dark mode, reduced motion, 200% zoom, and long text. Read screenshots back after capture.

- [ ] **Step 3: Patch only reproduced defects and re-run checks**

For every defect, add or adjust a regression test first when behavior is involved, verify it fails for the observed reason, apply the smallest fix, and rerun the focused test plus screenshot.

### Task 8: Verify, merge, deploy, and smoke-test live GitHub Pages

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the real commands and architecture**

Replace template README content with setup, catalog refresh, test, build, deploy, data source, local persistence, and offline limitations.

- [ ] **Step 2: Run the complete local gate**

Run: `npm test -- --run && npm run lint && npm run build && npm audit --audit-level=high`

Expected: every command exits 0 with no failed tests, lint errors, build errors, or high/critical vulnerabilities.

- [ ] **Step 3: Review the final diff and commit**

Confirm every changed line maps to the approved spec, generated data validates, and no ignored browser artifacts are included. Commit the feature branch, merge it to `main`, and push `main`.

- [ ] **Step 4: Deploy and verify live**

Run: `npm run deploy`.

Verify `https://icekale.github.io/nio-podcast-web/`, manifest, all icons, service worker, catalog, album request, audio request, refresh, and queue sheet. Every required URL must return 200 and the live browser console must contain no application errors.
