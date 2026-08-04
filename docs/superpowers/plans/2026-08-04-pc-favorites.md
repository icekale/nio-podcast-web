# PC Favorites Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PC-only 我的收藏 destination in the desktop sidebar that shows the user's favorited albums in the album-cover grid, with an empty state. Mobile keeps today's behavior (favorites pin to the top of 全部专辑; no new entry).

**Architecture:** Map a new `#/favorites` route to a `favorites` screen, add a 我的收藏 link to `DesktopNav`, and render a new `FavoritesScreen` that filters the existing catalog by the already-persisted `favoriteAlbums` state (newest favorite first) and reuses `AlbumResults` in grid mode. Empty state reuses existing tokens and the search route for browsing.

**Tech Stack:** React 19, Vite, Vitest, React Testing Library, oxlint, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-04-pc-favorites-design.md`

**Worktree:** `.worktrees/pc-favorites` on branch `codex/pc-favorites` (baseline: 143 tests passing).

---

### Task 1: Favorites route and sidebar link

**Files:**
- Modify: `src/router.test.js`
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/router.js`
- Modify: `src/components/DesktopNav.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/router.test.js`, append inside `describe('hash router', () => { ... })`:

```js
it('parses the favorites route', () => {
  expect(parseHash('#/favorites')).toEqual({ screen: 'favorites', albumId: null, queueOpen: false });
});
```

In `src/desktop-layout.test.jsx`, append inside `describe('desktop navigation', () => { ... })`:

```jsx
it('shows the favorites destination and highlights it on the favorites route', () => {
  window.history.replaceState({ nioDepth: 0 }, '', '#/favorites');
  render(<App initialCatalog={catalog} />);
  const nav = screen.getByRole('navigation', { name: '主导航' });
  expect(within(nav).getByRole('button', { name: '我的收藏' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/router.test.js src/desktop-layout.test.jsx`
Expected: the router test FAILS (favorites falls through to home); the desktop test FAILS (no 我的收藏 button).

- [ ] **Step 3: Implement the route and sidebar link**

In `src/router.js`, add the favorites branch before the album regex:

```js
  if (path === '/albums') return { screen: 'albums', albumId: null, queueOpen };
  if (path === '/favorites') return { screen: 'favorites', albumId: null, queueOpen };
```

In `src/components/DesktopNav.jsx`, add the `onFavorites` prop and the link between 稍后播放 and the install button:

```jsx
export function DesktopNav({ route, laterActive, onHome, onSearch, onLater, onFavorites, showInstall, onInstall }) {
  // ...
        <button type="button" className="desktop-nav-link" aria-current={laterActive ? 'page' : undefined} onClick={onLater}>稍后播放</button>
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'favorites' ? 'page' : undefined} onClick={onFavorites}>我的收藏</button>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/router.test.js src/desktop-layout.test.jsx`
Expected: all tests in both files pass.

- [ ] **Step 5: Commit**

```bash
git add src/router.test.js src/desktop-layout.test.jsx src/router.js src/components/DesktopNav.jsx
git commit -m "feat: add favorites route and sidebar link"
```

---

### Task 2: Favorites screen and wiring

**Files:**
- Create: `src/App.favorites.test.jsx`
- Create: `src/screens/FavoritesScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing integration tests**

Create `src/App.favorites.test.jsx`:

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    { id: 2, name: '另一张专辑', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(2, '第二集') },
    { id: 5, name: '资讯充电站·早间版', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(5, '早间节目') },
    { id: 23, name: '资讯充电站·晚间版', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(23, '晚间节目') },
  ],
};

function openFavorites() {
  const nav = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(nav).getByRole('button', { name: '我的收藏' }));
}

describe('desktop favorites collection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(min-width: 1024px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
  });

  it('shows only favorited albums in newest-first order', async () => {
    window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([5, 2]));
    render(<App initialCatalog={catalog} />);
    openFavorites();

    const cards = await screen.findAllByRole('button', { name: /^(资讯充电站·早间版|另一张专辑|NIO 精选|资讯充电站·晚间版)/ });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAccessibleName('资讯充电站·早间版早间节目');
    expect(cards[1]).toHaveAccessibleName('另一张专辑第二集');
  });

  it('removes a card immediately when unfavorited', async () => {
    window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([2]));
    render(<App initialCatalog={catalog} />);
    openFavorites();
    await screen.findByRole('heading', { name: '我的收藏' });

    fireEvent.click(screen.getByRole('button', { name: '管理 另一张专辑' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '取消收藏' }));

    expect(screen.queryByRole('button', { name: /^另一张专辑/ })).not.toBeInTheDocument();
    expect(screen.getByText('还没有收藏专辑')).toBeInTheDocument();
  });

  it('shows the empty state and browses to the full album directory', async () => {
    render(<App initialCatalog={catalog} />);
    openFavorites();
    await screen.findByText('还没有收藏专辑');

    fireEvent.click(screen.getByRole('button', { name: '去全部专辑看看' }));
    expect(window.location.hash).toBe('#/search');
    expect(await screen.findByRole('heading', { name: '全部专辑' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.favorites.test.jsx`
Expected: all three tests FAIL (no favorites screen renders for the route).

- [ ] **Step 3: Implement the favorites screen and wiring**

Create `src/screens/FavoritesScreen.jsx`:

```jsx
import { memo, useMemo } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { AlbumResults } from '../components/AlbumResults';

export const FavoritesScreen = memo(function FavoritesScreen({ catalog, favoriteIds, onToggleFavorite, onOpenAlbum, onBack, onBrowse }) {
  const favoriteSet = useMemo(() => new Set(favoriteIds.map(Number)), [favoriteIds]);
  const favorites = useMemo(
    () => catalog.albums.filter(album => favoriteSet.has(Number(album.id))),
    [catalog.albums, favoriteSet],
  );
  return (
    <div className="screen favorites-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">我的收藏</span>
        <span className="icon-button-spacer" />
      </header>
      <section className="search-results" aria-labelledby="favorites-title">
        <div className="section-heading-row"><h1 id="favorites-title">我的收藏</h1><span className="section-count">{favorites.length}</span></div>
        {favorites.length ? <AlbumResults albums={favorites} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} /> : (
          <div className="favorites-empty">
            <Star size={32} aria-hidden="true" />
            <h2>还没有收藏专辑</h2>
            <p>在「全部专辑」里点击专辑右上角的 ⋯，选择「收藏专辑」后就会出现在这里。</p>
            <button type="button" className="secondary-button" onClick={onBrowse}>去全部专辑看看</button>
          </div>
        )}
      </section>
    </div>
  );
});
```

In `src/App.jsx`:

Add the import next to the other screen imports:

```jsx
import { FavoritesScreen } from './screens/FavoritesScreen';
```

Add the open handler next to `openSearch`:

```jsx
const openFavorites = useCallback(() => go('#/favorites'), [go]);
```

Pass the new prop to `DesktopNav`:

```jsx
        <DesktopNav
          route={route}
          laterActive={queuePresent && queueTab === 'later'}
          onHome={() => go('#/')}
          onSearch={openSearch}
          onLater={openLater}
          onFavorites={openFavorites}
          showInstall={Boolean(installPrompt)}
          onInstall={promptInstall}
        />
```

Add the route rendering after the `search` screen line:

```jsx
          {route.screen === 'favorites' ? <FavoritesScreen catalog={catalogState.catalog} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} onOpenAlbum={openAlbum} onBack={goBack} onBrowse={openSearch} /> : null}
```

No change is needed to `goBack`: its existing `else if (route.screen !== 'home') go('#/', { replace: true })` branch already sends favorites back home.

In `src/App.css`:

After the `.empty-state` rule, add the empty state styles:

```css
.favorites-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: 4rem 1rem 5rem; color: var(--muted-strong); text-align: center; }
.favorites-empty svg { color: var(--teal-dark); }
.favorites-empty h2 { margin: 0.5rem 0 0; color: var(--ink); font-size: 1.15rem; font-weight: 620; }
.favorites-empty p { max-width: 24rem; margin: 0; font-size: 0.88rem; }
.favorites-empty .secondary-button { margin-top: var(--space-2); }
```

Inside the `@media (min-width: 1024px)` block, next to the other screen top-bar rules, add:

```css
  .favorites-screen .top-bar { display: none; }
```

- [ ] **Step 4: Run the full unit suite to verify everything passes**

Run: `npm test`
Expected: 148 passed (143 baseline + 1 router + 1 desktop nav + 3 favorites integration), 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/App.favorites.test.jsx src/screens/FavoritesScreen.jsx src/App.jsx src/App.css
git commit -m "feat: add pc favorites collection page"
```

---

### Task 3: Full verification and acceptance gate

**Files:**
- Modify: `e2e/app.spec.js`

- [ ] **Step 1: Extend the browser smoke for the favorites page**

In `e2e/app.spec.js`, append:

```js
test('desktop favorites page renders', async ({ page }) => {
  await page.goto('/#/favorites');
  await expect(page.getByRole('heading', { name: '我的收藏' })).toBeVisible();
});
```

- [ ] **Step 2: Lint, unit tests, build, and E2E**

Run: `npm run lint` → no errors.
Run: `npm test` → all pass, 0 failures.
Run: `npm run build` → build succeeds.
Run: `npm run e2e` → 4 passed.

- [ ] **Step 3: Browser acceptance**

Serve the built app (`npm run preview -- --port 4173 --host 127.0.0.1`) and verify headlessly:
1. Desktop `#/favorites`: only favorited albums appear, newest favorite first; unfavoriting removes the card; removing all shows the empty state; 去全部专辑看看 goes to `#/search`.
2. Mobile (390px) 全部专辑: no new entry; favorites still pin to the top of the directory.
3. Screenshot the favorites page (filled and empty states) for visual confirmation.

- [ ] **Step 4: Commit and confirm the branch is ready**

```bash
git add e2e/app.spec.js
git commit -m "test: cover the pc favorites page in browser smoke"
```

Run: `git status` and `git log --oneline -5` — working tree clean, three feature commits on `codex/pc-favorites`.

---

## Deployment after acceptance

Only after the user approves the acceptance results:

1. `git fetch origin` (the automated catalog workflow may have moved `origin/main`).
2. Rebase if needed: `git rebase origin/main`.
3. Fast-forward main and push:

```bash
git checkout main
git merge --ff-only codex/pc-favorites
git push origin main
```

`deploy.yml` publishes GitHub Pages from the pushed `main`. Keep the untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` untouched.
