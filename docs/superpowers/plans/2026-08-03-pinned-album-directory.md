# Pinned Album Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin `资讯充电站·早间版` and `资讯充电站·晚间版` at the top of the full album directory while leaving home, search, and picker ordering unchanged.

**Architecture:** Add one client-side directory-order selector in `src/catalog.js` that emits the pinned albums first and then applies the existing latest-episode ordering to the rest. Use it only in `AlbumsScreen`; no catalog JSON or generator changes.

**Tech Stack:** React 19, Vitest, React Testing Library, Vite

---

### Task 1: Write the failing pinned-order tests

**Files:**
- Modify: `src/catalog.test.js`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add the selector test**

Append this test to `describe('catalog selectors', ...)`:

```js
  it('pins the briefing albums ahead of latest-updated albums for the directory', () => {
    const albums = [
      { id: 7, name: '普通专辑', latestEpisode: episode(71, 400) },
      { id: 23, name: '资讯充电站·晚间版', latestEpisode: episode(231, 100) },
      { id: 5, name: '资讯充电站·早间版', latestEpisode: episode(51, 200) },
      { id: 1, name: '旧专辑', latestEpisode: episode(11, 300) },
    ];

    expect(sortAlbumsForDirectory(albums).map(album => album.id)).toEqual([5, 23, 7, 1]);
  });
```

Update the catalog test import to include `sortAlbumsForDirectory`.

- [ ] **Step 2: Add the application directory-order test**

Add this test to `describe('mobile app shell', ...)`:

```jsx
  it('shows the pinned briefing albums first in the full album directory', async () => {
    const pinnedCatalog = {
      ...catalog,
      albums: [
        { id: 7, name: '普通专辑', description: '', imageUrl: '', latestEpisode: { ...episode(71, '最新节目'), onlineTime: Date.now() + 100000 } },
        { id: 23, name: '资讯充电站·晚间版', description: '', imageUrl: '', latestEpisode: episode(231, '晚间节目', Date.now() - 100000) },
        { id: 5, name: '资讯充电站·早间版', description: '', imageUrl: '', latestEpisode: episode(51, '早间节目', Date.now() - 200000) },
      ],
    };
    render(<App initialCatalog={pinnedCatalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });

    const rows = screen.getAllByRole('button', { name: /资讯充电站|普通专辑/ });
    expect(rows[0]).toHaveAccessibleName('资讯充电站·早间版早间节目');
    expect(rows[1]).toHaveAccessibleName('资讯充电站·晚间版晚间节目');
    expect(rows[2]).toHaveAccessibleName('普通专辑最新节目');
  });
```

- [ ] **Step 3: Run the focused tests and confirm they fail**

Run:

```bash
npm test -- src/catalog.test.js -t "pins the briefing albums"
npm test -- src/App.test.jsx -t "pinned briefing albums"
```

Expected: both fail because `sortAlbumsForDirectory` is not exported and the directory still uses catalog order.

### Task 2: Implement the directory-order selector

**Files:**
- Modify: `src/catalog.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the selector to the catalog module**

Add after `sortAlbumsByLatest`:

```js
const PINNED_ALBUM_IDS = [5, 23];

export function sortAlbumsForDirectory(albums) {
  const pinnedIds = new Set(PINNED_ALBUM_IDS.map(Number));
  const pinned = [];
  const rest = [];
  for (const album of albums) {
    if (pinnedIds.has(Number(album.id))) {
      pinned.push(album);
    } else {
      rest.push(album);
    }
  }
  const pinnedOrder = new Map(PINNED_ALBUM_IDS.map((id, index) => [id, index]));
  pinned.sort((a, b) => pinnedOrder.get(Number(a.id)) - pinnedOrder.get(Number(b.id)));
  return [...pinned, ...sortAlbumsByLatest(rest)];
}
```

- [ ] **Step 2: Use the selector in the full album directory**

Update the catalog import in `src/App.jsx`:

```js
import { loadCatalog, normalizeCatalog, selectHomeEpisodes, sortAlbumsForDirectory } from './catalog';
```

Update `AlbumsScreen` to order albums before rendering:

```jsx
const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum }) {
  const orderedAlbums = useMemo(() => sortAlbumsForDirectory(catalog.albums), [catalog.albums]);
  return (
    <div className="screen albums-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">全部专辑</span>
        <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
      </header>
      <section className="search-results" aria-labelledby="albums-title">
        <div className="section-heading-row"><h1 id="albums-title">全部专辑</h1><span className="section-count">{catalog.albums.length}</span></div>
        <AlbumResults albums={orderedAlbums} onOpenAlbum={onOpenAlbum} />
        {!catalog.albums.length ? <div className="empty-state">暂无可用专辑</div> : null}
      </section>
    </div>
  );
});
```

Keep the count from `catalog.albums.length` unchanged.

- [ ] **Step 3: Run the focused tests and confirm they pass**

Run:

```bash
npm test -- src/catalog.test.js -t "pins the briefing albums"
npm test -- src/App.test.jsx -t "pinned briefing albums"
```

Expected: both tests pass.

- [ ] **Step 4: Commit the focused implementation**

Run:

```bash
git add src/catalog.js src/App.jsx src/catalog.test.js src/App.test.jsx
git commit -m "feat: pin briefing albums in album directory"
```

### Task 3: Run complete automated verification

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

Expected: all 118 tests pass, lint exits `0`, the Vite build completes, and `git diff --check` prints nothing.

- [ ] **Step 2: Confirm the diff is limited to the approved files**

Run:

```bash
git status --short --branch
git show --stat --oneline HEAD
```

Expected: the worktree is clean and the implementation commit lists only `src/catalog.js`, `src/App.jsx`, `src/catalog.test.js`, and `src/App.test.jsx`.

### Task 4: Verify the directory order in a mobile viewport

**Files:**
- No repository file changes.

- [ ] **Step 1: Start the local dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 4176
```

Expected: Vite serves the app at `http://127.0.0.1:4176/`.

- [ ] **Step 2: Open the full album directory at a phone viewport**

Open `http://127.0.0.1:4176/#/` at `430x932`, click the unique `全部专辑` button, and inspect the first two album rows.

Expected: `资讯充电站·早间版` appears first, `资讯充电站·晚间版` second, the header count is unchanged, and the home update list is unaffected.

- [ ] **Step 3: Stop the local server**

Terminate the Vite process from Step 1.

### Task 5: Merge and push the clean branch

**Files:**
- No additional file changes.

- [ ] **Step 1: Merge the feature branch into main**

Run from the main worktree:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/pin-albums
```

Expected: `main` fast-forwards to the pinned-directory commit without touching the existing untracked `docs/superpowers/plans/2026-08-03-review-fixes.md`.

- [ ] **Step 2: Push main**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

Expected: `origin/main` updates to the new commit. If GitHub connectivity is still unavailable, keep the local commits intact, report the failure, and retry later.

- [ ] **Step 3: Verify Pages after a successful push**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
curl -fsSI https://nio.k4le.top/ | head -n 1
```

Expected: a Pages run starts and the live app returns `HTTP/2 200`.
