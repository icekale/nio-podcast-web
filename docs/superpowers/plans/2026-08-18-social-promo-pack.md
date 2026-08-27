# Social Promo Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the six Xiaohongshu images, one Bilibili cover, and paste-ready copy defined in the 2026-08-18 social promo spec.

**Architecture:** A Playwright script opens the live PWA, captures chrome-free screenshots, composites them into 1080×1440 / 1920×1080 cards, and writes `docs/promo/`. A contract test checks file existence and pixel size.

**Tech Stack:** Playwright Chromium, existing `pwa.test.js` PNG header reader pattern, Markdown copy file.

---

### Task 1: Contract test for promo assets

**Files:**
- Create: `scripts/promo-assets.test.js`

- [x] **Step 1: Write the failing test** for 1080×1440 × 6 and 1920×1080 cover
- [x] **Step 2: Run it and confirm it fails** because files are missing
- [x] **Step 3: Generate assets and re-run until green**

### Task 2: Capture and composite

**Files:**
- Create: `scripts/capture-promo.mjs`
- Create: `docs/promo/copy.md`
- Create: `docs/promo/*.png`

- [x] **Step 1: Capture home, queue, white-noise album, and desktop from https://nio.k4le.top/**
- [x] **Step 2: Composite six 3:4 cards and one 16:9 cover**
- [x] **Step 3: Write `copy.md` with the approved 小红书 / B 站 text**

### Task 3: Verify

- [x] **Step 1: `npm test -- scripts/promo-assets.test.js`**
- [x] **Step 2: Open the PNGs and confirm no browser chrome and readable type**
