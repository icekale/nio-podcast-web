# Desktop Albums And Search Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop sidebar's separate 搜索 entry with an inline search field in the 全部专辑 page, and hide the redundant desktop top-bar buttons.

**Architecture:** Keep the mobile routes intact. `DesktopNav` drops its 搜索 item; `AlbumsScreen` gains local search state and a desktop-only search field that filters the pinned grid; CSS hides the redundant buttons only at `min-width: 1024px`.

**Tech Stack:** React 19, CSS, Vitest, React Testing Library

---

### Task 1: Update the failing desktop tests

**Files:**
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Update the sidebar and filtering tests**

In `src/desktop-layout.test.jsx`:

- Assert the sidebar has no 搜索 button.
- After clicking 全部专辑, assert a 搜索专辑 searchbox exists, typing filters the grid, and the clear button restores all albums.

- [ ] **Step 2: Add the CSS contract assertions**

In `src/scroll-render.test.js`, extend the desktop shell test:

```js
    expect(css).toMatch(/\.albums-search\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)[\s\S]*\.albums-search\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)[\s\S]*\.home-screen \.top-bar \.icon-button:first-child\s*\{[^}]*display:\s*none/);
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:

```bash
npm test -- src/desktop-layout.test.jsx
npm test -- src/scroll-render.test.js -t "desktop shell"
```

Expected: the sidebar still shows 搜索, the albums page has no searchbox, and the CSS rules do not exist.

### Task 2: Implement the merged albums search

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Remove the sidebar search item**

In `DesktopNav`, delete the 搜索 button and the `onSearch` prop; update the `App` render call to stop passing `onSearch`.

- [ ] **Step 2: Add inline search to `AlbumsScreen`**

Add local query state and a filtered list, then render a desktop-only search field above `AlbumResults`:

```jsx
  const [query, setQuery] = useState('');
  const orderedAlbums = useMemo(() => sortAlbumsForDirectory(catalog.albums), [catalog.albums]);
  const filteredAlbums = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return orderedAlbums;
    return orderedAlbums.filter(album => `${album.name} ${album.description} ${album.host}`.toLowerCase().includes(value));
  }, [orderedAlbums, query]);
```

Replace the heading count with `filteredAlbums.length`, pass `filteredAlbums` to `AlbumResults`, add the search field and empty state, and keep the grid prop.

- [ ] **Step 3: Add the desktop CSS**

Add base `.albums-search { display: none; }`, and inside the desktop media block:

```css
  .albums-search { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
  .albums-search .search-field-wrap { flex: 1; }
  .home-screen .top-bar .icon-button:first-child,
  .home-screen .top-bar .top-actions .icon-button { display: none; }
  .albums-screen .top-bar .icon-button:last-child { display: none; }
```

- [ ] **Step 4: Run the desktop tests**

Run:

```bash
npm test -- src/desktop-layout.test.jsx
npm test -- src/scroll-render.test.js -t "desktop shell"
```

Expected: all pass.

### Task 3: Full verification and commit

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

Expected: all tests pass, lint exits `0`, the build completes, and `git diff --check` prints nothing.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/App.jsx src/App.css src/desktop-layout.test.jsx src/scroll-render.test.js
git commit -m "feat: merge albums and search in desktop sidebar"
```

### Task 4: Merge, deploy, and verify

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main and push**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/albums-search
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

- [ ] **Step 2: Watch the Pages run and verify the live build**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: deploy succeeds and the live site serves the newest assets.
