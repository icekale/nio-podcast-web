# NIO Radio Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the reliability, deployment, mobile interaction, accessibility, and playback-rendering issues found in the 2026-08-03 code review without redesigning the product.

**Architecture:** Keep the existing React/Vite PWA and GitHub Pages deployment. Strengthen the catalog generator with explicit scan results and real request cancellation, make publication failure-safe, replace clipped row popovers with contained mobile action panels, and isolate queue rendering from high-frequency playback position updates.

**Tech Stack:** React 19, Vite 8, Vitest, Testing Library, oxlint, vite-plugin-pwa, GitHub Actions, gh-pages

---

## Scope And Success Criteria

- A temporary failure during a full scan must not remove the affected album from `public/data/albums.json`.
- A full scan that would explicitly remove more than 10% of the previous catalog must fail without writing the file.
- Timed-out catalog requests must be aborted, and live network requests must stay within the configured concurrency.
- Tests, lint, and production build must complete before either deployment branch or `main` is updated.
- A failed Pages deployment must leave `main` unchanged so the next run can retry the same catalog change.
- Every visible area of an episode in the later-playback picker must add that episode.
- Queue action controls must remain visible inside the scroll sheet and have at least 44px touch targets.
- Queue tabs must support ArrowLeft, ArrowRight, Home, and End.
- Audio `timeupdate` events must not rerender an open queue whose queue/history content did not change.
- Both `https://nio.k4le.top/` and the legacy GitHub Pages URL must still resolve after release.

## Files

- Modify `scripts/catalog-generator.js`: return scan diagnostics and abort timed-out fetches.
- Modify `scripts/generate-catalog.mjs`: merge failed full-scan IDs and reject suspicious catalog shrinkage.
- Modify `scripts/catalog-generator.test.js`: cover aborts, preservation, and shrinkage rejection.
- Modify `.github/workflows/update-catalog.yml`: verify and deploy before committing catalog state.
- Modify `scripts/workflow-config.test.js`: enforce workflow ordering and failure-safe publication.
- Modify `src/App.jsx`: fix later-picker actions, contained menus, tabs, and queue render isolation.
- Modify `src/App.css`: contained action panel and 44px targets.
- Modify `src/App.later-playback.test.jsx`: cover full-row add and visible action controls.
- Modify `src/App.test.jsx`: cover tab keyboard behavior and queue render isolation.
- Modify `README.md`: replace the Vite template with operation and recovery instructions.
- Do not add a state library, backend service, or new UI theme.

### Task 1: Make Catalog Scans Loss-Tolerant And Abortable

**Files:**
- Modify: `scripts/catalog-generator.js:39-106`
- Modify: `scripts/generate-catalog.mjs:27-44`
- Test: `scripts/catalog-generator.test.js`

- [ ] **Step 1: Write failing scan-diagnostic and abort tests**

Add tests that require `scanCatalog` to return `albums`, `failedIds`, and `missingIds`, and that observe an aborted signal after timeout:

```js
it('reports failed and explicitly missing album ids separately', async () => {
  const result = await scanCatalog([1, 2, 3], async id => {
    if (id === 2) throw new Error('temporary failure');
    if (id === 3) return null;
    return { id, latestEpisode: { id: 10, onlineTime: 1 } };
  }, 2);

  expect(result.albums.map(album => album.id)).toEqual([1]);
  expect(result.failedIds).toEqual([2]);
  expect(result.missingIds).toEqual([3]);
});

it('aborts a timed-out request', async () => {
  let observedSignal;
  await scanCatalog([1], (_id, signal) => new Promise((resolve, reject) => {
    observedSignal = signal;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), 1, 5);
  expect(observedSignal.aborted).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- scripts/catalog-generator.test.js`

Expected: FAIL because `scanCatalog` currently returns an array and never supplies an abort signal.

- [ ] **Step 3: Implement abortable scan results**

Change the timeout helper to create an `AbortController`, pass its signal into the request factory, and return structured scan diagnostics:

```js
async function withTimeout(request, timeoutMs, id) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Album ${id}: request timed out`)),
    timeoutMs,
  );
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function scanCatalog(ids, requestAlbum, concurrency = 12, requestTimeoutMs = 15000) {
  const albums = [];
  const failedIds = [];
  const missingIds = [];
  // Keep the existing cursor/worker model; each worker awaits its active request.
  // Call requestAlbum(id, signal), classify null as missing, and classify throws as failed.
  return {
    albums: sortGeneratedAlbums(albums),
    failedIds: failedIds.sort((a, b) => a - b),
    missingIds: missingIds.sort((a, b) => a - b),
  };
}
```

Update `requestAlbum(id, fetchImpl, signal)` to pass `signal` to `fetchImpl`. Update `buildCatalog` and `updateKnownAlbums` to consume `result.albums`; incremental mode must continue preserving both failed and explicitly missing known albums.

- [ ] **Step 4: Add full-scan merge and shrinkage tests**

Export a pure helper from `generate-catalog.mjs` or `catalog-generator.js` and test it directly:

```js
it('preserves previous albums whose full refresh failed', () => {
  const previous = [album(1), album(2)];
  const scan = { albums: [updatedAlbum(1)], failedIds: [2], missingIds: [] };
  expect(finalizeFullCatalog(previous, scan).map(item => item.id)).toEqual([1, 2]);
});

it('rejects an explicit full-scan drop greater than ten percent', () => {
  const previous = Array.from({ length: 20 }, (_, index) => album(index + 1));
  const scan = { albums: previous.slice(0, 17), failedIds: [], missingIds: [18, 19, 20] };
  expect(() => finalizeFullCatalog(previous, scan)).toThrow(/shrink/i);
});
```

- [ ] **Step 5: Implement full-scan finalization**

`finalizeFullCatalog(previousAlbums, scanResult)` must:

1. Merge old records only for IDs in `failedIds`.
2. Allow explicit missing results to remove albums when total shrinkage is at most 10%.
3. Throw before `writeCatalogAtomically` when shrinkage exceeds 10%.
4. Continue refusing an empty final catalog.
5. Log discovered, preserved, missing, and failed counts in `generate-catalog.mjs`.

- [ ] **Step 6: Run generator tests**

Run: `npm test -- scripts/catalog-generator.test.js`

Expected: all catalog generator tests PASS, including the new abort and preservation cases.

- [ ] **Step 7: Commit catalog reliability changes**

```bash
git add scripts/catalog-generator.js scripts/generate-catalog.mjs scripts/catalog-generator.test.js
git commit -m "fix: preserve catalog during partial scans"
```

### Task 2: Make Catalog Publication Failure-Safe

**Files:**
- Modify: `.github/workflows/update-catalog.yml:73-101`
- Modify: `scripts/workflow-config.test.js`

- [ ] **Step 1: Write a failing workflow-order test**

Parse the workflow as text and assert strict ordering:

```js
const generate = workflow.indexOf('- name: Generate catalog');
const test = workflow.indexOf('- name: Test application');
const lint = workflow.indexOf('- name: Lint application');
const build = workflow.indexOf('- name: Build PWA');
const deploy = workflow.indexOf('- name: Deploy GitHub Pages');
const commit = workflow.indexOf('- name: Commit catalog state');

expect(generate).toBeLessThan(test);
expect(test).toBeLessThan(lint);
expect(lint).toBeLessThan(build);
expect(build).toBeLessThan(deploy);
expect(deploy).toBeLessThan(commit);
```

Also assert that test, lint, build, deploy, and commit all use `if: steps.changes.outputs.changed == 'true'`.

- [ ] **Step 2: Run the focused workflow test and confirm failure**

Run: `npm test -- scripts/workflow-config.test.js`

Expected: FAIL because commit currently precedes build/deploy and no test/lint steps exist.

- [ ] **Step 3: Reorder the workflow**

Use this order after the change detector:

```yaml
- name: Test application
  if: steps.changes.outputs.changed == 'true'
  run: npm test

- name: Lint application
  if: steps.changes.outputs.changed == 'true'
  run: npm run lint

- name: Build PWA
  if: steps.changes.outputs.changed == 'true'
  run: npm run build

- name: Deploy GitHub Pages
  if: steps.changes.outputs.changed == 'true'
  run: npm run deploy

- name: Commit catalog state
  if: steps.changes.outputs.changed == 'true'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add public/data/albums.json
    git commit -m "chore: update podcast catalog"
    git pull --rebase origin main
    git push origin HEAD:main
```

Deploying before the source commit is intentional: a failed deployment leaves the catalog diff on the runner and leaves `main` unchanged, so the next scheduled run retries it. `git pull --rebase` handles a normal concurrent main update without force-pushing.

- [ ] **Step 4: Run workflow and full tests**

Run: `npm test -- scripts/workflow-config.test.js && npm test`

Expected: focused test and all project tests PASS.

- [ ] **Step 5: Commit workflow safety changes**

```bash
git add .github/workflows/update-catalog.yml scripts/workflow-config.test.js
git commit -m "ci: verify catalog before publication"
```

### Task 3: Fix Mobile Later-Playback Actions

**Files:**
- Modify: `src/App.jsx:100-143,355-525,610-616`
- Modify: `src/App.css:180-199,279-308`
- Test: `src/App.later-playback.test.jsx`

- [ ] **Step 1: Write failing full-row-add and action-panel tests**

Add a test that enters the later picker, selects an album, clicks the episode title rather than the plus icon, and expects the success status plus persisted episode.

Add a second test that opens `管理 第二集` and expects its row to receive `is-menu-open`, with the action panel contained inside that row rather than rendered below an overflow-clipped anchor.

- [ ] **Step 2: Run the focused UI test and confirm failure**

Run: `npm test -- src/App.later-playback.test.jsx`

Expected: FAIL because the episode body invokes a no-op and menu rows have no contained open state.

- [ ] **Step 3: Make the picker row perform the add action**

Extend `EpisodeRow` with an optional `mainLabel`, then use:

```jsx
<EpisodeRow
  key={episode.id}
  episode={episode}
  mainLabel={`添加 ${episode.title} 到稍后播放`}
  onPlay={() => onAdd(episode)}
  action={/* existing plus button */}
/>
```

Do not remove the explicit plus button; it remains a familiar secondary target. Duplicate additions continue to use the existing “已在稍后播放” notice.

- [ ] **Step 4: Contain row actions inside expanded rows**

Add `is-menu-open` to queue rows while their action panel is open. Keep the panel anchored visually under the three-dot button, but reserve enough row space for it so the panel remains inside the row and scroll container. Use a shared `row-action-menu` treatment for current queue and later queue; do not add a portal or third-party popover dependency.

```css
.queue-row.is-menu-open { padding-bottom: 7.5rem; }
.row-action-menu { min-width: 8rem; }
.row-action-menu button { min-height: 2.75rem; }
```

When opening one menu, close any prior menu in that list. Set `aria-expanded`, `aria-haspopup="menu"`, and a stable `aria-controls` on each three-dot trigger.

- [ ] **Step 5: Run later-playback tests**

Run: `npm test -- src/App.later-playback.test.jsx`

Expected: all later-playback tests PASS.

- [ ] **Step 6: Commit mobile interaction fixes**

```bash
git add src/App.jsx src/App.css src/App.later-playback.test.jsx
git commit -m "fix: make later playback actions reliable"
```

### Task 4: Add Queue Keyboard Support And Isolate Rendering

**Files:**
- Modify: `src/App.jsx:530-620,628-961`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write a failing queue-tab keyboard test**

Open the queue, focus the selected tab, press ArrowRight, and assert that “最近听过” becomes selected and focused. Repeat with End and Home for the last and first tabs.

- [ ] **Step 2: Implement roving queue tabs**

Give only the selected tab `tabIndex={0}` and the other tabs `tabIndex={-1}`. In a tab-list key handler, map ArrowRight/ArrowLeft/Home/End to the next tab, call `selectTab`, and focus the selected tab by ID. Preserve click behavior and the existing `aria-controls` relationship.

- [ ] **Step 3: Write a failing queue render-isolation test**

Export the memoized queue sheet for testing or add the existing test-only `onRender` pattern. Render an open queue, record its render count, dispatch `loadedMetadata` and multiple `timeUpdate` events, and assert the queue render count is unchanged.

- [ ] **Step 4: Replace the unstable player object prop**

Wrap `QueueSheet` with `memo` and pass only stable queue data:

```jsx
<QueueSheet
  queue={player.queue}
  history={player.history}
  currentEpisodeId={player.currentEpisode?.id}
  laterEpisodes={laterEpisodes}
  // existing stable callbacks and catalog props
/>
```

Create stable callbacks that read current arrays from `playerRef` and `laterEpisodesRef`. Do not pass `positionSeconds`, `durationSeconds`, `isPlaying`, or the complete `player` object into `QueueSheet`.

- [ ] **Step 5: Stop reinstalling the pagehide listener**

Register `pagehide` once and save from `playerRef.current`:

```js
useEffect(() => {
  const save = () => savePlayer(playerRef.current, true);
  window.addEventListener('pagehide', save);
  return () => window.removeEventListener('pagehide', save);
}, [savePlayer]);
```

- [ ] **Step 6: Run player and app tests**

Run: `npm test -- src/App.test.jsx src/playerState.test.js src/App.later-playback.test.jsx`

Expected: all focused tests PASS and queue rendering stays stable during progress updates.

- [ ] **Step 7: Commit accessibility and rendering changes**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "perf: isolate queue from playback progress"
```

### Task 5: Document Operations And Recovery

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the Vite template README**

Document:

- Local commands: `npm ci`, `npm run dev`, `npm test`, `npm run lint`, `npm run build`.
- Catalog modes: `NIO_CATALOG_MODE=incremental npm run catalog` and `NIO_CATALOG_MODE=full npm run catalog`.
- Beijing weekday/weekend schedule and the 07:30 full scan.
- GitHub Pages deployment, `public/CNAME`, custom domain, and legacy redirect behavior.
- Recovery: rerun the failed workflow; never manually replace `albums.json` with a partial scan.
- Cache behavior: 15-minute foreground refresh cooldown, NetworkFirst catalog, bounded artwork cache, and no audio cache.

- [ ] **Step 2: Verify README commands against package scripts**

Run: `npm test && npm run lint && npm run build`

Expected: all commands documented in the README execute successfully.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md
git commit -m "docs: document catalog and deployment operations"
```

### Task 6: Final Audit, Release, And Live Verification

**Files:**
- Verify only; modify a prior task's files only if a test or audit exposes a regression.

- [ ] **Step 1: Run the complete automated verification**

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
git diff --check
```

Expected: all tests PASS, lint reports no errors, production PWA builds, audit reports zero production vulnerabilities, and `git diff --check` is silent.

- [ ] **Step 2: Run the `impeccable audit` again**

Audit mobile widths 320px, 375px, and 430px in both light and dark schemes. Verify:

- no menu is clipped at the first, middle, or final queue row;
- all action labels fit and touch targets measure at least 44px;
- keyboard focus stays visible and inside the queue dialog;
- reduced-motion disables route and sheet motion;
- rapid scrolling and playback progress updates do not disturb the sticky title or open queue.

- [ ] **Step 3: Push main and allow GitHub Pages to deploy**

Push only after Step 1 and Step 2 pass. Do not force-push.

- [ ] **Step 4: Verify both production entry points**

```bash
curl -sSIL --max-time 15 https://nio.k4le.top/
curl -sSIL --max-time 15 https://icekale.github.io/nio-podcast-web/
curl -sSf --max-time 15 https://nio.k4le.top/manifest.webmanifest
curl -sSf --max-time 15 https://nio.k4le.top/data/albums.json >/dev/null
```

Expected: the custom domain returns `200`; the legacy URL returns a GitHub-managed redirect followed by `200`; manifest and catalog return valid responses.

- [ ] **Step 5: Record release evidence**

Include the test count, build asset sizes, deployed commit SHA, workflow run URL, and the five `impeccable` scores in the completion report.

## Rollback

- Runtime/UI regression: revert the corresponding focused commit and redeploy; later-playback localStorage format is unchanged.
- Catalog regression: restore the last known-good `public/data/albums.json`, run the full verification, and deploy before committing the restoration.
- Workflow regression: manually dispatch the last known-good workflow in incremental mode after reverting the workflow commit.
- No database migration, service-worker cache migration, or storage-key migration is required by this plan.
