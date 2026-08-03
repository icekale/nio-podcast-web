# PC UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add desktop interaction feedback and motion across six areas while keeping mobile behavior unchanged.

**Architecture:** CSS-only motion at the `min-width: 1024px` breakpoint, plus a small debounce in `SearchScreen` and a desktop-only player closing presence in `App`.

**Tech Stack:** React 19, CSS, Vitest, React Testing Library

---

### Task 1: Sidebar transitions and install fade

**Files:**
- Modify: `src/App.css` desktop media block

- [ ] **Step 1: Add transitions and install animation**

```css
  .desktop-nav-link { transition: background-color 160ms ease, color 160ms ease; }
  .desktop-nav-install { animation: desktop-install-in 200ms ease-out both; }
  @keyframes desktop-install-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
```

### Task 2: Album hover feedback

**Files:**
- Modify: `src/App.css` desktop media block

- [ ] **Step 1: Add grid hover/press and row hover**

```css
  .album-results.is-grid .album-result { transition: transform 160ms ease, box-shadow 160ms ease; }
  .album-results.is-grid .album-result:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(9, 28, 47, 0.10); }
  .album-results.is-grid .album-result:active { transform: scale(0.98); }
  .album-result:hover { background: var(--surface-soft); }
```

### Task 3: Desktop player entrance and exit

**Files:**
- Modify: `src/App.jsx` `MiniPlayer` and `App`
- Modify: `src/App.css` desktop media block

- [ ] **Step 1: Add the player closing presence**

In `MiniPlayer`, accept `isClosing` and `onExited`, add the class, and handle `animationend`:

```jsx
function MiniPlayer({ player, isPlaying, audioError, onToggle, onRetry, onOpenQueue, queueButtonRef, onSeek, isClosing = false, onExited }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
```

In `App`, add visible/closing state and a last-episode ref:

```jsx
  const [playerVisible, setPlayerVisible] = useState(() => Boolean(player.currentEpisode));
  const [playerClosing, setPlayerClosing] = useState(false);
  const lastEpisodeRef = useRef(player.currentEpisode);

  useEffect(() => { if (player.currentEpisode) lastEpisodeRef.current = player.currentEpisode; }, [player.currentEpisode]);
  useEffect(() => {
    if (player.currentEpisode) { setPlayerVisible(true); setPlayerClosing(false); return; }
    if (!playerVisible) return;
    if (!desktopLayout) { setPlayerVisible(false); return; }
    setPlayerClosing(true);
  }, [desktopLayout, player.currentEpisode, playerVisible]);
  const handlePlayerExited = useCallback(() => { setPlayerVisible(false); setPlayerClosing(false); }, []);
  useEffect(() => {
    if (!playerClosing) return undefined;
    const timer = window.setTimeout(handlePlayerExited, 220);
    return () => window.clearTimeout(timer);
  }, [playerClosing, handlePlayerExited]);
```

Render the player from the visible state and substitute the last episode while closing:

```jsx
      {playerVisible ? <MiniPlayer player={player.currentEpisode ? player : { ...player, currentEpisode: lastEpisodeRef.current }} isPlaying={isPlaying} audioError={audioError} onToggle={togglePlayback} onRetry={...} onOpenQueue={openQueue} queueButtonRef={queueButtonRef} onSeek={updatePosition} isClosing={playerClosing} onExited={handlePlayerExited} /> : null}
```

- [ ] **Step 2: Add desktop player keyframes**

```css
  .mini-player { animation: mini-player-in 200ms ease-out both; }
  .mini-player.is-closing { animation: mini-player-out 180ms ease-in both; }
  @keyframes mini-player-in { from { opacity: 0; transform: translate3d(-50%, 100%, 0); } to { opacity: 1; transform: translate3d(-50%, 0, 0); } }
  @keyframes mini-player-out { from { opacity: 1; transform: translate3d(-50%, 0, 0); } to { opacity: 0; transform: translate3d(-50%, 100%, 0); } }
```

### Task 4: Search debounce and count pop

**Files:**
- Modify: `src/App.jsx` `SearchScreen`
- Modify: `src/App.css`

- [ ] **Step 1: Debounce filtering**

In `SearchScreen`, add:

```jsx
  const [query, setQuery] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query), 120); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => setQuery(searchQuery), [searchQuery]);
```

Use `query` for the input and `debouncedQuery` for filtering. Give the count a key and pop animation:

```jsx
        <div className="section-heading-row"><h1>全部专辑</h1><span key={filtered.length} className="section-count" aria-live="polite">{filtered.length}</span></div>
```

- [ ] **Step 2: Add the count pop keyframes**

```css
  .section-count { display: inline-block; animation: count-pop 160ms ease-out; }
  @keyframes count-pop { from { opacity: 0.4; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
```

### Task 5: Desktop route motion

**Files:**
- Modify: `src/App.css` desktop media block

- [ ] **Step 1: Override route keyframes and duration**

```css
  .route-view[data-route-motion="forward"], .route-view[data-route-motion="back"] { animation-duration: 240ms; }
  @keyframes route-forward-in { from { opacity: 0; transform: translate3d(0, 8px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
  @keyframes route-back-in { from { opacity: 0; transform: translate3d(0, -8px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
```

### Task 6: Drawer row stagger

**Files:**
- Modify: `src/App.jsx` `QueueSheet` and `LaterQueueRow`
- Modify: `src/App.css`

- [ ] **Step 1: Add row delay variables**

On normal queue rows and `LaterQueueRow` `<li>`, add `style={{ '--i': Math.min(index, 8) }}`.

- [ ] **Step 2: Add desktop stagger CSS**

```css
  .queue-list > li { animation: queue-row-in 220ms ease-out both; animation-delay: calc(var(--i, 0) * 30ms); }
  @keyframes queue-row-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 3: Zero delays under reduced motion**

In the reduced-motion rule, add `animation-delay: 0ms !important;`.

### Task 7: Tests, verification, and commit

**Files:**
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Add CSS contract assertions**

Assert the desktop nav transition, grid hover, player keyframes, route 8px keyframes, row stagger, and reduced-motion delay override.

- [ ] **Step 2: Run all checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint exits `0`, build completes, and `git diff --check` prints nothing.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/App.jsx src/App.css src/scroll-render.test.js
git commit -m "polish: refine pc interaction motion"
```

### Task 8: Merge, deploy, and verify

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/pc-ui-polish
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

Then watch the Pages run and confirm the live site serves the newest assets.
