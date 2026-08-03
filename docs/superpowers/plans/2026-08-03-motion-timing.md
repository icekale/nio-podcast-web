# Calmer Mobile Motion Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slow and smooth NIO Radio's existing route and playback-queue transitions so mobile navigation feels deliberate without changing behavior.

**Architecture:** Keep the current CSS-only motion system and React queue lifecycle. Add timing assertions to the existing CSS rendering contract tests, then change only route, backdrop, and queue-sheet animation durations/easing in `src/App.css`; preserve transforms, reduced-motion overrides, focus restoration, and route state.

**Tech Stack:** React 19, CSS keyframes, Vitest, Vite, GitHub Pages

---

### Task 1: Lock the approved motion cadence with a failing contract test

**Files:**
- Modify: `src/scroll-render.test.js` after the existing bounded-motion test

- [ ] **Step 1: Add the failing CSS timing test**

Add this test inside the existing `describe('mobile scroll rendering', () => { ... })` block:

```js
  it('uses the calmer route and queue motion cadence', () => {
    expect(css).toContain('.route-view[data-route-motion="forward"] { animation: route-forward-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }');
    expect(css).toContain('.route-view[data-route-motion="back"] { animation: route-back-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }');
    expect(css).toContain('animation: queue-backdrop-in 220ms ease-out both;');
    expect(css).toContain('animation: queue-sheet-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;');
    expect(css).toContain('.queue-sheet.is-closing { animation: queue-sheet-out 240ms cubic-bezier(0.4, 0, 0.2, 1) both; }');
    expect(css).toContain('.queue-overlay.is-closing .queue-backdrop { animation: queue-backdrop-out 180ms cubic-bezier(0.4, 0, 0.2, 1) both; }');
  });
```

- [ ] **Step 2: Run the focused test and confirm it fails for the old timings**

Run:

```bash
npm test -- src/scroll-render.test.js -t "calmer route and queue motion cadence"
```

Expected: the new test fails because the current CSS still contains `180ms`, `150ms`, `220ms`, `170ms`, and `140ms` values.

### Task 2: Apply the calmer CSS timings

**Files:**
- Modify: `src/App.css:75-77` for route entrances
- Modify: `src/App.css:257-260` for queue/backdrop motion

- [ ] **Step 1: Update route entrance declarations**

Replace the two route rules with:

```css
.route-view[data-route-motion="forward"] { animation: route-forward-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.route-view[data-route-motion="back"] { animation: route-back-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
```

Keep both keyframes and their `16px` transforms unchanged.

- [ ] **Step 2: Update queue and backdrop declarations**

Replace the four queue declarations with:

```css
.queue-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; background: rgba(6, 18, 32, 0.38); cursor: default; animation: queue-backdrop-in 220ms ease-out both; }
.queue-sheet { position: absolute; right: 0; bottom: 0; left: 50%; display: flex; width: min(100%, 430px); max-height: min(78dvh, 720px); flex-direction: column; padding: var(--space-3) var(--space-5) max(var(--space-4), env(safe-area-inset-bottom)); transform: translateX(-50%); background: var(--surface); border-radius: 1.25rem 1.25rem 0 0; box-shadow: var(--shadow-sheet); animation: queue-sheet-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.queue-sheet.is-closing { animation: queue-sheet-out 240ms cubic-bezier(0.4, 0, 0.2, 1) both; }
.queue-overlay.is-closing .queue-backdrop { animation: queue-backdrop-out 180ms cubic-bezier(0.4, 0, 0.2, 1) both; }
```

Keep all queue keyframes, overlay lifecycle classes, and reduced-motion CSS unchanged.

- [ ] **Step 3: Run the focused test and confirm it passes**

Run:

```bash
npm test -- src/scroll-render.test.js -t "calmer route and queue motion cadence"
```

Expected: 1 test passes.

- [ ] **Step 4: Commit the focused implementation**

Run:

```bash
git add src/App.css src/scroll-render.test.js
git commit -m "fix: slow down mobile transitions"
```

Expected: one commit contains only the CSS timing changes and their contract test.

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

Expected: all 116 tests pass, lint exits `0`, the Vite build completes, and `git diff --check` prints nothing.

- [ ] **Step 2: Confirm the diff is limited to the approved motion files**

Run:

```bash
git status --short --branch
git show --stat --oneline HEAD
```

Expected: the worktree is clean and the implementation commit lists only `src/App.css` and `src/scroll-render.test.js`; the design and plan commits remain earlier in branch history.

### Task 4: Verify mobile interaction and reduced motion

**Files:**
- No repository file changes.

- [ ] **Step 1: Start a local production-like dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 4175
```

Expected: Vite serves the app at `http://127.0.0.1:4175/`.

- [ ] **Step 2: Check route transitions at a phone viewport**

Open `http://127.0.0.1:4175/#/` at `430x932`, click the unique `全部专辑` button, observe the directory entrance, then click `返回主页` and observe the reverse entrance.

Expected: both transitions visibly take longer than the old version, move only about `16px`, have no horizontal overflow or title ghosting, and remain interactive after the animation completes.

- [ ] **Step 3: Check queue transitions and reduced motion**

Start playback, click the unique `打开播放列表` button, wait for the sheet to settle, then click `收起播放列表` or `关闭播放列表`. Repeat with the browser's reduced-motion emulation enabled.

Expected: the sheet rises over a clearly readable but non-blocking interval, exits smoothly without snapping, focus returns to the queue trigger, and reduced-motion mode changes state immediately without breaking open/close behavior.

- [ ] **Step 4: Stop the local server after verification**

Terminate the Vite process started in Step 1 and confirm no long-running command remains.

### Task 5: Merge, deploy, and verify the live site

**Files:**
- No additional file changes.

- [ ] **Step 1: Merge the clean feature branch into main**

Run from the main worktree:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/refine-motion-timing
```

Expected: `main` fast-forwards to the motion-timing implementation commit without changing the existing untracked `docs/superpowers/plans/2026-08-03-review-fixes.md`.

- [ ] **Step 2: Push main and monitor Pages deployment**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: `origin/main` updates and a new `Deploy NIO Radio to GitHub Pages` run starts for the pushed commit.

- [ ] **Step 3: Verify the workflow and live endpoints**

Run:

```bash
gh run watch --repo icekale/nio-podcast-web "$(gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
curl -fsSI https://nio.k4le.top/ | head -n 1
curl -fsSI https://nio.k4le.top/manifest.webmanifest | head -n 1
```

Expected: the Pages workflow succeeds, the app returns `HTTP/2 200`, and the manifest returns `HTTP/2 200`.
