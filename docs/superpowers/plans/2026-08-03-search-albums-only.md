# Desktop Search-Only Album Browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 全部专辑 from the desktop sidebar, make 搜索 the album browser, and hide the redundant home top-bar buttons on desktop.

**Architecture:** `DesktopNav` drops its 全部专辑 item; `SearchScreen` passes the grid flag to `AlbumResults`; CSS hides the home top-bar buttons at `min-width: 1024px`. Mobile routes and layouts stay unchanged.

**Tech Stack:** React 19, CSS, Vitest, React Testing Library

---

### Task 1: Update the failing desktop tests

**Files:**
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Update the sidebar and grid tests**

In `src/desktop-layout.test.jsx`:

- Assert the sidebar has no 全部专辑 button.
- Click 搜索, assert the searchbox and both album cards are visible without a keyword, then filter and clear.

- [ ] **Step 2: Add the CSS contract assertion**

In `src/scroll-render.test.js`, add:

```js
    expect(css).toMatch(/\.home-screen \.top-bar \.icon-button:first-child,\s*\.home-screen \.top-bar \.top-actions \.icon-button\s*\{[^}]*display:\s*none/);
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:

```bash
npm test -- src/desktop-layout.test.jsx
npm test -- src/scroll-render.test.js -t "desktop shell"
```

Expected: the sidebar still has 全部专辑, the search page shows rows, and the CSS rule is absent.

### Task 2: Implement the search-only album browsing

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Remove the sidebar albums item**

Delete the 全部专辑 button and the `onAlbums` prop from `DesktopNav`, and stop passing `onAlbums` in the `App` render.

- [ ] **Step 2: Render the search results as a grid**

In `SearchScreen`, change the `AlbumResults` call to:

```jsx
        <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} grid />
```

- [ ] **Step 3: Hide the redundant home top-bar buttons on desktop**

Add to the desktop media block in `src/App.css`:

```css
  .home-screen .top-bar .icon-button:first-child,
  .home-screen .top-bar .top-actions .icon-button { display: none; }
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
git commit -m "feat: make search the desktop album browser"
```

### Task 4: Merge, deploy, and verify

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main and push**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/search-albums-only
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

- [ ] **Step 2: Watch the Pages run and verify the live build**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: deploy succeeds and the live site serves the newest assets.
