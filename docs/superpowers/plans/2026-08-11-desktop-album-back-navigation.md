# Desktop Album Back Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clear `ArrowLeft + 返回` action in desktop album headers while preserving the existing icon-only mobile control and current history behavior.

**Architecture:** Reuse the existing `AlbumScreen` button and `onBack` callback. Add one responsive label and adjust only the desktop header selectors so search and catalog headers keep their current behavior while album details expose the control.

**Tech Stack:** React 19, CSS media queries, Vitest, Testing Library, Vite

---

### Task 1: Add the desktop back-control regression tests

**Files:**
- Modify: `src/desktop-layout.test.jsx`
- Modify: `src/scroll-render.test.js`

- [ ] **Step 1: Write a component test for the visible return label**

Add this test to the `desktop navigation` suite in `src/desktop-layout.test.jsx`:

```jsx
it('labels the album back action for desktop users', () => {
  window.history.replaceState({ nioDepth: 0 }, '', '#/album/1');
  render(<App initialCatalog={catalog} />);

  const backButton = screen.getByRole('button', { name: '返回专辑列表' });
  expect(within(backButton).getByText('返回')).toBeInTheDocument();
});
```

- [ ] **Step 2: Replace the obsolete desktop CSS assertion**

In `src/scroll-render.test.js`, replace the assertion that expects the album back button to be hidden with these responsive contract assertions:

```js
expect(css).toMatch(/\.search-screen \.top-bar \.icon-button:first-child,\s*\.albums-screen \.top-bar \.icon-button:first-child\s*\{[^}]*display:\s*none/);
expect(css).not.toMatch(/\.album-screen \.top-bar \.icon-button:first-child\s*\{[^}]*display:\s*none/);
expect(css).toMatch(/\.album-back-label\s*\{[^}]*display:\s*none/);
expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)[\s\S]*\.album-back-label\s*\{[^}]*display:\s*inline/);
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- src/desktop-layout.test.jsx src/scroll-render.test.js
```

Expected: failures because `AlbumScreen` has no visible `返回` label and the desktop CSS still hides the album button.

### Task 2: Implement the responsive desktop control

**Files:**
- Modify: `src/screens/AlbumScreen.jsx:62-65`
- Modify: `src/App.css:106-119`
- Modify: `src/App.css:558-565`

- [ ] **Step 1: Add the responsive label to the existing button**

Change the album back button in `src/screens/AlbumScreen.jsx` to:

```jsx
<button type="button" className="icon-button album-back-button" aria-label="返回专辑列表" onClick={onBack}>
  <ArrowLeft size={25} />
  <span className="album-back-label">返回</span>
</button>
```

- [ ] **Step 2: Keep the label hidden on mobile**

Add next to the base icon-button rules in `src/App.css`:

```css
.album-back-label { display: none; }
```

- [ ] **Step 3: Expose and size the control at the desktop breakpoint**

Replace the current combined desktop selectors with:

```css
.search-screen .top-bar .icon-button:first-child,
.albums-screen .top-bar .icon-button:first-child { display: none; }
.search-screen .top-bar,
.albums-screen .top-bar { grid-template-columns: minmax(0, 1fr) auto; }
.album-screen .top-bar { grid-template-columns: auto minmax(0, 1fr); }
.album-screen .icon-button-spacer { display: none; }
.album-back-button {
  width: auto;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
}
.album-back-label { display: inline; }
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/desktop-layout.test.jsx src/scroll-render.test.js
```

Expected: both test files pass.

- [ ] **Step 5: Commit the tested implementation**

```bash
git add src/screens/AlbumScreen.jsx src/App.css src/desktop-layout.test.jsx src/scroll-render.test.js
git commit -m "fix: restore desktop album back navigation"
```

### Task 3: Verify responsive behavior and production readiness

**Files:**
- No additional source changes expected

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: 21 test files pass, lint exits with no findings, and Vite/PWA production build succeeds.

- [ ] **Step 2: Verify desktop behavior in the browser**

Open an album at a viewport at least 1024px wide. Confirm the sticky header shows the left-arrow icon and `返回`, the title and episode count do not overlap, hover/focus states use existing tokens, and activating the control returns to the originating catalog/search/favorites screen.

- [ ] **Step 3: Verify mobile behavior in the browser**

Open the same album at a 390px-wide viewport. Confirm the button remains icon-only, retains its `返回专辑列表` accessible name, and the header alignment matches the existing mobile layout.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff main...HEAD --check
git diff main...HEAD --stat
```

Expected: only the design/plan documents, album header component, responsive CSS, and focused tests are changed.
