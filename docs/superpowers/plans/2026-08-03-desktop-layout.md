# NIO Radio Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive desktop experience at `min-width: 1024px` with a left navigation column, wide content area, album cover grid, two-column album detail, desktop player bar, and right-side queue drawer, while keeping the mobile layout and design tokens unchanged.

**Architecture:** Extend the existing SPA with one desktop-only nav component and CSS media-query overrides that reuse the current tokens and components. The queue keeps its `QueueSheet` lifecycle; the album grid and two-column pages are CSS arrangements of existing markup plus one `grid` prop.

**Tech Stack:** React 19, CSS, Vitest, React Testing Library, Vite

---

### Task 1: Lock the desktop layout with failing tests

**Files:**
- Modify: `src/scroll-render.test.js`
- Create: `src/desktop-layout.test.jsx`

- [ ] **Step 1: Add the CSS contract test**

Add this test to `src/scroll-render.test.js`:

```js
  it('defines the desktop shell, album grid, and queue drawer', () => {
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)/);
    expect(css).toMatch(/\.desktop-nav\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.app\s*\{[^}]*max-width:\s*1280px/);
    expect(css).toMatch(/\.desktop-nav\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.album-results\.is-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(170px,\s*1fr\)\)/);
    expect(css).toMatch(/\.queue-sheet\s*\{[^}]*width:\s*380px/);
    expect(css).toMatch(/@keyframes queue-sheet-in\s*\{[^}]*translate3d\(100%,\s*0,\s*0\)/);
  });
```

- [ ] **Step 2: Add the desktop navigation component tests**

Create `src/desktop-layout.test.jsx`:

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

const episode = (id, title) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: '',
  albumDesc: '',
  host: '',
  duration: 60000,
  onlineTime: Date.now(),
  audioUrl: `https://cdn.example/${id}.aac`,
});

const catalog = {
  generatedAt: Date.now(),
  albums: [
    { id: 1, name: 'NIO 精选', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(1, '第一集') },
  ],
};

describe('desktop navigation', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.clear();
  });

  it('shows the desktop nav with the home destination active', () => {
    render(<App initialCatalog={catalog} />);
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '今日推荐' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '全部专辑' })).not.toHaveAttribute('aria-current');
  });

  it('highlights the active sidebar destination', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    expect(screen.getByRole('button', { name: '全部专辑' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '今日推荐' })).not.toHaveAttribute('aria-current');
  });

  it('opens the later tab from the sidebar', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(screen.getByRole('button', { name: '稍后播放' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    expect(screen.getByRole('tab', { name: '稍后播放' })).toHaveAttribute('aria-selected', 'true');
    expect(dialog).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:

```bash
npm test -- src/scroll-render.test.js -t "desktop shell"
npm test -- src/desktop-layout.test.jsx
```

Expected: the CSS contract fails because the desktop rules do not exist; the component tests fail because `.desktop-nav` is not rendered.

### Task 2: Add the desktop navigation shell

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the `DesktopNav` component**

Add before `function readStoredPlayer()`:

```jsx
function DesktopNav({ route, laterActive, onHome, onAlbums, onSearch, onLater }) {
  return (
    <aside className="desktop-nav" aria-label="主导航">
      <div className="desktop-nav-brand">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="30" height="30" />
        <span>NIO Radio</span>
      </div>
      <nav className="desktop-nav-links">
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'home' ? 'page' : undefined} onClick={onHome}>今日推荐</button>
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'albums' ? 'page' : undefined} onClick={onAlbums}>全部专辑</button>
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'search' ? 'page' : undefined} onClick={onSearch}>搜索</button>
        <button type="button" className="desktop-nav-link" aria-current={laterActive ? 'page' : undefined} onClick={onLater}>稍后播放</button>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Add queue-open-from and later-open callbacks**

In `App`, replace the `openQueue` callback with:

```jsx
  const openQueueFrom = useCallback(trigger => {
    queueFocusRef.current = trigger;
    go(withQueueHash(window.location.hash || '#/', true));
  }, [go]);
  const openQueue = useCallback(() => openQueueFrom(queueButtonRef.current), [openQueueFrom]);
  const openLater = useCallback(event => {
    setQueueTab('later');
    if (queuePresent) return;
    openQueueFrom(event.currentTarget);
  }, [openQueueFrom, queuePresent]);
```

- [ ] **Step 3: Render the sidebar in the app shell**

Inside `<main className="app">`, before `<div className="app-content">`, add:

```jsx
      <DesktopNav
        route={route}
        laterActive={queuePresent && queueTab === 'later'}
        onHome={() => go('#/')}
        onAlbums={openAlbums}
        onSearch={openSearch}
        onLater={openLater}
      />
```

### Task 3: Add the album grid prop

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Extend `AlbumResults` with a grid flag**

Change the signature and list element:

```jsx
export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender, grid = false }) {
  onRender?.();
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  return (
    <ul className={`album-results${grid ? ' is-grid' : ''}`}>
```

- [ ] **Step 2: Pass the grid flag from the album directory**

In `AlbumsScreen`, change the `AlbumResults` call to:

```jsx
        <AlbumResults albums={orderedAlbums} onOpenAlbum={onOpenAlbum} grid />
```

### Task 4: Add the desktop CSS

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add the base hidden sidebar rule**

Near the shell rules, add:

```css
.desktop-nav { display: none; }
```

- [ ] **Step 2: Add the desktop media block before the reduced-motion rule**

```css
@media (min-width: 1024px) {
  body { padding: 0; }
  .app {
    width: 100%;
    max-width: 1280px;
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: minmax(100dvh, auto);
    border-radius: 0;
    box-shadow: none;
  }
  .desktop-nav {
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100dvh;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-4);
    background: var(--surface);
    border-right: 1px solid var(--line);
  }
  .desktop-nav-brand { display: flex; align-items: center; gap: var(--space-2); color: var(--ink); font-weight: 650; }
  .desktop-nav-brand img { border-radius: var(--radius-sm); }
  .desktop-nav-links { display: flex; flex-direction: column; gap: var(--space-1); }
  .desktop-nav-link {
    min-height: 2.75rem;
    padding: 0.65rem var(--space-3);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--muted-strong);
    font-size: 0.95rem;
    text-align: left;
  }
  .desktop-nav-link:hover { background: var(--surface-soft); color: var(--ink); }
  .desktop-nav-link[aria-current="page"] { background: var(--aqua); color: var(--teal-dark); font-weight: 650; }
  .app-content { grid-column: 2; min-width: 0; }

  .mini-player { width: min(100%, 1280px); padding-top: var(--space-4); }
  .mini-progress-row input { height: 1rem; }

  .home-screen { display: grid; grid-template-columns: minmax(320px, 38%) minmax(0, 1fr); gap: 0 var(--space-8); }
  .home-screen .top-bar { grid-column: 1 / -1; }
  .home-screen .recommendation-panel { grid-column: 1; grid-row: 2; align-self: start; padding: var(--space-8) var(--space-6); border-radius: var(--radius-md); }
  .home-screen .updates-section { grid-column: 2; grid-row: 2; padding: var(--space-8) 0 0; }

  .album-results.is-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: var(--space-5);
    padding: var(--space-5) 0;
  }
  .album-results.is-grid li { border-bottom: 0; }
  .album-results.is-grid .album-result { flex-direction: column; align-items: stretch; gap: var(--space-3); padding: 0; }
  .album-results.is-grid .album-art { width: 100%; height: auto; aspect-ratio: 1; }
  .album-results.is-grid .album-result-copy strong { font-size: 0.95rem; }
  .album-results.is-grid .album-result-copy span { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .album-results.is-grid .album-results-more { grid-column: 1 / -1; }

  .album-content { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 0 var(--space-8); padding: var(--space-8) 0 0; }
  .album-intro { grid-column: 1; grid-row: 1 / span 20; align-self: start; flex-direction: column; align-items: flex-start; gap: var(--space-4); }
  .album-hero-art { width: 100%; height: auto; aspect-ratio: 1; }
  .album-content > .inline-error,
  .album-content > .loading-state,
  .album-content > .loading-more,
  .album-content > .empty-state,
  .album-content > .load-more-button,
  .album-content > .album-episode-list { grid-column: 2; }

  .queue-sheet {
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: 380px;
    max-height: 100dvh;
    transform: none;
    border-radius: 1.25rem 0 0 1.25rem;
    animation-name: queue-sheet-in;
    animation-duration: 280ms;
  }
  .queue-sheet.is-closing { animation-duration: 220ms; }
  @keyframes queue-sheet-in {
    from { opacity: 0; transform: translate3d(100%, 0, 0); }
    to { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes queue-sheet-out {
    from { opacity: 1; transform: translate3d(0, 0, 0); }
    to { opacity: 0; transform: translate3d(100%, 0, 0); }
  }
  .queue-backdrop { animation-duration: 220ms; }
  .queue-overlay.is-closing .queue-backdrop { animation-duration: 180ms; }
}
```

- [ ] **Step 3: Run the contract and component tests**

Run:

```bash
npm test -- src/scroll-render.test.js -t "desktop shell"
npm test -- src/desktop-layout.test.jsx
```

Expected: all pass.

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

- [ ] **Step 2: Confirm the diff is limited to the desktop files**

Run:

```bash
git status --short --branch
git diff --stat HEAD
```

Expected: only `src/App.jsx`, `src/App.css`, `src/scroll-render.test.js`, and `src/desktop-layout.test.jsx` change in the implementation commit.

- [ ] **Step 3: Commit the implementation**

Run:

```bash
git add src/App.jsx src/App.css src/scroll-render.test.js src/desktop-layout.test.jsx
git commit -m "feat: add responsive desktop layout"
```

### Task 6: Merge, deploy, and verify

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main and push**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/desktop-layout
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

Expected: `main` advances and the push succeeds; the untracked user file stays untouched.

- [ ] **Step 2: Monitor Pages deployment**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: a new deploy run starts for the pushed commit.

- [ ] **Step 3: Verify the live build**

Run:

```bash
gh run watch --repo icekale/nio-podcast-web "$(gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
curl -fsS https://nio.k4le.top/ | rg -o 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u
```

Expected: the workflow succeeds and the live page references the newest build assets.
