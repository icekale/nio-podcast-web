# PC Favorite Star Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop album cards, replace the three-dot favorite menu with a direct star button beside the title: outline star when not favorited, filled amber star when favorited, one click toggles. Mobile keeps the three-dot menu.

**Architecture:** `AlbumResults` gains a `starAction` prop; when true (desktop only, via `App` passing `starAction={desktopLayout}`) it renders a new `FavoriteStarButton` in the existing `.album-action` slot instead of `FavoriteAlbumMenu`. Amber fill and hover are literal CSS colors. Accessibility uses `aria-pressed` and 收藏/取消收藏 labels.

**Tech Stack:** React 19, Vite, Vitest, React Testing Library, oxlint, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-04-pc-favorite-star-design.md`

**Worktree:** `.worktrees/favorite-star` on branch `codex/favorite-star` (baseline: 149 tests passing).

---

### Task 1: Switch desktop favorite tests to the star and assert states

**Files:**
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/App.favorites.test.jsx`
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Update the desktop grid favorite test to the star button**

In `src/desktop-layout.test.jsx`, inside `it('favorites an album from the desktop grid and pins it first', ...)`, replace the menu clicks:

```jsx
  fireEvent.click(screen.getByRole('button', { name: '管理 另一张专辑' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '收藏专辑' }));
```

with:

```jsx
  fireEvent.click(screen.getByRole('button', { name: '收藏 另一张专辑' }));
  expect(screen.getByRole('button', { name: '取消收藏 另一张专辑' })).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 2: Update the favorites integration test and add star-state assertions**

In `src/App.favorites.test.jsx`, inside `it('shows only favorited albums in newest-first order', ...)`, after the accessible-name assertions add:

```jsx
    expect(screen.getByRole('button', { name: '取消收藏 资讯充电站·早间版' })).toHaveAttribute('aria-pressed', 'true');
```

In the same file, inside `it('removes a card immediately when unfavorited', ...)`, replace the menu clicks:

```jsx
  fireEvent.click(screen.getByRole('button', { name: '管理 另一张专辑' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '取消收藏' }));
```

with:

```jsx
  fireEvent.click(screen.getByRole('button', { name: '取消收藏 另一张专辑' }));
```

Append a new test inside `describe('desktop favorites collection', ...)`:

```jsx
it('toggles the star on the desktop search grid', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '搜索' }));
  await screen.findByRole('searchbox', { name: '搜索专辑' });

  const star = screen.getByRole('button', { name: '收藏 另一张专辑' });
  expect(star).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(star);
  expect(screen.getByRole('button', { name: '取消收藏 另一张专辑' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 3: Add the amber-star CSS contract**

In `src/scroll-render.test.js`, inside the `it('places the grid card action beside the title row', ...)` test, append:

```js
    expect(css).toMatch(/\.album-results\.is-grid \.album-action \.favorite-star\.is-favorite\s*\{[^}]*color:\s*#f2a900/);
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/desktop-layout.test.jsx src/App.favorites.test.jsx src/scroll-render.test.js`
Expected: FAIL — no button labeled 收藏/取消收藏 exists on desktop grids, and the amber rule is missing.

---

### Task 2: Implement the star button and wire it to desktop only

**Files:**
- Modify: `src/components/AlbumResults.jsx`
- Modify: `src/screens/AlbumsScreen.jsx`
- Modify: `src/screens/SearchScreen.jsx`
- Modify: `src/screens/FavoritesScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add the star button to AlbumResults**

In `src/components/AlbumResults.jsx`, change the icon import and add the component:

```jsx
import { ChevronRight, MoreHorizontal, Star } from 'lucide-react';
```

Add `FavoriteStarButton` next to `FavoriteAlbumMenu`:

```jsx
function FavoriteStarButton({ album, favorited, onToggle }) {
  return (
    <div className="album-action">
      <button type="button" className="icon-button favorite-star" aria-label={favorited ? `取消收藏 ${album.name}` : `收藏 ${album.name}`} aria-pressed={favorited} onClick={() => onToggle(album.id)}>
        <Star size={16} aria-hidden="true" fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
```

Update the component signature and the action rendering:

```jsx
export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender, grid = false, favoriteIds = [], onToggleFavorite, starAction = false }) {
```

and replace the menu render:

```jsx
            {onToggleFavorite ? <FavoriteAlbumMenu album={album} favorited={favorited} onToggle={onToggleFavorite} /> : null}
```

with:

```jsx
            {onToggleFavorite ? (starAction ? <FavoriteStarButton album={album} favorited={favorited} onToggle={onToggleFavorite} /> : <FavoriteAlbumMenu album={album} favorited={favorited} onToggle={onToggleFavorite} />) : null}
```

- [ ] **Step 2: Thread `starAction` through the screens**

In `src/screens/AlbumsScreen.jsx`:

```jsx
export const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum, favoriteIds, onToggleFavorite, starAction }) {
```

and pass it to the results:

```jsx
        <AlbumResults albums={orderedAlbums} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} />
```

In `src/screens/SearchScreen.jsx`:

```jsx
export const SearchScreen = memo(function SearchScreen({ catalog, searchQuery = '', onBack, onQueryChange, onOpenAlbum, pinnedFirst = false, favoriteIds, onToggleFavorite, starAction }) {
```

and:

```jsx
        <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} />
```

In `src/screens/FavoritesScreen.jsx`:

```jsx
export const FavoritesScreen = memo(function FavoritesScreen({ catalog, favoriteIds, onToggleFavorite, onOpenAlbum, onBack, onBrowse, starAction }) {
```

and:

```jsx
        {favorites.length ? <AlbumResults albums={favorites} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} /> : (
```

Also update the empty-state hint text in `FavoritesScreen.jsx`:

```jsx
            <p>在「全部专辑」里点击专辑标题右侧的 ☆ 即可收藏。</p>
```

In `src/App.jsx`, pass `starAction={desktopLayout}` to all three screens:

```jsx
          {route.screen === 'albums' ? <AlbumsScreen catalog={catalogState.catalog} onBack={goBack} onSearch={openSearch} onOpenAlbum={openAlbum} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} starAction={desktopLayout} /> : null}
          {route.screen === 'search' ? <SearchScreen catalog={catalogState.catalog} searchQuery={route.searchQuery} onBack={goBack} onQueryChange={updateSearchQuery} onOpenAlbum={openAlbum} pinnedFirst={desktopLayout} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} starAction={desktopLayout} /> : null}
          {route.screen === 'favorites' ? <FavoritesScreen catalog={catalogState.catalog} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} onOpenAlbum={openAlbum} onBack={goBack} onBrowse={openSearch} starAction={desktopLayout} /> : null}
```

- [ ] **Step 3: Add the star styles**

In `src/App.css`, inside the `@media (min-width: 1024px)` block next to the grid action rules, add:

```css
  .album-results.is-grid .album-action .favorite-star { color: var(--muted); }
  .album-results.is-grid .album-action .favorite-star:hover { color: var(--teal-dark); }
  .album-results.is-grid .album-action .favorite-star.is-favorite { color: #f2a900; }
  .album-results.is-grid .album-action .favorite-star.is-favorite:hover { color: #d99a00; }
```

- [ ] **Step 4: Run the full unit suite to verify everything passes**

Run: `npm test`
Expected: 150 passed (149 baseline + 1 new toggle test; the CSS contract assertion is added inside an existing test), 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/desktop-layout.test.jsx src/App.favorites.test.jsx src/scroll-render.test.js src/components/AlbumResults.jsx src/screens/AlbumsScreen.jsx src/screens/SearchScreen.jsx src/screens/FavoritesScreen.jsx src/App.jsx src/App.css
git commit -m "feat: star favorite button on desktop album cards"
```

---

### Task 3: Full verification and acceptance gate

**Files:**
- Modify: `e2e/app.spec.js`

- [ ] **Step 1: Extend the desktop grid E2E to toggle the star**

In `e2e/app.spec.js`, inside `it('grid card action sits below the artwork beside the title', ...)`, append:

```js
    const star = page.locator('.album-results.is-grid .album-action button').first();
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 2: Lint, unit tests, build, and E2E**

Run: `npm run lint` → no errors.
Run: `npm test` → all pass, 0 failures.
Run: `npm run build` → build succeeds.
Run: `npm run e2e` → 5 passed.

- [ ] **Step 3: Browser acceptance**

Serve the built app (`npm run preview -- --port 4174 --host 127.0.0.1`) and verify headlessly at 1280px:
1. Search grid: outline star beside each title; clicking fills it amber (`aria-pressed` true); clicking again unfavorites.
2. Favorites page: seeded favorites show filled amber stars; clicking unfavorites removes the card.
3. Mobile (390px) 全部专辑: rows still show the three-dot menu, no star.
4. Screenshot the filled and unfilled states for visual confirmation.

- [ ] **Step 4: Commit and confirm the branch is ready**

```bash
git add e2e/app.spec.js
git commit -m "test: cover the desktop favorite star in browser smoke"
```

Run: `git status` and `git log --oneline -5` — working tree clean, two feature commits on `codex/favorite-star`.

---

## Deployment after acceptance

Only after the user approves the acceptance results:

1. `git fetch origin` (the automated catalog workflow may have moved `origin/main`).
2. Rebase if needed: `git rebase origin/main`.
3. Fast-forward main and push:

```bash
git checkout main
git merge --ff-only codex/favorite-star
git push origin main
```

`deploy.yml` publishes GitHub Pages from the pushed `main`. Keep the untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` untouched.
