# Incremental Podcast Catalog Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the NIO Radio catalog frequently with known-album incremental scans, daily full discovery, and no-op deployments skipped automatically.

**Architecture:** Extend the existing catalog generator with a pure merge operation and a `full`/`incremental` mode. Persist the generated catalog in `main`, publish only when its album content changes, and move catalog delivery from Workbox precache to a bounded NetworkFirst route so foreground revalidation can receive a new deployment.

**Tech Stack:** Node.js, React 19, Vite 8, vite-plugin-pwa/Workbox, Vitest, GitHub Actions, GitHub Pages.

---

### Task 1: Add incremental catalog merging

**Files:**
- Modify: `scripts/catalog-generator.js`
- Test: `scripts/catalog-generator.test.js`

- [ ] **Step 1: Write the failing merge tests**

Add tests for updating known albums, preserving failed records, and sorting by the refreshed latest episode:

```js
it('merges refreshed known albums while preserving failed requests', async () => {
  const previous = [
    { id: 1, name: '旧专辑', latestEpisode: { id: 11, onlineTime: 1 } },
    { id: 2, name: '保留专辑', latestEpisode: { id: 22, onlineTime: 2 } },
  ];
  const requestAlbum = async id => {
    if (id === 2) throw new Error('temporary failure');
    return { id: 1, name: '新专辑', latestEpisode: { id: 12, onlineTime: 3 } };
  };

  await expect(updateKnownAlbums(previous, requestAlbum, 2)).resolves.toEqual([
    { id: 1, name: '新专辑', latestEpisode: { id: 12, onlineTime: 3 } },
    { id: 2, name: '保留专辑', latestEpisode: { id: 22, onlineTime: 2 } },
  ]);
});

it('does not treat an empty known-album response as deletion', async () => {
  const previous = [{ id: 1, name: '旧专辑', latestEpisode: { id: 11, onlineTime: 1 } }];
  await expect(updateKnownAlbums(previous, async () => null)).resolves.toEqual(previous);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
npm test -- scripts/catalog-generator.test.js
```

Expected: the tests fail because `updateKnownAlbums` is not exported.

- [ ] **Step 3: Implement the minimal incremental merge**

Add `updateKnownAlbums(previousAlbums, requestAlbum, concurrency = 12)` to `scripts/catalog-generator.js`. Call `scanCatalog` with the existing IDs, index successful results by numeric album ID, and return `sortGeneratedAlbums(previousAlbums.map(album => refreshed.get(album.id) || album))`. Leave failed and empty responses in the previous catalog so only a full scan can reconcile removals.

- [ ] **Step 4: Run the focused tests GREEN**

Run:

```bash
npm test -- scripts/catalog-generator.test.js
```

Expected: all catalog-generator tests pass.

- [ ] **Step 5: Commit the catalog merge**

```bash
git add scripts/catalog-generator.js scripts/catalog-generator.test.js
git commit -m "feat: support incremental catalog refreshes"
```

### Task 2: Add full/incremental CLI modes and no-op detection

**Files:**
- Modify: `scripts/generate-catalog.mjs`
- Modify: `scripts/catalog-generator.js`
- Test: `scripts/catalog-generator.test.js`

- [ ] **Step 1: Write the failing serialization tests**

Import `sameCatalogContent` and add a pure helper test for content comparison:

```js
it('compares catalog content without generatedAt', () => {
  expect(sameCatalogContent(
    { generatedAt: 1, albums: [{ id: 1 }] },
    { generatedAt: 2, albums: [{ id: 1 }] },
  )).toBe(true);
  expect(sameCatalogContent(
    { generatedAt: 1, albums: [{ id: 1 }] },
    { generatedAt: 2, albums: [{ id: 2 }] },
  )).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
npm test -- scripts/catalog-generator.test.js
```

Expected: the new test fails because `sameCatalogContent` is not exported.

- [ ] **Step 3: Implement mode selection and stable writes**

Export `sameCatalogContent(previous, next)` from `scripts/catalog-generator.js` using a stable JSON serialization of `albums`. Update `scripts/generate-catalog.mjs` to read the existing JSON when available, select `NIO_CATALOG_MODE === 'incremental'` versus the default full scan, and write `{ generatedAt: Date.now(), albums }` only when album content differs. Log `No catalog changes` and leave the file untouched when content is equal. Keep the existing empty-result guard for full scans.

- [ ] **Step 4: Run generator tests GREEN**

Run:

```bash
npm test -- scripts/catalog-generator.test.js
```

Expected: all generator tests pass.

- [ ] **Step 5: Commit the CLI behavior**

```bash
git add scripts/generate-catalog.mjs scripts/catalog-generator.js scripts/catalog-generator.test.js
git commit -m "perf: skip unchanged catalog writes"
```

### Task 3: Make catalog delivery network-first and refresh on foreground

**Files:**
- Modify: `vite.config.js`
- Modify: `src/catalog.js`
- Modify: `src/App.jsx`
- Modify: `src/pwa.test.js`
- Modify: `src/catalog.test.js`
- Modify: `src/App.catalog.test.jsx`

- [ ] **Step 1: Write failing cache and foreground-refresh tests**

Update the PWA test to require a `NetworkFirst` catalog route and keep the existing bounded artwork/no-audio assertions. Add a catalog request assertion for `{ cache: 'no-store' }`. In `src/App.catalog.test.jsx`, import `waitFor`, define a two-album `catalog` fixture with a valid `latestEpisode`, and add an App test that dispatches `visibilitychange` after the cooldown and resolves a second `loadCatalog` call with a newer episode.

```js
it('refreshes the catalog once when the document returns to the foreground', async () => {
  vi.useFakeTimers();
  const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1 } }] };
  const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2 } }] };
  loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });
  render(<App />);
  await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
  vi.advanceTimersByTime(15 * 60 * 1000);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2));
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm test -- src/pwa.test.js src/catalog.test.js src/App.catalog.test.jsx
```

Expected: the new NetworkFirst and foreground assertions fail against the current precache-only catalog behavior.

- [ ] **Step 3: Implement NetworkFirst catalog delivery**

Remove `json` from `workbox.globPatterns` in `vite.config.js`. Add a runtime route whose URL pathname ends in `/data/albums.json`, with `handler: 'NetworkFirst'`, `cacheName: 'nio-catalog-v1'`, an 8-second network timeout, one cached entry, and `[0, 200]` cacheable statuses. Leave artwork `CacheFirst` and audio uncached.

Change `loadCatalog` to request the catalog with `{ cache: 'no-store', signal }`. In `App.jsx`, centralize catalog loading in a callback and listen for `visibilitychange`; when visible and at least 15 minutes have elapsed since the last refresh, call the callback and update the existing stale/error state without interrupting playback. The initial load and manual retry continue using the same callback.

- [ ] **Step 4: Run focused tests GREEN**

Run:

```bash
npm test -- src/pwa.test.js src/catalog.test.js src/App.catalog.test.jsx
```

Expected: all focused tests pass, including stale fallback and no-audio-cache assertions.

- [ ] **Step 5: Commit client freshness**

```bash
git add vite.config.js src/catalog.js src/App.jsx src/pwa.test.js src/catalog.test.js src/App.catalog.test.jsx
git commit -m "feat: refresh catalog when app returns to foreground"
```

### Task 4: Add the scheduled GitHub Actions publisher

**Files:**
- Create: `.github/workflows/update-catalog.yml`
- Test: `scripts/workflow-config.test.js`

- [ ] **Step 1: Write the failing workflow contract test**

Create `scripts/workflow-config.test.js` with the imports and contract assertion below:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('catalog update workflow', () => {
it('defines serialized scheduled full and incremental catalog deployments', () => {
  const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
  expect(workflow).toContain('contents: write');
  expect(workflow).toContain('cancel-in-progress: false');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('NIO_CATALOG_MODE: full');
  expect(workflow).toContain('NIO_CATALOG_MODE: incremental');
  expect(workflow).toContain("30 23 * * 0-4");
  expect(workflow).toContain("0 16 * * 1-5");
});
});
```

- [ ] **Step 2: Run the workflow test and confirm RED**

Run:

```bash
npm test -- scripts/workflow-config.test.js
```

Expected: Vitest fails because the workflow and test file do not exist.

- [ ] **Step 3: Add the scheduled workflow**

Create `.github/workflows/update-catalog.yml` with `workflow_dispatch`, `contents: write`, and `concurrency: { group: nio-catalog-update, cancel-in-progress: false }`. Treat all requested times as Beijing (`Asia/Shanghai`) and convert them to UTC cron because GitHub Actions has no timezone field. Add these UTC schedules, with comments showing their Beijing times: `30 23 * * 0-4` for weekday Beijing 07:30 full discovery, `30 0 * * 1-5`, `30 1 * * 1-5`, `0 4 * * 1-5`, `0 5 * * 1-5`, `0 7 * * 1-5`, `0 9 * * 1-5`, `30 9 * * 1-5`, `0 10 * * 1-5`, `0 11 * * 1-5`, `0 12 * * 1-5`, and `0 16 * * 1-5` for the remaining weekday incremental times, plus `0 4 * * 0,6` and `0 10 * * 0,6` for weekend Beijing 12:00 and 18:00. For scheduled runs, set `NIO_CATALOG_MODE=full` only when `github.event.schedule` equals `30 23 * * 0-4`; otherwise set incremental mode. For manual runs, expose a `mode` input defaulting to `incremental`. Check out `main`, run `npm ci`, run `npm run catalog`, and exit when `git diff --quiet -- public/data/albums.json`. When changed, configure the bot identity, commit `public/data/albums.json`, push `main`, run `npm run build`, and run `npm run deploy`.

- [ ] **Step 4: Run workflow contract tests GREEN**

Run:

```bash
npm test -- scripts/workflow-config.test.js
```

Expected: the workflow contract passes.

- [ ] **Step 5: Commit the scheduled publisher**

```bash
git add .github/workflows/update-catalog.yml scripts/workflow-config.test.js
git commit -m "ci: schedule incremental catalog deployments"
```

### Task 5: Verify the integrated result

**Files:**
- No source changes.

- [ ] **Step 1: Run the complete test suite**

Run `npm test` and confirm all files pass with zero failures.

- [ ] **Step 2: Run lint and production build**

Run `npm run lint` and `npm run build`; confirm both exit with code 0 and the generated service worker includes the `nio-catalog-v1` runtime cache.

- [ ] **Step 3: Inspect the workflow and generated service worker**

Run `git diff --check`, inspect `.github/workflows/update-catalog.yml`, and search `dist/sw.js` for `nio-catalog-v1` and its `NetworkFirst`-generated route behavior.

- [ ] **Step 4: Commit any verification-only corrections**

If verification reveals a source issue, fix it with a focused test and commit using `git add <files> && git commit -m "fix: harden catalog update workflow"`; do not deploy a failing build.
