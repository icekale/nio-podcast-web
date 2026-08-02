# Scroll Rendering And Mobile Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the home-screen scroll/layout feedback loop and add lightweight, accessible transitions for album navigation and the playback queue.

**Architecture:** Keep the recommendation panel in the home document flow at all times; `scrolled` controls only the compact header. Track route transition direction separately from parsed hash state and animate only the destination screen with CSS. Keep the queue overlay mounted during its exit animation, then remove it on its own animation event or a short fallback timer.

**Tech Stack:** React 19, React Testing Library, Vitest, CSS keyframes, Vite, GitHub Pages.

---

### Task 1: Lock Down Home Scroll Stability

**Files:**
- Modify: `src/App.test.jsx` near the existing home-screen tests
- Modify: `src/App.jsx:92-154` in `HomeScreen`

- [ ] **Step 1: Write the failing regression tests**

Add these tests to `describe('mobile app shell', ...)`:

```jsx
it('keeps the recommendation panel mounted while the compact header changes', async () => {
  render(<App initialCatalog={catalog} />);

  Object.defineProperty(window, 'scrollY', { configurable: true, value: 220 });
  fireEvent.scroll(window);

  await waitFor(() => expect(document.querySelector('.top-title')).toHaveTextContent('今日推荐'));
  expect(document.querySelector('.recommendation-panel')).toBeInTheDocument();
  expect(document.querySelector('.updates-section')).toBeInTheDocument();
});

it('initializes the compact header from a restored scroll position', async () => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 220 });
  render(<App initialCatalog={catalog} />);

  await waitFor(() => expect(document.querySelector('.top-title')).toHaveTextContent('今日推荐'));
  expect(document.querySelector('.recommendation-panel')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

```bash
npm test -- src/App.test.jsx -t "recommendation panel|restored scroll position"
```

Expected: the first test fails because the existing scroll handler removes `.recommendation-panel`, and the second fails because `HomeScreen` does not initialize `scrolled` on mount.

- [ ] **Step 3: Implement the minimal stability fix**

In `HomeScreen`, initialize the scroll state and always render the recommendation section:

```jsx
useEffect(() => {
  const handleScroll = () => setScrolled(window.scrollY > 180);
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

Replace the conditional `{!scrolled ? (...) : null}` with an unconditional `<section className="recommendation-panel" ...>...</section>`. Keep the existing header title and continue button conditional on `scrolled`; do not remove or add any document-flow content from that state.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run:

```bash
npm test -- src/App.test.jsx -t "recommendation panel|restored scroll position"
```

Expected: 2 tests pass with no console errors.

- [ ] **Step 5: Commit the isolated fix**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "fix: keep home layout stable during scroll"
```

### Task 2: Add Directional Route Transitions

**Files:**
- Modify: `src/App.jsx` route state, route listeners, navigation callbacks, and screen wrapper
- Modify: `src/App.test.jsx` navigation tests
- Modify: `src/App.css` motion keyframes and route classes

- [ ] **Step 1: Write the failing route-motion tests**

Extend the existing album-directory test and add a duplicate-event test:

```jsx
it('marks Home to Albums navigation as forward and Back as back', async () => {
  render(<App initialCatalog={catalog} />);

  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await screen.findByRole('heading', { name: '全部专辑' });
  expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'forward');

  fireEvent.click(screen.getByRole('button', { name: '返回主页' }));
  await screen.findByRole('heading', { name: '今日推荐' });
  expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'back');
});

it('does not replay route motion for duplicate popstate and hashchange events', async () => {
  render(<App initialCatalog={catalog} />);

  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await screen.findByRole('heading', { name: '全部专辑' });
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new HashChangeEvent('hashchange'));

  expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'forward');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/App.test.jsx -t "route motion|duplicate popstate"
```

Expected: the tests fail because no `.route-view` or `data-route-motion` exists.

- [ ] **Step 3: Add route comparison and direction state**

Add small helpers beside the existing formatting helpers:

```jsx
function screenRouteKey(route) {
  return `${route.screen}:${route.albumId ?? ''}:${route.searchQuery ?? ''}`;
}

function sameRoute(previous, next) {
  return previous.screen === next.screen
    && previous.albumId === next.albumId
    && previous.searchQuery === next.searchQuery
    && previous.queueOpen === next.queueOpen;
}

function routeMotionFor(previous, next) {
  if (previous.screen === 'home' && next.screen === 'albums') return 'forward';
  if (previous.screen !== 'home' && next.screen === 'home') return 'back';
  if (previous.screen !== 'album' && next.screen === 'album') return 'forward';
  if (previous.screen === 'album' && next.screen !== 'album') return 'back';
  return 'none';
}
```

In `App`, keep a `routeRef` and an `applyRoute` callback. It must update route state when queue or search query changes, but set motion to `none` when `screenRouteKey` is unchanged:

```jsx
const [routeMotion, setRouteMotion] = useState('none');
const routeRef = useRef(route);

const applyRoute = useCallback(nextRoute => {
  const previousRoute = routeRef.current;
  if (sameRoute(previousRoute, nextRoute)) return;
  setRouteMotion(screenRouteKey(previousRoute) === screenRouteKey(nextRoute)
    ? 'none'
    : routeMotionFor(previousRoute, nextRoute));
  routeRef.current = nextRoute;
  setRoute(nextRoute);
}, []);
```

Use `applyRoute` in the hash/popstate listener, `go`, and `updateSearchQuery`. Wrap the existing four route conditionals unchanged inside a keyed route view; the wrapper is the only new element:

```jsx
const routeViewKey = screenRouteKey(route);

<div key={routeViewKey} className="route-view" data-route-motion={routeMotion}>
  {/* existing Home, Albums, Search, and Album conditionals stay here unchanged */}
</div>
```

Keep the queue query outside `routeViewKey`, so opening or closing the queue does not reanimate the underlying page. Change the existing route restoration effect to `useLayoutEffect` and keep its current per-route scroll map behavior.

- [ ] **Step 4: Add the CSS entrance motion**

Add classes and keyframes to `src/App.css`:

```css
.route-view { min-height: 100%; }
.route-view[data-route-motion="forward"] { animation: route-forward-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.route-view[data-route-motion="back"] { animation: route-back-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes route-forward-in {
  from { opacity: 0; transform: translate3d(16px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes route-back-in {
  from { opacity: 0; transform: translate3d(-16px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
```

The existing `prefers-reduced-motion` rule must reduce these animations to its immediate duration. Do not animate the sticky header or the fixed mini-player separately.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- src/App.test.jsx -t "route motion|duplicate popstate"
```

Expected: 2 tests pass. Then commit:

```bash
git add src/App.jsx src/App.test.jsx src/App.css
git commit -m "feat: add directional route transitions"
```

### Task 3: Add Queue Presence And Exit Motion

**Files:**
- Modify: `src/App.jsx:270-326, 335-512` for `QueueSheet`, queue presence, and focus restoration
- Modify: `src/App.test.jsx` queue tests
- Modify: `src/App.css:244-255` queue overlay rules and keyframes

- [ ] **Step 1: Write the failing queue lifecycle tests**

Update the existing queue-close test and add focus/presence coverage:

```jsx
it('keeps the queue mounted during its closing animation and restores focus', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  const trigger = await screen.findByRole('button', { name: '打开播放列表' });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog', { name: '播放列表' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '收起播放列表' }));

  fireEvent.click(screen.getByRole('button', { name: '关闭播放列表' }));
  expect(dialog).toHaveClass('is-closing');
  expect(window.location.hash).toBe('#/');
  expect(screen.getByRole('dialog', { name: '播放列表' })).toBeInTheDocument();

  fireEvent.animationEnd(dialog, { animationName: 'queue-sheet-out' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
  expect(document.activeElement).toBe(trigger);
});

it('uses the same closing state for Escape', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  await fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  const dialog = await screen.findByRole('dialog', { name: '播放列表' });

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(dialog).toHaveClass('is-closing');
  fireEvent.animationEnd(dialog, { animationName: 'queue-sheet-out' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
});
```

- [ ] **Step 2: Run the queue tests and verify the expected failure**

Run:

```bash
npm test -- src/App.test.jsx -t "closing animation|same closing state"
```

Expected: the tests fail because the current queue is unmounted immediately and has no `is-closing` class or focus restoration.

- [ ] **Step 3: Add queue presence state and a single dismissal lifecycle**

Keep `queuePresent` and `queueClosing` in `App`. Initialize `queuePresent` from the initial parsed route. On `route.queueOpen`, mount and clear closing state; when the route becomes closed while the queue is present, set closing state and keep rendering `QueueSheet`. Pass `isClosing` and `onExited` to the sheet:

```jsx
const [queuePresent, setQueuePresent] = useState(() => route.queueOpen);
const [queueClosing, setQueueClosing] = useState(false);
const queueFocusRef = useRef(null);

useEffect(() => {
  if (route.queueOpen) {
    setQueuePresent(true);
    setQueueClosing(false);
  } else if (queuePresent) {
    setQueueClosing(true);
  }
}, [queuePresent, route.queueOpen]);

const handleQueueExited = useCallback(() => {
  setQueuePresent(false);
  setQueueClosing(false);
  queueFocusRef.current?.focus?.({ preventScroll: true });
}, []);
```

Capture `queueButtonRef.current` in `openQueue`, and render the sheet when `queuePresent` is true:

```jsx
const openQueue = useCallback(() => {
  queueFocusRef.current = queueButtonRef.current;
  go(withQueueHash(window.location.hash || '#/', true));
}, [go]);

{queuePresent ? (
  <QueueSheet
    player={player}
    activeTab={queueTab}
    setActiveTab={setQueueTab}
    isClosing={queueClosing}
    onExited={handleQueueExited}
    onClose={closeQueue}
    onPlay={episode => startPlayback(episode, player.queue)}
    onPlayNext={episode => setPlayer(previous => insertNext(previous, episode))}
    onRemove={id => setPlayer(previous => removeFromQueue(previous, id))}
  />
) : null}
```

Inside `QueueSheet`, retain the current focus-on-entry and body overflow lock. Add a fallback timer for closing and finish only for the sheet's own animation event:

```jsx
useEffect(() => {
  if (!isClosing) return undefined;
  const timer = window.setTimeout(onExited, 250);
  return () => window.clearTimeout(timer);
}, [isClosing, onExited]);

const handleAnimationEnd = event => {
  if (isClosing && event.target === event.currentTarget && event.animationName === 'queue-sheet-out') onExited();
};
```

Attach `onAnimationEnd={handleAnimationEnd}` to `.queue-sheet`, pass `className={`queue-sheet${isClosing ? ' is-closing' : ''}`}`, and route Escape, backdrop, close button, and swipe through the existing `onClose` callback. Reopening must clear the closing class and the effect cleanup must cancel the old fallback timer.

- [ ] **Step 4: Add queue CSS motion**

Replace the static queue sheet entrance with these classes while preserving its current horizontal centering transform:

```css
.queue-backdrop { animation: queue-backdrop-in 150ms ease-out both; }
.queue-sheet { animation: queue-sheet-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.queue-sheet.is-closing { animation: queue-sheet-out 170ms cubic-bezier(0.4, 0, 1, 1) both; }
.queue-overlay.is-closing .queue-backdrop { animation: queue-backdrop-out 140ms ease-in both; }
@keyframes queue-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes queue-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes queue-sheet-in {
  from { opacity: 0; transform: translate3d(-50%, 100%, 0); }
  to { opacity: 1; transform: translate3d(-50%, 0, 0); }
}
@keyframes queue-sheet-out {
  from { opacity: 1; transform: translate3d(-50%, 0, 0); }
  to { opacity: 0; transform: translate3d(-50%, 100%, 0); }
}
```

Add `is-closing` to `.queue-overlay` while the presence is exiting, and keep the reduced-motion rule covering all four keyframes.

- [ ] **Step 5: Run queue tests and commit**

Run:

```bash
npm test -- src/App.test.jsx -t "queue|closing animation|same closing state"
```

Expected: all queue tests pass, including the existing browser-Back test. Commit:

```bash
git add src/App.jsx src/App.test.jsx src/App.css
git commit -m "feat: animate playback queue transitions"
```

### Task 4: Add CSS Motion Regression Checks And Run The Full Suite

**Files:**
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Add focused CSS assertions**

Extend the existing `mobile scroll rendering` suite with assertions that the route and queue use transform/opacity keyframes and that reduced motion remains defined:

```js
it('defines bounded route and queue motion with reduced-motion coverage', () => {
  expect(css).toMatch(/@keyframes route-forward-in/);
  expect(css).toMatch(/@keyframes route-back-in/);
  expect(css).toMatch(/@keyframes queue-sheet-in/);
  expect(css).toMatch(/@keyframes queue-sheet-out/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  expect(css).not.toMatch(/\.route-view[^}]*\bwill-change\s*:/);
});
```

- [ ] **Step 2: Run focused tests and verify the expected failure if keyframes are absent**

Run:

```bash
npm test -- src/scroll-render.test.js
```

Expected: the new assertion fails until the motion CSS from Tasks 2 and 3 exists; the two existing scroll-render assertions remain green.

- [ ] **Step 3: Run all verification commands**

Run each command from the implementation worktree:

```bash
npm test -- --reporter=dot
npm run lint
npm run build
npm audit --audit-level=high
git diff --check
```

Expected: all tests pass, lint/build/audit exit 0, and `git diff --check` prints no issues.

- [ ] **Step 4: Commit the regression checks**

```bash
git add src/scroll-render.test.js
git commit -m "test: cover mobile scroll and motion rules"
```

### Task 5: Browser Verification And GitHub Pages Release

**Files:**
- No source changes expected; verify the built output and live page.

- [ ] **Step 1: Start a production preview**

Run:

```bash
npm run preview -- --host 127.0.0.1 --port 4175
```

Open `http://127.0.0.1:4175/nio-podcast-web/` at `480x1102`, `390x844`, and `320x568`.

- [ ] **Step 2: Verify the original scroll symptom**

On each viewport, perform five fast upward/downward scroll cycles across the recommendation boundary. Confirm the recommendation section remains in the document, the header changes at most once per direction, `document.scrollHeight` does not oscillate, and no adjacent frames show title/list ghosting. Check the console for errors and warnings and confirm no horizontal overflow.

- [ ] **Step 3: Verify navigation and queue motion**

Click the top-left “全部专辑” button and confirm a short right-to-left entrance; return and confirm the reverse direction. Start playback, click the bottom-right queue button, and confirm backdrop fade plus sheet rise. Test close button, backdrop, Escape, browser Back, and downward swipe; confirm exit motion, URL/history behavior, and focus return to the queue trigger.

- [ ] **Step 4: Verify reduced motion**

Enable the browser reduced-motion preference and repeat the two navigation flows. Confirm state changes remain immediate and no content is hidden or blocked.

- [ ] **Step 5: Push and deploy**

After the browser checks pass, merge the feature branch into `main`, push `main`, and publish the existing `dist` directory:

```bash
git push origin codex/scroll-motion-fix
git checkout main
git merge --no-ff codex/scroll-motion-fix -m "merge: fix scroll rendering and add mobile motion"
git push origin main
npm run deploy
```

- [ ] **Step 6: Verify the live build**

Use cache-busting requests and the same mobile browser checks:

```bash
curl -fsSL -o /tmp/nio-index.html -w '%{http_code}\n' 'https://icekale.github.io/nio-podcast-web/?refresh=scroll-motion-1'
curl -fsSL -o /tmp/nio-sw.js -w '%{http_code}\n' 'https://icekale.github.io/nio-podcast-web/sw.js?refresh=scroll-motion-1'
```

Confirm the live index references the new CSS/JS hashes, the live CSS contains the scroll-stability and motion rules, and the live page reproduces no glitch or console errors.

- [ ] **Step 7: Clean up**

After deployment verification, stop the preview process, remove the merged worktree, delete the local feature branch, and verify `main` is clean and tracks `origin/main`.
