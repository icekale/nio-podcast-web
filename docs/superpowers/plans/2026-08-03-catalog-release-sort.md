# Catalog Release And Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore scheduled catalog publication and guarantee deterministic latest-update ordering in the full album directory.

**Architecture:** Keep the current `gh-pages` deployment and React catalog normalization. Configure one repository-local bot identity before deployment, then align the client comparator with the generator's existing time-and-ID ordering.

**Tech Stack:** GitHub Actions, gh-pages, React 19, Vitest, Vite 8

---

### Task 1: Configure Deployment Git Identity

**Files:**
- Modify: `.github/workflows/update-catalog.yml`
- Test: `scripts/workflow-config.test.js`

- [ ] **Step 1: Write the failing workflow-order test**

Add `Configure Git identity` to the existing order assertions and require the bot configuration to occur before deployment:

```js
const build = workflow.indexOf('- name: Build PWA');
const configure = workflow.indexOf('- name: Configure Git identity');
const deploy = workflow.indexOf('- name: Deploy GitHub Pages');
const commit = workflow.indexOf('- name: Commit catalog state');

expect(configure).toBeGreaterThan(build);
expect(deploy).toBeGreaterThan(configure);
expect(commit).toBeGreaterThan(deploy);
expect(workflow.slice(configure, deploy)).toContain('git config user.name "github-actions[bot]"');
expect(workflow.slice(configure, deploy)).toContain('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- scripts/workflow-config.test.js`

Expected: FAIL because `Configure Git identity` does not exist before deployment.

- [ ] **Step 3: Add the conditional identity step**

Insert this step after `Build PWA`:

```yaml
      - name: Configure Git identity
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
```

Remove the same two commands from `Commit catalog state`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- scripts/workflow-config.test.js`

Expected: both workflow tests PASS.

- [ ] **Step 5: Commit the workflow fix**

```bash
git add .github/workflows/update-catalog.yml scripts/workflow-config.test.js
git commit -m "fix: configure catalog deployment identity"
```

### Task 2: Make Latest-Update Ordering Deterministic

**Files:**
- Modify: `src/catalog.js`
- Test: `src/catalog.test.js`

- [ ] **Step 1: Write the failing equal-time ordering test**

Extend the existing sorting test with equal timestamps:

```js
const albums = [
  { id: 20, latestEpisode: episode(20, 2) },
  { id: 5, latestEpisode: episode(5, 2) },
  { id: 1, latestEpisode: episode(1, 3) },
];
expect(sortAlbumsByLatest(albums).map(album => album.id)).toEqual([1, 5, 20]);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/catalog.test.js`

Expected: FAIL because equal timestamps currently retain input order `[20, 5]`.

- [ ] **Step 3: Add the generator-compatible tie-breaker**

Use this comparator:

```js
export function sortAlbumsByLatest(albums) {
  return [...albums].sort((a, b) => {
    const timeDifference = (Number(b.latestEpisode?.onlineTime) || 0)
      - (Number(a.latestEpisode?.onlineTime) || 0);
    if (timeDifference) return timeDifference;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/catalog.test.js`

Expected: all catalog selector tests PASS.

- [ ] **Step 5: Commit the sorting contract**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "fix: stabilize album update ordering"
```

### Task 3: Verify And Publish The Refreshed Catalog

**Files:**
- Verify only: application and deployment outputs

- [ ] **Step 1: Run complete local verification**

Run:

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
git diff --check
```

Expected: 0 test failures, 0 lint errors, a successful PWA build, 0 production vulnerabilities, and no whitespace errors.

- [ ] **Step 2: Merge and push the verified branch**

Fast-forward `main` to the verified branch and push `main` to `origin` without force-pushing.

- [ ] **Step 3: Dispatch an incremental catalog run**

Run:

```bash
gh workflow run update-catalog.yml --ref main -f mode=incremental
```

Expected: one `workflow_dispatch` run starts on the new `main` commit.

- [ ] **Step 4: Wait for the workflow to complete**

Use `gh run watch <run-id> --exit-status` and inspect failed logs if the command exits non-zero.

Expected: Generate, test, lint, build, identity configuration, Pages deployment, and catalog commit all succeed.

- [ ] **Step 5: Verify public freshness and ordering**

Fetch `https://nio.k4le.top/data/albums.json` and require:

- HTTP 200.
- `generatedAt` is from the current run.
- The known changed episode `声动早咖啡` is present.
- Album timestamps are non-increasing, with equal timestamps ordered by numeric album ID.
- The legacy Pages URL, manifest, and service worker return HTTP 200.
