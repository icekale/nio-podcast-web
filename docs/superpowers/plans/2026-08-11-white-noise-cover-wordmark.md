# White Noise Cover Wordmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chinese title and duplicate corner label on both white-noise covers with one centered `NIO Radio` wordmark matching the supplied references.

**Architecture:** Re-render the existing 1200x1200 geometric cover deterministically with Pillow so the water rings remain crisp and identical across themes. Compose `NIO` in Helvetica Neue Bold and `Radio` in Helvetica Neue Light, center the combined wordmark near the bottom, and keep all application code and asset paths unchanged.

**Tech Stack:** PNG, Pillow, macOS Helvetica Neue TTC

---

### Task 1: Re-render the paired cover assets

**Files:**
- Modify: `public/covers/white-noise-light.png`
- Modify: `public/covers/white-noise-dark.png`

- [ ] **Step 1: Render both 1200x1200 covers**

Use a 4x supersampled Pillow canvas. Draw the six existing concentric rings centered at `(720, 480)` with radii `88, 180, 285, 406, 541, 696` and a 4px final stroke. Use the existing theme colors. Draw `NIO` with Helvetica Neue Bold and `Radio` with Helvetica Neue Light, scale the combined wordmark to about 55% of the canvas width, center it horizontally, and place it in the former title band near the bottom.

- [ ] **Step 2: Validate the assets mechanically**

Run a Pillow check that asserts both files are RGB PNG images at exactly `1200x1200`, contain their expected background and wordmark colors, and differ from their previous Git versions.

- [ ] **Step 3: Inspect full-size and thumbnail previews**

Open both final PNGs and a contact sheet containing 64px and 120px previews. Confirm that the wordmark reads as one unit, neither theme has duplicate branding, and the rings remain clean behind it.

- [ ] **Step 4: Run project verification**

Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`. Expected: all commands exit with status 0.

- [ ] **Step 5: Commit the cover replacement**

```bash
git add public/covers/white-noise-light.png public/covers/white-noise-dark.png
git commit -m "feat: update white noise cover branding"
```
