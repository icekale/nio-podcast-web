# NIO SVG Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing generic favicon with a pure SVG version of the supplied NIO mark and expose it consistently through the browser and PWA metadata.

**Architecture:** Keep one canonical 512×512 SVG at `public/favicon.svg` with a full `#00BEBE` background and white vector paths. Reference that asset from the HTML favicon and PWA manifest while retaining the existing PNG icons only for Apple touch-icon fallback.

**Tech Stack:** Vite, vite-plugin-pwa, SVG, Vitest.

---

### Task 1: Lock the icon contract with tests

**Files:**
- Modify: `src/pwa.test.js`
- Test: `public/favicon.svg`, `index.html`, `vite.config.js`

- [ ] **Step 1: Write failing resource assertions**

Add tests that read the three source files and assert that `public/favicon.svg` contains a 512 viewBox, a `#00BEBE` background rectangle, white vector paths, and no `<image>` element; `index.html` points its favicon at `%BASE_URL%favicon.svg`; and `vite.config.js` declares the SVG in the PWA icon list.

- [ ] **Step 2: Run the focused test to verify the new assertions fail**

Run: `npm test -- --run src/pwa.test.js`

Expected: the existing cache tests pass and the new icon assertions fail because the current favicon is the old dark circular mark and the manifest has no SVG icon entry.

### Task 2: Create the canonical vector asset

**Files:**
- Modify: `public/favicon.svg`

- [ ] **Step 1: Replace the old SVG with the supplied mark**

Use a 512×512 SVG containing `<rect width="512" height="512" fill="#00BEBE"/>`, one white upper arch path, and one white lower chevron/rounded path. Keep all geometry inside the viewBox, with no external references or embedded raster image.

- [ ] **Step 2: Run the focused resource test**

Run: `npm test -- --run src/pwa.test.js`

Expected: all PWA cache and icon resource assertions pass.

### Task 3: Point PWA metadata at the SVG

**Files:**
- Modify: `vite.config.js`
- Test: `src/pwa.test.js`

- [ ] **Step 1: Add SVG to the manifest icon declarations**

Add `{ src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }` before the existing PNG icon declarations. Keep `includeAssets` unchanged so the existing Apple touch-icon files remain available.

- [ ] **Step 2: Build and inspect generated metadata**

Run: `npm run build`

Expected: build exits 0 and `dist/favicon.svg` plus `dist/manifest.webmanifest` exist; the generated manifest includes `favicon.svg`.

### Task 4: Full verification and visual preview

**Files:**
- No source changes unless a verification failure identifies a concrete issue.

- [ ] **Step 1: Run the complete project checks**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, lint is clean, and Vite produces a deployable `dist` directory.

- [ ] **Step 2: Preview the SVG in the local browser**

Serve the project with `npm run dev -- --host 127.0.0.1`, open the site at a phone-sized viewport, and inspect the favicon/PWA asset directly at `/nio-podcast-web/favicon.svg`. Confirm the teal square and white NIO mark match the supplied image.

- [ ] **Step 3: Commit the implementation**

```bash
git add public/favicon.svg vite.config.js src/pwa.test.js
git commit -m "feat: use NIO SVG app icon"
```

### Task 5: Publish to GitHub Pages

**Files:**
- No additional source changes.

- [ ] **Step 1: Push the main branch**

Run: `git push origin main`

Expected: `origin/main` contains the icon implementation commit.

- [ ] **Step 2: Deploy the built site**

Run: `npm run deploy`

Expected: `gh-pages` publishes the new `dist` output.

- [ ] **Step 3: Verify public assets**

Run: `curl -fsSL https://icekale.github.io/nio-podcast-web/favicon.svg`

Expected: HTTP 200 and the response contains `#00BEBE` and white vector paths.
