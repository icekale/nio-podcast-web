# Album Directory Favorites and City-Channel Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort city-channel albums to the bottom of the album directory and let users favorite albums from a three-dot menu so favorites pin to the top, persisted per device in localStorage.

**Architecture:** Add a pure favorite-album storage module, extend the existing directory-order selector in `src/catalog.js` to four tiers (favorites → pinned briefing albums → other albums → city channels), and add an optional three-dot favorite menu to the shared `AlbumResults` row/card. Favorite state lives at the `App` root and is passed to the mobile 全部专辑 screen and the desktop search grid.

**Tech Stack:** React 19, Vite, Vitest, React Testing Library, oxlint, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-04-album-favorites-design.md`

**Worktree:** `.worktrees/album-favorites` on branch `codex/album-favorites` (baseline: 132 tests passing).

---

### Task 1: Favorite album storage module

**Files:**
- Create: `src/favoriteAlbums.test.js`
- Create: `src/favoriteAlbums.js`

- [ ] **Step 1: Write the failing storage tests**

Create `src/favoriteAlbums.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest';
import { FAVORITE_ALBUMS_STORAGE_KEY, readFavoriteAlbums, toggleFavoriteAlbum, writeFavoriteAlbums } from './favoriteAlbums';

describe('favorite albums storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to an empty list', () => {
    expect(readFavoriteAlbums()).toEqual([]);
  });

  it('reads persisted ids and drops invalid or duplicate entries', () => {
    window.localStorage.setItem(FAVORITE_ALBUMS_STORAGE_KEY, JSON.stringify([2, '2', 'x', null, 3]));
    expect(readFavoriteAlbums()).toEqual([2, 3]);
  });

  it('toggles an album to the front and back off', () => {
    expect(toggleFavoriteAlbum([], 5)).toEqual({ ids: [5], favorited: true });
    expect(toggleFavoriteAlbum([5, 3], 2)).toEqual({ ids: [2, 5, 3], favorited: true });
    expect(toggleFavoriteAlbum([2, 5, 3], 5)).toEqual({ ids: [2, 3], favorited: false });
    expect(toggleFavoriteAlbum([1], 'x')).toEqual({ ids: [1], favorited: false });
  });

  it('round-trips through local storage', () => {
    expect(writeFavoriteAlbums([3, 1])).toBe(true);
    expect(readFavoriteAlbums()).toEqual([3, 1]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/favoriteAlbums.test.js`
Expected: FAIL with "Cannot find module './favoriteAlbums'".

- [ ] **Step 3: Implement the storage module**

Create `src/favoriteAlbums.js`:

```js
export const FAVORITE_ALBUMS_STORAGE_KEY = 'nio_favorite_albums_v1';

export function readFavoriteAlbums(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(FAVORITE_ALBUMS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const ids = parsed
      .filter(item => item != null && item !== '' && Number.isFinite(Number(item)))
      .map(Number);
    return ids.filter((id, index) => ids.indexOf(id) === index);
  } catch {
    return [];
  }
}

export function toggleFavoriteAlbum(ids, albumId) {
  const id = Number(albumId);
  if (!Number.isFinite(id)) return { ids, favorited: false };
  if (ids.includes(id)) return { ids: ids.filter(item => item !== id), favorited: false };
  return { ids: [id, ...ids], favorited: true };
}

export function writeFavoriteAlbums(ids, storage = globalThis.localStorage) {
  try {
    storage?.setItem(FAVORITE_ALBUMS_STORAGE_KEY, JSON.stringify(ids.map(Number)));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/favoriteAlbums.test.js`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/favoriteAlbums.test.js src/favoriteAlbums.js
git commit -m "feat: add favorite album storage helpers"
```

---

### Task 2: City-channel predicate and favorite-first directory ordering

**Files:**
- Modify: `src/catalog.test.js`
- Modify: `src/catalog.js`

- [ ] **Step 1: Write the failing selector tests**

In `src/catalog.test.js`, change the import to add `isCityChannelAlbum`:

```js
import { getBeijingDayKey, isCityChannelAlbum, loadCatalog, selectHomeEpisodes, sortAlbumsByLatest, sortAlbumsForDirectory, writeCatalogCache } from './catalog';
```

Append these tests inside `describe('catalog selectors', () => { ... })` (after the existing "pins the briefing albums" test):

```js
it('detects city-channel albums by name', () => {
  expect(isCityChannelAlbum({ name: '上海天气预报' })).toBe(true);
  expect(isCityChannelAlbum({ name: '广东城市资讯' })).toBe(true);
  expect(isCityChannelAlbum({ name: '南京城市频道' })).toBe(true);
  expect(isCityChannelAlbum({ name: 'NIO 精选' })).toBe(false);
  expect(isCityChannelAlbum({ name: '' })).toBe(false);
  expect(isCityChannelAlbum(null)).toBe(false);
});

it('sorts city-channel albums after every regular album', () => {
  const albums = [
    { id: 1, name: '上海天气预报', latestEpisode: episode(11, 400) },
    { id: 2, name: 'NIO 精选', latestEpisode: episode(22, 300) },
    { id: 3, name: '广东城市资讯', latestEpisode: episode(33, 200) },
  ];
  expect(sortAlbumsForDirectory(albums).map(album => album.id)).toEqual([2, 1, 3]);
});

it('places favorites first, then pinned, then city last', () => {
  const albums = [
    { id: 5, name: '资讯充电站·早间版', latestEpisode: episode(51, 100) },
    { id: 23, name: '资讯充电站·晚间版', latestEpisode: episode(231, 200) },
    { id: 7, name: '普通专辑', latestEpisode: episode(71, 300) },
    { id: 8, name: '上海天气预报', latestEpisode: episode(81, 400) },
    { id: 9, name: '另一张普通专辑', latestEpisode: episode(91, 500) },
  ];
  expect(sortAlbumsForDirectory(albums, [9, 5]).map(album => album.id)).toEqual([9, 5, 23, 7, 8]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/catalog.test.js`
Expected: FAIL — `isCityChannelAlbum` is not exported; the two new ordering tests fail.

- [ ] **Step 3: Implement the selector changes**

In `src/catalog.js`, add the city predicate next to `PINNED_ALBUM_IDS`:

```js
const PINNED_ALBUM_IDS = [5, 23];
const CITY_CHANNEL_PATTERN = /城市资讯|城市频道|天气预报/;

export function isCityChannelAlbum(album) {
  return CITY_CHANNEL_PATTERN.test(album?.name || '');
}
```

Replace the existing `sortAlbumsForDirectory` implementation:

```js
export function sortAlbumsForDirectory(albums, favoriteIds = []) {
  const pinnedIds = new Set(PINNED_ALBUM_IDS.map(Number));
  const favoriteOrder = new Map(
    favoriteIds.map(Number).filter(Number.isFinite).map((id, index) => [id, index]),
  );
  const favorites = [];
  const pinned = [];
  const rest = [];
  const city = [];
  for (const album of albums) {
    const id = Number(album.id);
    if (favoriteOrder.has(id)) favorites.push(album);
    else if (pinnedIds.has(id)) pinned.push(album);
    else if (isCityChannelAlbum(album)) city.push(album);
    else rest.push(album);
  }
  favorites.sort((a, b) => favoriteOrder.get(Number(a.id)) - favoriteOrder.get(Number(b.id)));
  const pinnedOrder = new Map(PINNED_ALBUM_IDS.map((id, index) => [id, index]));
  pinned.sort((a, b) => pinnedOrder.get(Number(a.id)) - pinnedOrder.get(Number(b.id)));
  return [...favorites, ...pinned, ...sortAlbumsByLatest(rest), ...sortAlbumsByLatest(city)];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/catalog.test.js`
Expected: all catalog tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.test.js src/catalog.js
git commit -m "feat: sort favorites first and city channels last"
```

---

### Task 3: Favorite menu on album rows and wiring

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/components/AlbumResults.jsx`
- Modify: `src/screens/AlbumsScreen.jsx`
- Modify: `src/screens/SearchScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Update existing queries so they stay unambiguous**

The new `管理 <专辑名>` menu buttons match broad regex queries. Anchor the existing queries to the album button names.

In `src/App.test.jsx`, replace:

```js
const rows = screen.getAllByRole('button', { name: /资讯充电站|普通专辑/ });
```

with:

```js
const rows = screen.getAllByRole('button', { name: /^(资讯充电站·早间版|资讯充电站·晚间版|普通专辑)/ });
```

In `src/desktop-layout.test.jsx`, replace:

```js
const rows = screen.getAllByRole('button', { name: /资讯充电站|NIO 精选|另一张专辑/ });
```

with:

```js
const rows = screen.getAllByRole('button', { name: /^(资讯充电站·早间版|资讯充电站·晚间版|NIO 精选|另一张专辑)/ });
```

In `src/desktop-layout.test.jsx`, replace every `{ name: /NIO 精选/ }` and `{ name: /另一张专辑/ }` (in `getByRole`, `queryByRole`, and `findByRole` calls within the "browses and filters the album grid from search" test) with anchored versions:

```js
{ name: /^NIO 精选/ }
{ name: /^另一张专辑/ }
```

- [ ] **Step 2: Write the failing integration tests**

In `src/App.test.jsx`, append these tests inside `describe('mobile app shell', () => { ... })`:

```js
it('pins favorited albums first and keeps city channels last', async () => {
  const favoriteCatalog = {
    generatedAt: Date.now(),
    albums: [
      { id: 1, name: 'NIO 精选', description: '精选内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(1, '第一集'), onlineTime: 300 } },
      { id: 2, name: '另一张专辑', description: '更多内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(2, '第二集'), onlineTime: 200 } },
      { id: 9, name: '上海天气预报', description: '天气内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(9, '天气节目'), onlineTime: 100 } },
    ],
  };
  render(<App initialCatalog={favoriteCatalog} />);

  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await screen.findByRole('heading', { name: '全部专辑' });

  const directoryRows = () => screen.getAllByRole('button', { name: /^(NIO 精选|另一张专辑|上海天气预报)/ });
  expect(directoryRows().map(button => button.textContent)).toEqual(['NIO 精选第一集', '另一张专辑第二集', '上海天气预报天气节目']);

  fireEvent.click(screen.getByRole('button', { name: '管理 上海天气预报' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '收藏专辑' }));

  expect(directoryRows().map(button => button.textContent)).toEqual(['上海天气预报天气节目', 'NIO 精选第一集', '另一张专辑第二集']);
  expect(window.localStorage.getItem('nio_favorite_albums_v1')).toBe(JSON.stringify([9]));

  fireEvent.click(screen.getByRole('button', { name: '管理 上海天气预报' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '取消收藏' }));

  expect(directoryRows().map(button => button.textContent)).toEqual(['NIO 精选第一集', '另一张专辑第二集', '上海天气预报天气节目']);
});

it('restores favorited albums from local storage', async () => {
  window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([2]));
  render(<App initialCatalog={catalog} />);

  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  await screen.findByRole('heading', { name: '全部专辑' });

  const rows = screen.getAllByRole('button', { name: /^(NIO 精选|另一张专辑)/ });
  expect(rows[0]).toHaveAccessibleName('另一张专辑第二集');
  expect(rows[1]).toHaveAccessibleName('NIO 精选第一集');
});
```

In `src/desktop-layout.test.jsx`, append this test inside `describe('desktop navigation', () => { ... })`:

```js
it('favorites an album from the desktop grid and pins it first', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '搜索' }));
  await screen.findByRole('searchbox', { name: '搜索专辑' });

  fireEvent.click(screen.getByRole('button', { name: '管理 另一张专辑' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '收藏专辑' }));

  const rows = screen.getAllByRole('button', { name: /^(资讯充电站·早间版|资讯充电站·晚间版|NIO 精选|另一张专辑)/ });
  expect(rows[0]).toHaveAccessibleName('另一张专辑第二集');
  expect(rows[1]).toHaveAccessibleName('资讯充电站·早间版早间节目');
  expect(rows[2]).toHaveAccessibleName('资讯充电站·晚间版晚间节目');
  expect(rows[3]).toHaveAccessibleName('NIO 精选第一集');
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run src/App.test.jsx src/desktop-layout.test.jsx`
Expected: the two new mobile tests and the new desktop test FAIL (no `管理 <专辑名>` button exists yet); existing tests still pass with the anchored queries.

- [ ] **Step 4: Implement the menu, screens, and wiring**

Replace the contents of `src/components/AlbumResults.jsx` with:

```jsx
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { Artwork } from './Artwork';
import { useVisibleAlbums } from '../hooks/useVisibleAlbums';

function FavoriteAlbumMenu({ album, favorited, onToggle }) {
  const [open, setOpen] = useState(false);
  const menuId = `album-menu-${album.id}`;

  useEffect(() => {
    if (!open) return undefined;
    const closeMenu = event => {
      if (!event.target?.closest?.('.album-action')) setOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="album-action">
      <button type="button" className="icon-button" aria-label={`管理 ${album.name}`} aria-expanded={open} aria-haspopup="menu" aria-controls={menuId} onClick={() => setOpen(previous => !previous)}><MoreHorizontal size={15} aria-hidden="true" /></button>
      {open ? <div id={menuId} className="row-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onToggle(album.id); setOpen(false); }}>{favorited ? '取消收藏' : '收藏专辑'}</button></div> : null}
    </div>
  );
}

export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender, grid = false, favoriteIds = [], onToggleFavorite }) {
  onRender?.();
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  const favoriteSet = new Set(favoriteIds.map(Number));
  return (
    <ul className={`album-results${grid ? ' is-grid' : ''}`}>
      {visibleAlbums.map(album => {
        const favorited = favoriteSet.has(Number(album.id));
        return (
          <li key={album.id} className="album-row">
            <button type="button" className="album-result" onClick={() => onOpenAlbum(album.id)}>
              <Artwork src={album.imageUrl} alt="" className="album-art" />
              <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
              {!grid && !onToggleFavorite ? <ChevronRight size={19} aria-hidden="true" /> : null}
            </button>
            {onToggleFavorite ? <FavoriteAlbumMenu album={album} favorited={favorited} onToggle={onToggleFavorite} /> : null}
          </li>
        );
      })}
      {hasMore ? <li className="album-results-more"><button type="button" onClick={loadMore}>加载更多专辑</button></li> : null}
    </ul>
  );
});
```

Replace the contents of `src/screens/AlbumsScreen.jsx` with:

```jsx
import { memo, useMemo } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { sortAlbumsForDirectory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';

export const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum, favoriteIds, onToggleFavorite }) {
  const orderedAlbums = useMemo(() => sortAlbumsForDirectory(catalog.albums, favoriteIds), [catalog.albums, favoriteIds]);
  return (
    <div className="screen albums-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">全部专辑</span>
        <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
      </header>
      <section className="search-results" aria-labelledby="albums-title">
        <div className="section-heading-row"><h1 id="albums-title">全部专辑</h1><span className="section-count">{catalog.albums.length}</span></div>
        <AlbumResults albums={orderedAlbums} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
        {!catalog.albums.length ? <div className="empty-state">暂无可用专辑</div> : null}
      </section>
    </div>
  );
});
```

Replace the contents of `src/screens/SearchScreen.jsx` with:

```jsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { sortAlbumsForDirectory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';

export const SearchScreen = memo(function SearchScreen({ catalog, searchQuery = '', onBack, onQueryChange, onOpenAlbum, pinnedFirst = false, favoriteIds, onToggleFavorite }) {
  const [query, setQuery] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const inputRef = useRef(null);
  const filtered = useMemo(() => {
    const base = pinnedFirst ? sortAlbumsForDirectory(catalog.albums, favoriteIds) : catalog.albums;
    const value = debouncedQuery.trim().toLowerCase();
    if (!value) return base;
    return base.filter(album => `${album.name} ${album.description} ${album.host}`.toLowerCase().includes(value));
  }, [catalog.albums, debouncedQuery, pinnedFirst, favoriteIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setQuery(searchQuery), [searchQuery]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="screen search-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="search-field-wrap"><Search size={18} aria-hidden="true" /><input ref={inputRef} type="search" value={query} onChange={event => { setQuery(event.target.value); onQueryChange(event.target.value); }} aria-label="搜索专辑" placeholder="搜索专辑" /></div>
        {query ? <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => { setQuery(''); onQueryChange(''); }}><X size={20} /></button> : <span className="icon-button-spacer" />}
      </header>
      <section className="search-results">
        <div className="section-heading-row"><h1>全部专辑</h1><span key={filtered.length} className="section-count" aria-live="polite">{filtered.length}</span></div>
        <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
        {!filtered.length ? <div className="empty-state">没有找到匹配的专辑</div> : null}
      </section>
    </div>
  );
});
```

In `src/App.jsx`:

Add to the imports from `./laterPlayback` block:

```jsx
import { readFavoriteAlbums, toggleFavoriteAlbum, writeFavoriteAlbums } from './favoriteAlbums';
```

Add state next to `const [laterEpisodes, setLaterEpisodes] = useState(readLaterEpisodes);`:

```jsx
const [favoriteAlbums, setFavoriteAlbums] = useState(readFavoriteAlbums);
```

Add the handler next to `removeFromLater`/`moveFromLater`:

```jsx
const toggleAlbumFavorite = useCallback(albumId => {
  setFavoriteAlbums(previous => {
    const next = toggleFavoriteAlbum(previous, albumId);
    writeFavoriteAlbums(next.ids);
    return next.ids;
  });
}, []);
```

Update the two screen renderings:

```jsx
{route.screen === 'albums' ? <AlbumsScreen catalog={catalogState.catalog} onBack={goBack} onSearch={openSearch} onOpenAlbum={openAlbum} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} /> : null}
{route.screen === 'search' ? <SearchScreen catalog={catalogState.catalog} searchQuery={route.searchQuery} onBack={goBack} onQueryChange={updateSearchQuery} onOpenAlbum={openAlbum} pinnedFirst={desktopLayout} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} /> : null}
```

In `src/App.css`, after the `.album-result > svg { ... }` rule (around line 216), add:

```css
.album-row { position: relative; display: flex; align-items: center; gap: var(--space-2); }
.album-row .album-result { flex: 1; min-width: 0; }
.album-action { position: relative; flex: 0 0 auto; }
```

Inside the `@media (min-width: 1024px)` block, next to `.album-results.is-grid .album-result > svg { display: none; }`, add:

```css
.album-results.is-grid .album-action {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 1;
}
```

- [ ] **Step 5: Run the full unit suite to verify everything passes**

Run: `npm test`
Expected: 142 passed (132 baseline + 4 storage + 2 catalog + 2 mobile + 1 desktop + 1 desktop new = the counts above are indicative; the run must end with 0 failures).

- [ ] **Step 6: Commit**

```bash
git add src/App.test.jsx src/desktop-layout.test.jsx src/components/AlbumResults.jsx src/screens/AlbumsScreen.jsx src/screens/SearchScreen.jsx src/App.jsx src/App.css
git commit -m "feat: favorite albums from the directory menu"
```

---

### Task 4: Full verification and acceptance gate

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: all tests pass, 0 failures.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, `dist/` emitted.

- [ ] **Step 4: Browser smoke (Playwright E2E)**

Run: `npx playwright test`
Expected: 2 passed (home/player/queue/search/album smoke and reduced-motion smoke). If Chromium is missing locally, run `npx playwright install chromium` first.

- [ ] **Step 5: Manual acceptance in the app browser (optional but requested before push)**

Serve the built app locally (`npm run preview -- --port 4173 --host 127.0.0.1`), then verify in the in-app browser:
1. Mobile width: 全部专辑 → city-channel albums at the bottom; three-dot on each row; 收藏专辑 moves an album to the top; 取消收藏 restores order; state survives reload.
2. Desktop width: search grid → same three-dot behavior on cards.

- [ ] **Step 6: Commit remains clean and branch is ready**

Run: `git status` and `git log --oneline -4`
Expected: only the three feature commits on `codex/album-favorites`, working tree clean.

---

## Deployment after acceptance

Only after the user approves the acceptance results:

1. Fetch the latest main (the automated catalog workflow may have moved `origin/main`): `git fetch origin`
2. Rebase the branch onto `origin/main`: `git rebase origin/main`
3. Fast-forward `main` and push:

```bash
git checkout main
git merge --ff-only codex/album-favorites
git push origin main
```

The `deploy.yml` workflow publishes GitHub Pages from the pushed `main`. Preserve the untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` in the main checkout (do not delete it).
