# Review Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four review findings: pointer capture for drag reorder, restored player-state alignment, single queue advancement on audio end, and removal of legacy catalog cache helpers.

**Architecture:** Keep each fix minimal and local. `playerState.js` enforces the current-episode-in-queue invariant at restore time; `App.jsx` captures pointers during drag and advances the queue once on ended; `api.js` drops unused legacy exports.

**Tech Stack:** React 19, Vitest, React Testing Library

---

### Task 1: Enforce player-state consistency on restore

**Files:**
- Modify: `src/playerState.js:76-91`
- Test: `src/playerState.test.js`

- [ ] **Step 1: Add the failing restore-alignment test**

Append to `describe('player state', ...)`:

```js
  it('aligns a persisted current episode that is missing from the queue', () => {
    const raw = {
      version: 2,
      currentEpisode: episode(9),
      queue: [episode(1), episode(2)],
      queueIndex: 1,
      history: [],
      positionSeconds: 5,
      durationSeconds: 60,
      updatedAt: 0,
    };
    const restored = restorePlayerState(JSON.stringify(raw));
    expect(restored.currentEpisode.id).toBe(2);
    expect(restored.queueIndex).toBe(1);
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- src/playerState.test.js -t "aligns a persisted current episode"
```

Expected: fails because the restored `currentEpisode` is `9`.

- [ ] **Step 3: Implement the alignment**

In `restorePlayerState`, replace the `currentEpisode` selection with:

```js
    const persistedCurrent = normalizeEpisode(parsed.currentEpisode);
    const currentInQueue = Boolean(persistedCurrent) && queue.some(item => episodeKey(item) === episodeKey(persistedCurrent));
    const currentEpisode = currentInQueue ? persistedCurrent : queue[queueIndex] || null;
```

Use `currentEpisode` in the returned object instead of the old expression.

- [ ] **Step 4: Run the test and confirm it passes**

Run:

```bash
npm test -- src/playerState.test.js -t "aligns a persisted current episode"
```

Expected: 1 test passes.

### Task 2: Add pointer capture to drag reorder

**Files:**
- Modify: `src/App.jsx:484-549`
- Test: `src/App.later-playback.test.jsx`

- [ ] **Step 1: Add the failing pointer-capture test**

Append to `describe('later playback integration', ...)`:

```jsx
  it('captures and releases the pointer during a long-press drag', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const row = within(dialog).getByText('第二集').closest('.later-row');
    row.setPointerCapture = vi.fn();
    row.releasePointerCapture = vi.fn();
    row.hasPointerCapture = vi.fn(() => true);

    vi.useFakeTimers();
    fireEvent.pointerDown(row, { pointerId: 2, clientX: 180, clientY: 160, pointerType: 'touch' });
    vi.advanceTimersByTime(250);
    fireEvent.pointerMove(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });
    fireEvent.pointerUp(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });

    expect(row.setPointerCapture).toHaveBeenCalledWith(2);
    expect(row.releasePointerCapture).toHaveBeenCalledWith(2);
    expect(row).not.toHaveClass('is-dragging');
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- src/App.later-playback.test.jsx -t "captures and releases the pointer"
```

Expected: fails because `setPointerCapture` is never called.

- [ ] **Step 3: Implement pointer capture at gesture start**

Capture only when a gesture becomes a swipe or drag so a normal tap keeps targeting the row button:

In `handlePointerDown`, record the element and pointer id on the gesture:

```js
    gestureRef.current = { startX: event.clientX, startY: event.clientY, mode: 'pending', element: event.currentTarget, pointerId: event.pointerId };
```

In the long-press timer, capture when entering drag mode:

```js
      longPressRef.current = window.setTimeout(() => {
        const gesture = gestureRef.current;
        if (gesture?.mode === 'pending') {
          gesture.mode = 'drag';
          gesture.element?.setPointerCapture?.(gesture.pointerId);
          setDragging(true);
        }
      }, 250);
```

In `handlePointerMove`, capture when the pending gesture becomes a swipe:

```js
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -12) {
        gesture.mode = 'swipe';
        gesture.element?.setPointerCapture?.(gesture.pointerId);
        setSwiped(true);
        event.preventDefault();
      } else {
        gesture.mode = 'cancelled';
      }
```

In `handlePointerUp`, before clearing `gestureRef.current`, release the capture:

```js
    if (gesture.element?.hasPointerCapture?.(gesture.pointerId)) {
      gesture.element.releasePointerCapture?.(gesture.pointerId);
    }
```

Update the `onPointerCancel` inline handler on the `<li>` to release capture:

```jsx
onPointerCancel={event => {
  clearLongPress();
  const gesture = gestureRef.current;
  if (gesture?.element?.hasPointerCapture?.(gesture.pointerId)) {
    gesture.element.releasePointerCapture?.(gesture.pointerId);
  }
  gestureRef.current = null;
  setDragging(false);
}}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:

```bash
npm test -- src/App.later-playback.test.jsx -t "captures and releases the pointer"
```

Expected: 1 test passes.

### Task 3: Advance the queue once on audio end

**Files:**
- Modify: `src/App.jsx:995-1008`
- Test: `src/App.later-playback.test.jsx`

- [ ] **Step 1: Add the failing single-advance test**

Append to `describe('later playback integration', ...)`:

```jsx
  it('advances to the next episode once when playback ends', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第一集');

    fireEvent.ended(document.querySelector('audio'));

    await waitFor(() => expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第二集'));
  });
```

- [ ] **Step 2: Run the test and confirm it passes before the refactor**

Run:

```bash
npm test -- src/App.later-playback.test.jsx -t "advances to the next episode once"
```

Expected: passes with the current implementation; the test locks the behavior for the refactor.

- [ ] **Step 3: Replace the double advancement**

Replace the body of `handleEnded` with:

```js
  const handleEnded = useCallback(() => {
    const previous = playerRef.current;
    const completedEpisode = previous.currentEpisode;
    if (completedEpisode) removeFromLater(completedEpisode.id);
    const next = advanceQueue(previous);
    const hasNext = Boolean(next.currentEpisode && next.currentEpisode.id !== previous.currentEpisode?.id);
    setPlayer({
      ...next,
      history: hasNext ? recordHistory(previous.history, next.currentEpisode) : previous.history,
      isPlaying: hasNext,
    });
    setIsPlaying(hasNext);
  }, [removeFromLater]);
```

- [ ] **Step 4: Run the test and the full later-playback suite**

Run:

```bash
npm test -- src/App.later-playback.test.jsx
```

Expected: all later-playback tests pass.

### Task 4: Remove legacy catalog cache helpers

**Files:**
- Modify: `src/api.js`
- Test: `src/api.test.js`

- [ ] **Step 1: Delete the unused legacy exports**

Remove from `src/api.js`:

```js
const CACHE_KEY = 'nio_catalog_cache_v1';
```

and the whole block from `getCachedAlbums` through `ALL_SEED_IDS`, inclusive.

Keep `normalizeAudioUrl`, `ApiError`, `clearEpisodeCache`, `episodeCache`, `episodeRequests`, `requestEpisodes`, and `getEpisodes`.

- [ ] **Step 2: Run the API test suite**

Run:

```bash
npm test -- src/api.test.js
```

Expected: all API tests pass with the legacy exports removed.

- [ ] **Step 3: Confirm nothing else imports the removed symbols**

Run:

```bash
rg -n "discoverAlbums|getCachedAlbums|setCachedAlbums|SEED_ALBUMS|ALL_SEED_IDS|CACHE_KEY" src scripts || true
```

Expected: no matches.

### Task 5: Full verification and commit

**Files:**
- No additional files.

- [ ] **Step 1: Run all repository checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint exits `0`, the Vite build completes, and `git diff --check` prints nothing.

- [ ] **Step 2: Commit the fixes**

Run:

```bash
git add src/playerState.js src/playerState.test.js src/App.jsx src/App.later-playback.test.jsx src/api.js
git commit -m "fix: resolve review findings"
```

Expected: one commit lists exactly those five source/test files.

### Task 6: Merge, deploy, and verify the live site

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main**

Run from the main worktree:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/review-fix-round2
```

Expected: `main` advances to the fix commit; the untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` stays untouched.

- [ ] **Step 2: Push and monitor Pages deployment**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: the push succeeds and a Pages run starts.

- [ ] **Step 3: Verify the live endpoints**

Run:

```bash
gh run watch --repo icekale/nio-podcast-web "$(gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
curl -fsS https://nio.k4le.top/ | rg -o 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u
```

Expected: the workflow succeeds and the live page references the newest build assets.
