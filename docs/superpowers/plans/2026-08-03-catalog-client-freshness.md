# Catalog Client Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep home and all-albums catalog summaries synchronized within five minutes in a long-lived PWA while avoiding duplicate refresh requests and unnecessary catalog transfers.

**Architecture:** Keep catalog state in `App`, add a five-minute freshness gate plus a shared in-flight promise, and trigger eligible refreshes from a visible-page timer, foreground transitions, and home/all-albums navigation. Keep Workbox `NetworkFirst` and change the catalog fetch to HTTP conditional revalidation with `cache: 'no-cache'`, preserving local and service-worker fallbacks.

**Tech Stack:** React 19, Vitest, Testing Library, Vite PWA/Workbox, GitHub Pages static hosting.

---

### Task 1: Add regression coverage for stale catalog summaries

**Files:**
- Modify: `src/App.catalog.test.jsx`

- [ ] **Step 1: Add a five-minute foreground regression test**

Update the Testing Library import to include `fireEvent` for the route and visibility events:

```jsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
```

Extend the existing foreground test so it advances the clock by five minutes, asserts the initial title is rendered, dispatches `visibilitychange`, and asserts the newer title replaces it:

```jsx
it('refreshes stale home summaries when the document returns to the foreground', async () => {
  const now = 1_000;
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
  const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
  const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
  loadCatalog.mockReset();
  loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });

  render(<App />);
  await waitFor(() => expect(screen.getByText('旧节目')).toBeInTheDocument());
  nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));

  await waitFor(() => expect(screen.getByText('新节目')).toBeInTheDocument());
  expect(loadCatalog).toHaveBeenCalledTimes(2);
  nowSpy.mockRestore();
});
```

- [ ] **Step 2: Add route-trigger and duplicate-request tests**

Add the following route test. It reproduces the reported symptom by changing the shared catalog after the user opens all albums:

```jsx
it('refreshes the all-albums subtitle when navigation finds a stale catalog', async () => {
  const now = 1_000;
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
  const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
  const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
  loadCatalog.mockReset();
  loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });

  render(<App />);
  await waitFor(() => expect(screen.getByText('旧节目')).toBeInTheDocument());
  nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));

  await waitFor(() => expect(screen.getByText('新节目')).toBeInTheDocument());
  expect(loadCatalog).toHaveBeenCalledTimes(2);
  nowSpy.mockRestore();
});
```

Add a second test with an unresolved refresh promise to prove timer, visibility, and route triggers share one request:

```jsx
it('deduplicates concurrent automatic catalog refreshes', async () => {
  const now = 1_000;
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
  const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
  const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
  let resolveRefresh;
  const pendingRefresh = new Promise(resolve => { resolveRefresh = () => resolve({ catalog: newerCatalog, stale: false }); });
  loadCatalog.mockReset();
  loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockReturnValueOnce(pendingRefresh);

  render(<App />);
  await waitFor(() => expect(screen.getByText('旧节目')).toBeInTheDocument());
  nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2));
  resolveRefresh();
  await waitFor(() => expect(screen.getByText('新节目')).toBeInTheDocument());
  nowSpy.mockRestore();
});
```

- [ ] **Step 3: Add hidden-page timer coverage**

Use Vitest fake timers for a focused test. Save the original visibility descriptor, set it to `hidden`, render with an already resolved initial catalog, advance six minutes, and assert that only the initial request ran:

```jsx
it('does not poll the catalog while the document is hidden', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  loadCatalog.mockReset().mockResolvedValue({ catalog: { generatedAt: 1, albums: [] }, stale: false });

  render(<App />);
  await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
  expect(loadCatalog).toHaveBeenCalledTimes(1);

  if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
  vi.useRealTimers();
});
```

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```bash
npm test -- src/App.catalog.test.jsx
```

Expected: the five-minute and route/timer assertions fail against the current 15-minute foreground-only implementation.

### Task 2: Implement the shared five-minute refresh controller

**Files:**
- Modify: `src/App.jsx:46,659-720,886-891`

- [ ] **Step 1: Replace the cooldown and add in-flight state**

Change the constant to five minutes and add a ref beside `lastCatalogRefreshAt`:

```js
const CATALOG_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
// ...
const lastCatalogRefreshAt = useRef(0);
const catalogRefreshPromise = useRef(null);
```

- [ ] **Step 2: Make refresh eligibility and deduplication explicit**

Replace `refreshCatalog` with a callback that accepts `{ showLoading = false, force = false }`, returns the existing in-flight promise when present, skips non-forced calls inside the cooldown, records the request start time, preserves the current state on failure, and clears the ref in `finally`:

```js
const refreshCatalog = useCallback(({ showLoading = false, force = false } = {}) => {
  if (catalogRefreshPromise.current) return catalogRefreshPromise.current;
  if (!force && Date.now() - lastCatalogRefreshAt.current < CATALOG_REFRESH_COOLDOWN_MS) return Promise.resolve(null);
  if (showLoading) setCatalogState(previous => ({ ...previous, loading: true, error: null }));
  lastCatalogRefreshAt.current = Date.now();
  const request = loadCatalog()
    .then(result => {
      setCatalogState({ catalog: result.catalog, loading: false, error: null, stale: result.stale });
      return result;
    })
    .catch(error => {
      setCatalogState(previous => ({ ...previous, loading: false, error, stale: Boolean(previous.catalog) }));
      return null;
    })
    .finally(() => {
      if (catalogRefreshPromise.current === request) catalogRefreshPromise.current = null;
    });
  catalogRefreshPromise.current = request;
  return request;
}, []);
```

- [ ] **Step 3: Wire the initial, visibility, timer, and route triggers**

Keep initial loading forced, make visibility refresh non-blocking, and add effects with cleanup:

```js
useEffect(() => {
  if (initialCatalog) return undefined;
  refreshCatalog({ force: true });
  return undefined;
}, [initialCatalog, refreshCatalog]);

useEffect(() => {
  if (initialCatalog) return undefined;
  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') refreshCatalog();
  };
  document.addEventListener('visibilitychange', refreshWhenVisible);
  const timer = window.setInterval(refreshWhenVisible, CATALOG_REFRESH_COOLDOWN_MS);
  return () => {
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    window.clearInterval(timer);
  };
}, [initialCatalog, refreshCatalog]);

useEffect(() => {
  if (initialCatalog || !['home', 'albums'].includes(route.screen)) return undefined;
  refreshCatalog();
  return undefined;
}, [initialCatalog, refreshCatalog, route.screen]);
```

Update manual retry to call `refreshCatalog({ showLoading: true, force: true })`. Automatic calls omit `showLoading` so the current list and player remain visually stable.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run:

```bash
npm test -- src/App.catalog.test.jsx
```

Expected: all catalog-loading tests pass, including the new five-minute, route, deduplication, and hidden-page cases.

- [ ] **Step 5: Commit the refresh controller**

```bash
git add src/App.jsx src/App.catalog.test.jsx
git commit -m "fix: refresh catalog while app stays open"
```

### Task 3: Use conditional catalog revalidation

**Files:**
- Modify: `src/catalog.js:60-66`
- Modify: `src/catalog.test.js:48-61`

- [ ] **Step 1: Change the request contract test to require `no-cache`**

Update the existing fetch assertion from `no-store` to `no-cache`, retaining the URL and `AbortSignal` checks:

```js
expect(options?.cache).toBe('no-cache');
```

- [ ] **Step 2: Run the focused catalog tests and confirm RED**

Run:

```bash
npm test -- src/catalog.test.js
```

Expected: the cache-policy test fails because `loadCatalog` still uses `no-store`.

- [ ] **Step 3: Change only the catalog fetch cache mode**

In `loadCatalog`, keep the URL, abort controller, timeout, normalization, localStorage write, and fallback behavior unchanged; replace the request options with:

```js
{ cache: 'no-cache', signal: controller.signal }
```

- [ ] **Step 4: Run catalog and PWA tests GREEN**

Run:

```bash
npm test -- src/catalog.test.js src/pwa.test.js
```

Expected: all catalog and service-worker cache boundary tests pass, with artwork still `CacheFirst` and audio still uncached.

- [ ] **Step 5: Commit conditional revalidation**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "perf: conditionally revalidate podcast catalog"
```

### Task 4: Verify, build, and validate the deployed behavior

**Files:**
- No source changes unless a verification failure identifies a regression in Tasks 1-3.

- [ ] **Step 1: Run the complete automated suite and lint**

Run:

```bash
npm test
npm run lint
```

Expected: 104 existing tests plus the new regression tests pass, and oxlint exits with code 0.

- [ ] **Step 2: Build the production PWA**

Run:

```bash
npm run build
```

Expected: Vite produces `dist/` and the generated service worker still contains the catalog `NetworkFirst` route.

- [ ] **Step 3: Run a fresh mobile-width browser check**

Serve the worktree build with Vite, set the browser viewport to a phone width, and verify:

1. Home renders the initial catalog title.
2. After the refresh window, the home title changes without a reload.
3. The all-albums row shows the same latest subtitle.
4. Opening an album still shows its episode detail and playback controls.

Reset the browser viewport and close temporary tabs after the check.

- [ ] **Step 4: Merge and deploy only after verification**

From the main worktree, fast-forward `main` to `codex/catalog-client-freshness`, push `main`, and run the existing GitHub Pages deployment workflow. Verify both `https://icekale.github.io/nio-podcast-web/#/` and `https://nio.k4le.top/#/` load the refreshed build and that `data/albums.json` responds with the current catalog.

- [ ] **Step 5: Report evidence and preserve unrelated work**

Record the test count, lint/build exit status, deployment URL, and the unchanged untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` file in the handoff.
