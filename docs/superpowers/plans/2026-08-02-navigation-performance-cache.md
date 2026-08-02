# NIO Radio Navigation, Performance, and Cache Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Repair nested mobile navigation and catalog rendering, then add bounded catalog, episode, and artwork caching before deploying the verified PWA to GitHub Pages.

**Architecture:** Keep the existing single React app and hash router. Store app-owned history depth in `window.history.state`, preserve search state in hash query parameters, and restore scroll positions by route. Add an in-memory 10-minute episode cache with concurrent-request deduplication, precache the static catalog, and use a bounded Workbox image cache without caching audio.

**Tech Stack:** React 19, Vite 8, Vitest, Testing Library, jsdom, vite-plugin-pwa, Workbox, GitHub Pages

---

### Task 1: Extend the hash router for query-preserving navigation

**Files:**
- Modify: `src/router.js`
- Modify: `src/router.test.js`

- [ ] **Step 1: Write failing route-query tests**

Add tests for a search query and queue preservation:

```js
it('parses and serializes the search query', () => {
  expect(parseHash('#/search?q=morning%20radio')).toEqual({
    screen: 'search', albumId: null, queueOpen: false, searchQuery: 'morning radio',
  });
  expect(withQueueHash('#/search?q=morning%20radio', true)).toBe('#/search?q=morning+radio&queue=1');
  expect(closeQueueHash('#/search?q=morning+radio&queue=1')).toBe('#/search?q=morning+radio');
});
```

Update existing exact-object route expectations to include `searchQuery: ''` for the search route and leave non-search route shapes unchanged.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
npm test -- src/router.test.js
```

Expected: the new test fails because `parseHash` does not expose `searchQuery` and queue helpers currently discard query parameters.

- [ ] **Step 3: Implement minimal query-safe router helpers**

In `src/router.js`, parse the path and `URLSearchParams`, return `searchQuery` only on the Search route, and make `withQueueHash`/`closeQueueHash` mutate only the `queue` parameter while preserving `q` and any future parameters. Use `URLSearchParams.toString()` for serialization.

- [ ] **Step 4: Run route tests GREEN**

Run:

```bash
npm test -- src/router.test.js
```

Expected: all route tests pass.

- [ ] **Step 5: Commit the router boundary**

```bash
git add src/router.js src/router.test.js
git commit -m "fix: preserve search state in hash routes"
```

### Task 2: Add 10-minute episode caching and request deduplication

**Files:**
- Modify: `src/api.js:1-92`
- Modify: `src/api.test.js`

- [ ] **Step 1: Write failing cache tests**

Import `clearEpisodeCache` and add a `beforeEach` that clears it. Add tests using Vitest fake timers:

```js
it('deduplicates concurrent identical episode requests', async () => {
  let calls = 0;
  let release;
  const fetchImpl = () => {
    calls += 1;
    return new Promise(resolve => { release = () => resolve(responseFor({ dataList: [], totalCount: 0, haveNext: 0 })); });
  };
  const first = getEpisodes(5, 1, 30, fetchImpl);
  const second = getEpisodes(5, 1, 30, fetchImpl);
  release();
  await expect(Promise.all([first, second])).resolves.toEqual([
    { episodes: [], totalCount: 0, hasMore: false },
    { episodes: [], totalCount: 0, hasMore: false },
  ]);
  expect(calls).toBe(1);
});

it('uses a successful result for ten minutes and refetches after expiry', async () => {
  vi.useFakeTimers();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return responseFor({ dataList: [], totalCount: 0, haveNext: 0 }); };
  await getEpisodes(5, 1, 30, fetchImpl);
  await getEpisodes(5, 1, 30, fetchImpl);
  expect(calls).toBe(1);
  vi.advanceTimersByTime(10 * 60 * 1000 + 1);
  await getEpisodes(5, 1, 30, fetchImpl);
  expect(calls).toBe(2);
  vi.useRealTimers();
});

it('does not cache rejected requests', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 503 }; };
  await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  expect(calls).toBe(2);
});
```

- [ ] **Step 2: Run API tests and confirm RED**

Run:

```bash
npm test -- src/api.test.js
```

Expected: the new imports or cache behavior fail because `getEpisodes` currently always starts a request.

- [ ] **Step 3: Implement the smallest cache wrapper**

Add `EPISODE_CACHE_TTL_MS`, module-local `episodeCache` and `episodeRequests` maps, and exported `clearEpisodeCache()`. Build a key from `albumId`, `page`, and `pageSize`. Return unexpired values, return an existing in-flight promise, cache only resolved values, and remove rejected requests in `finally`. Keep the existing timeout, mapping, and typed-error behavior inside the underlying network request.

- [ ] **Step 4: Run API tests GREEN**

Run:

```bash
npm test -- src/api.test.js
```

Expected: all API tests pass, including the original mapping/error tests and the new cache tests.

- [ ] **Step 5: Commit the API cache**

```bash
git add src/api.js src/api.test.js
git commit -m "perf: cache episode pages and deduplicate requests"
```

### Task 3: Replace `backHash` with history depth and preserve query state

**Files:**
- Modify: `src/App.jsx:1-459`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add failing navigation regression tests**

Add tests covering nested Back, query persistence, direct-link fallback, and route scroll restoration:

```js
it('walks back through search and albums without getting stuck', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  fireEvent.change(await screen.findByRole('searchbox', { name: '搜索专辑' }), { target: { value: 'NIO' } });
  fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
  fireEvent.click(await screen.findByRole('button', { name: '返回专辑列表' }));
  expect(window.location.hash).toBe('#/search?q=NIO');
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  await waitFor(() => expect(window.location.hash).toBe('#/albums'));
});

it('restores the directory scroll position after album detail', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await screen.findByRole('heading', { name: '全部专辑' });
  document.documentElement.scrollTop = 420;
  fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
  fireEvent.click(await screen.findByRole('button', { name: '返回专辑列表' }));
  await waitFor(() => expect(document.documentElement.scrollTop).toBe(420));
});
```

- [ ] **Step 2: Run the UI tests and confirm RED**

Run:

```bash
npm test -- src/App.test.jsx
```

Expected: the nested Back test fails because `backHash` is overwritten by the album route, and the query/scroll assertions fail because Search owns its query and every route screen change resets scroll.

- [ ] **Step 3: Implement history-aware navigation**

Initialize the first app entry with `{ nioDepth: 0 }`. Make `go(hash, { replace = false })` use `history.pushState` with incremented `nioDepth` for internal navigation and `history.replaceState` for query edits. Update route state on both `popstate` and `hashchange`. Make `goBack` call `history.back()` when `nioDepth > 0`; otherwise use Home for Search and Albums for Album. Keep queue open/close as push/replace operations that preserve query parameters.

Add a route-keyed `Map` ref for scroll positions. Before pushing a route save the current scroll, and in an effect after route changes restore the saved position or set both document scroll roots to zero. Set and restore `history.scrollRestoration = 'manual'` on mount. Remove `backHash` and its setter entirely.

Pass `route.searchQuery` into `SearchScreen`. Make the input update the current hash query through a stable callback using `history.replaceState`, and make Search derive its filtered rows from that prop. Album navigation therefore returns to the exact query URL.

- [ ] **Step 4: Run the focused UI tests GREEN**

Run:

```bash
npm test -- src/App.test.jsx
```

Expected: all existing and new navigation tests pass.

- [ ] **Step 5: Commit the navigation repair**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "fix: restore nested navigation and view state"
```

### Task 4: Isolate catalog renders during playback updates

**Files:**
- Modify: `src/App.jsx:1-322,445-456`
- Modify: `src/App.css:195-205`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add a failing render-isolation test**

Export `AlbumResults` as a named component and add a Profiler harness in `src/App.test.jsx`:

```jsx
it('does not rerender memoized album results when an unrelated parent updates', () => {
  let commits = 0;
  function Harness() {
    const [, setTick] = useState(0);
    return <><button type="button" onClick={() => setTick(value => value + 1)}>tick</button><Profiler id="albums" onRender={() => { commits += 1; }}><AlbumResults albums={catalog.albums} onOpenAlbum={() => {}} /></Profiler></>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'tick' }));
  fireEvent.click(screen.getByRole('button', { name: 'tick' }));
  expect(commits).toBe(1);
});
```

Import `Profiler` and `useState` from React and the named `AlbumResults` export. The same memoized component is used by Albums and Search, so this test directly proves the shared list boundary does not rerender for unrelated parent state.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/App.test.jsx -t "does not rerender memoized album results"
```

Expected: the Profiler records three commits because the un-memoized `AlbumResults` function rerenders on both parent updates.

- [ ] **Step 3: Memoize screens and stabilize callbacks**

Import `memo`, wrap `AlbumResults`, `SearchScreen`, `AlbumsScreen`, and `AlbumScreen` with `memo`, and use `useCallback` for Home, Albums, Search, Album, queue, and retry callbacks passed from `App`. Keep the active Home screen dependent on player progress. Add:

```css
.album-results li {
  content-visibility: auto;
  contain-intrinsic-size: 0 92px;
}
```

Leave unsupported browsers on the normal layout path and do not introduce list virtualization.

- [ ] **Step 4: Run UI tests and lint**

Run:

```bash
npm test -- src/App.test.jsx
npm run lint
```

Expected: all UI tests pass and Oxlint reports no errors.

- [ ] **Step 5: Commit render isolation**

```bash
git add src/App.jsx src/App.css src/App.test.jsx
git commit -m "perf: isolate catalog renders from playback progress"
```

### Task 5: Configure catalog precache and bounded artwork caching

**Files:**
- Modify: `src/catalog.js:57-69`
- Modify: `vite.config.js:5-31`
- Create: `src/pwa.test.js`

- [ ] **Step 1: Add failing PWA/cache configuration tests**

Add a source-level test that reads `vite.config.js` as text and asserts the config includes JSON in `globPatterns`, a `CacheFirst` image route with `maxEntries: 150` and `maxAgeSeconds: 30 * 24 * 60 * 60`, and no runtime cache route matching audio. Add a catalog test that spies on the fetch options and expects no `cache: 'no-store'` value.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
npm test -- src/pwa.test.js src/catalog.test.js
```

Expected: the PWA assertions fail because only default precache assets are configured, and the catalog test fails because `loadCatalog` explicitly requests `no-store`.

- [ ] **Step 3: Implement the cache configuration**

Change `loadCatalog` to use the default fetch cache behavior. In `vite.config.js`, configure:

```js
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
  runtimeCaching: [{
    urlPattern: ({ request }) => request.destination === 'image',
    handler: 'CacheFirst',
    options: {
      cacheName: 'nio-artwork-v1',
      cacheableResponse: { statuses: [0, 200] },
      expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  }],
},
```

Do not add any audio runtime route. Keep localStorage fallback behavior unchanged.

- [ ] **Step 4: Run tests and build GREEN**

Run:

```bash
npm test -- src/pwa.test.js src/catalog.test.js
npm run build
```

Expected: tests pass, the generated service worker contains `albums.json` in its precache manifest and the artwork runtime route, and the build exits 0.

- [ ] **Step 5: Commit PWA caching**

```bash
git add src/catalog.js vite.config.js src/pwa.test.js
git commit -m "perf: cache catalog and artwork assets"
```

### Task 6: Full verification and GitHub Pages deployment

**Files:**
- No additional source files unless a verification failure identifies a defect.

- [ ] **Step 1: Run the complete local gate**

Run each command separately:

```bash
npm test -- --reporter=dot
npm run lint
npm run build
npm audit --audit-level=high
git diff --check
```

Expected: all tests pass, lint/build/audit exit 0, and `git diff --check` prints no whitespace errors.

- [ ] **Step 2: Run mobile browser checks**

Start the built app with `npm run preview -- --host 127.0.0.1`, inspect at 320x568 and 390x844, and verify Home -> Albums -> Search -> Album -> Back twice, query restoration, directory scroll restoration, repeated episode-page cache behavior, queue Back behavior, and no console errors.

- [ ] **Step 3: Push source and publish Pages**

Confirm `git status --short` contains only intended commits, push `main`, and run:

```bash
npm run deploy
```

Expected: GitHub Pages publishes the new `dist` output successfully.

- [ ] **Step 4: Smoke-test the live site**

Verify `https://icekale.github.io/nio-podcast-web/` loads, the service worker and manifest use `/nio-podcast-web/`, `data/albums.json` returns 200, nested Back works, and selecting an album still loads episodes and audio.

- [ ] **Step 5: Commit any verification-only fixes**

If a defect is found, add its regression test first, run the RED-GREEN cycle, then commit only the implicated files with a focused message. Re-run the complete local gate before reporting completion.
