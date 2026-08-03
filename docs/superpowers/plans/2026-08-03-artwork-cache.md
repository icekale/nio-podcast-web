# Artwork Cache Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the artwork cache limit to 700 entries and switch to `StaleWhileRevalidate` so directory covers stay fast for returning users.

**Architecture:** Change only the PWA runtime-cache configuration, its contract test, and the README bullet. No application or backend changes.

**Tech Stack:** vite-plugin-pwa, Workbox, Vitest

---

### Task 1: Update the failing contract test

**Files:**
- Modify: `src/pwa.test.js:28-36`

- [ ] **Step 1: Change the artwork cache assertions**

Replace the `CacheFirst` and `150` assertions with:

```js
    expect(viteConfig).not.toContain("handler: 'CacheFirst'");
    expect(viteConfig).toContain("handler: 'StaleWhileRevalidate'");
    expect(viteConfig).toContain("cacheName: 'nio-artwork-v1'");
    expect(viteConfig).toContain('maxEntries: 700');
    expect(viteConfig).toContain('maxAgeSeconds: 30 * 24 * 60 * 60');
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- src/pwa.test.js -t "bounds artwork runtime caching"
```

Expected: fails because the config still uses `CacheFirst` and `150`.

### Task 2: Apply the cache configuration

**Files:**
- Modify: `vite.config.js:20-24`

- [ ] **Step 1: Update the artwork runtime cache**

Replace:

```js
            handler: 'CacheFirst',
```

with:

```js
            handler: 'StaleWhileRevalidate',
```

and replace:

```js
              expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
```

with:

```js
              expiration: { maxEntries: 700, maxAgeSeconds: 30 * 24 * 60 * 60 },
```

- [ ] **Step 2: Run the contract test and confirm it passes**

Run:

```bash
npm test -- src/pwa.test.js -t "bounds artwork runtime caching"
```

Expected: 1 test passes.

### Task 3: Update the README cache strategy

**Files:**
- Modify: `README.md:87`

- [ ] **Step 1: Rewrite the artwork cache bullet**

Replace:

```markdown
- 专辑封面使用有数量上限和 30 天有效期的 `CacheFirst` 缓存。
```

with:

```markdown
- 专辑封面使用最多 700 张、30 天有效期的 `StaleWhileRevalidate` 缓存，旧图即时展示并在后台更新。
```

### Task 4: Verify and commit

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

- [ ] **Step 2: Commit the change**

Run:

```bash
git add vite.config.js src/pwa.test.js README.md
git commit -m "perf: keep album artwork cached and fresh"
```

### Task 5: Merge, deploy, and verify

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main and push**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/artwork-cache
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

Expected: `main` advances and the push succeeds; the untracked user file stays untouched.

- [ ] **Step 2: Monitor Pages deployment and verify the live service worker**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
curl -fsS https://nio.k4le.top/sw.js | rg -o 'nio-artwork-v1|StaleWhileRevalidate' | sort -u
```

Expected: the workflow succeeds and the live service worker contains the artwork cache name and strategy.
