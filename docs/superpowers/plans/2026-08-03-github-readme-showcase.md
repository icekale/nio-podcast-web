# GitHub README Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present NIO Radio clearly to GitHub visitors with current mobile screenshots, a direct launch link, concise product guidance, and complete repository metadata.

**Architecture:** Keep the application and deployment code unchanged. Add two stable PNG assets under `docs/images/`, prepend a visitor-focused product section to `README.md`, preserve the existing development and operations documentation, and manage the repository About fields through the GitHub CLI.

**Tech Stack:** Markdown and GitHub-flavored HTML, the deployed React/Vite PWA, GitHub CLI, GitHub Actions

---

### Task 1: Capture the current production UI

**Files:**
- Create: `docs/images/nio-radio-home.png`
- Create: `docs/images/nio-radio-queue.png`

- [ ] **Step 1: Open the deployed PWA in a clean mobile viewport**

Use the in-app browser at `https://nio.k4le.top/#/` with a `430x932` viewport. Reload the page so the screenshots represent the deployed production build, then wait for album artwork and catalog content to settle.

Expected: the home screen shows `NIO Radio`, current catalog content, the fixed mini player, and no browser annotations or developer overlays.

- [ ] **Step 2: Capture the home screen**

Save a viewport-only screenshot as:

```text
docs/images/nio-radio-home.png
```

Expected: the image contains app content only, uses the current white safe-area treatment, and has no browser chrome.

- [ ] **Step 3: Open the playback queue and capture it**

Start playback from a visible episode if the mini player is not already populated, activate the queue button in the lower-right player controls, and wait for the queue transition to finish. Save a viewport-only screenshot as:

```text
docs/images/nio-radio-queue.png
```

Expected: the queue sheet is fully open, current/recent queue content is visible, and no focus outline, click marker, or annotation is present.

- [ ] **Step 4: Verify both image files**

Run:

```bash
test -s docs/images/nio-radio-home.png
test -s docs/images/nio-radio-queue.png
sips -g pixelWidth -g pixelHeight docs/images/nio-radio-home.png docs/images/nio-radio-queue.png
```

Expected: both `test` commands exit `0`; both images report `430` pixels wide and `932` pixels high.

### Task 2: Add the visitor-facing README introduction

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the current title and opening paragraph with the approved showcase**

Use this exact content before the existing `## 本地开发` section:

```markdown
<div align="center">
  <img src="public/favicon.svg" alt="NIO Radio 图标" width="88" height="88">
  <h1>NIO Radio</h1>
  <p>面向手机浏览器的 NIO 播客 PWA，每日更新节目，并在本地保存你的播放进度。</p>
</div>

<table>
  <tr>
    <td width="50%"><img src="docs/images/nio-radio-home.png" alt="NIO Radio 今日更新首页"></td>
    <td width="50%"><img src="docs/images/nio-radio-queue.png" alt="NIO Radio 播放列表"></td>
  </tr>
  <tr>
    <td align="center">今日更新</td>
    <td align="center">播放列表</td>
  </tr>
</table>

<p align="center"><strong><a href="https://nio.k4le.top/">立即体验 NIO Radio</a></strong></p>

## 主要功能

- 每日自动更新节目目录，并按最新节目时间展示专辑。
- 保存播放进度和最近听过的节目，重新打开后可以继续收听。
- 将任意节目加入“稍后播放”，在播放列表中统一管理。
- 支持添加到手机主屏幕，以接近原生应用的方式使用。

## 安装到主屏幕

- Android Chrome：打开 NIO Radio，在浏览器菜单中选择“安装应用”或“添加到主屏幕”。
- iPhone/iPad Safari：点击“分享”，然后选择“添加到主屏幕”。

## 开发与运维

NIO Radio 通过 GitHub Pages 发布，目录数据由 GitHub Actions 定时更新；所有播放进度、历史记录和“稍后播放”都保存在访问者自己的浏览器中。
```

Leave the existing sections from `## 本地开发` through `## 故障恢复` unchanged below this new introduction.

- [ ] **Step 2: Verify that every local README asset exists**

Run:

```bash
for asset in public/favicon.svg docs/images/nio-radio-home.png docs/images/nio-radio-queue.png; do test -s "$asset" || exit 1; done
rg -n '立即体验 NIO Radio|docs/images/nio-radio-home.png|docs/images/nio-radio-queue.png|## 本地开发|## 故障恢复' README.md
```

Expected: the command exits `0`; the search prints all required README markers and asset references.

- [ ] **Step 3: Check formatting and review the rendered layout**

Run:

```bash
git diff --check
```

Then inspect the README preview at desktop and narrow widths.

Expected: `git diff --check` prints nothing; the screenshots remain side by side on GitHub's normal repository view and scale within their table cells on narrow screens.

### Task 3: Run the repository checks and commit the showcase

**Files:**
- Create: `docs/images/nio-radio-home.png`
- Create: `docs/images/nio-radio-queue.png`
- Modify: `README.md`

- [ ] **Step 1: Run the existing automated checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: Vitest reports all tests passing, oxlint exits `0`, Vite completes the production build, and `git diff --check` prints nothing.

- [ ] **Step 2: Confirm the change is limited to the approved documentation assets**

Run:

```bash
git status --short
git diff --stat HEAD
git diff -- README.md
```

Expected: only `README.md` and the two files under `docs/images/` are part of the showcase implementation change; the already committed specification and implementation plan remain in branch history.

- [ ] **Step 3: Commit the README and screenshots**

Run:

```bash
git add README.md docs/images/nio-radio-home.png docs/images/nio-radio-queue.png
git commit -m "docs: showcase NIO Radio on GitHub"
```

Expected: Git creates one commit containing the README and both screenshots.

### Task 4: Update GitHub About metadata

**Files:**
- No repository file changes.

- [ ] **Step 1: Set the description and homepage**

Run:

```bash
gh repo edit icekale/nio-podcast-web \
  --description "面向手机浏览器的 NIO 播客 PWA，支持每日更新、播放进度、最近听过和稍后播放。" \
  --homepage "https://nio.k4le.top/"
```

Expected: the command exits `0`.

- [ ] **Step 2: Replace repository topics with the approved list**

Run:

```bash
gh api --method PUT repos/icekale/nio-podcast-web/topics \
  -f 'names[]=nio' \
  -f 'names[]=podcast' \
  -f 'names[]=pwa' \
  -f 'names[]=react' \
  -f 'names[]=vite' \
  -f 'names[]=github-pages'
```

Expected: the response contains exactly `nio`, `podcast`, `pwa`, `react`, `vite`, and `github-pages`.

- [ ] **Step 3: Verify all About fields**

Run:

```bash
gh api repos/icekale/nio-podcast-web --jq '{description, homepage}'
gh api repos/icekale/nio-podcast-web/topics --jq '.names'
```

Expected: the returned description, homepage, and six topics match the approved specification.

### Task 5: Merge, push, and verify publication

**Files:**
- No new file changes.

- [ ] **Step 1: Confirm both worktrees are safe to merge**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web/.worktrees/review-fixes status --short --branch
git -C /Users/kale/.openclaw/workspace/nio-podcast-web status --short --branch
```

Expected: the feature worktree is clean. Preserve the existing untracked `docs/superpowers/plans/2026-08-03-review-fixes.md` in the main worktree; do not add, modify, or remove it.

- [ ] **Step 2: Fast-forward main and push it**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/review-fixes
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

Expected: `main` advances to the showcase commit and the push updates `origin/main` without touching the untracked user file.

- [ ] **Step 3: Monitor the Pages workflow**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
gh run watch --repo icekale/nio-podcast-web "$(gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the newest `Deploy NIO Radio to GitHub Pages` run completes successfully.

- [ ] **Step 4: Verify the public repository and both site addresses**

Run:

```bash
gh api repos/icekale/nio-podcast-web/readme -H 'Accept: application/vnd.github.raw+json' | rg '立即体验 NIO Radio|nio-radio-home.png|nio-radio-queue.png'
curl -fsSI https://nio.k4le.top/ | head -n 1
curl -fsSI https://icekale.github.io/nio-podcast-web/ | head -n 1
```

Expected: the public README contains all three showcase markers; both URLs return a successful HTTP response or the expected GitHub Pages redirect.
