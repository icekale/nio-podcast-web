# Afternoon Catalog Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore daily incremental catalog refreshes at 17:00, 17:30, 19:00, and 20:00 Beijing time.

**Architecture:** Keep the existing GitHub Actions catalog workflow and add four UTC cron expressions to its schedule. Extend the existing workflow configuration test so the requested times remain protected against regression.

**Tech Stack:** GitHub Actions YAML, Vitest, Node.js 22

---

### Task 1: Restore afternoon and evening schedules

**Files:**
- Modify: `scripts/workflow-config.test.js`
- Modify: `.github/workflows/update-catalog.yml`

- [ ] **Step 1: Write the failing configuration assertions**

Add these assertions beside the existing catalog cron assertions in `scripts/workflow-config.test.js`:

```js
expect(workflow).toContain("- cron: '0 9 * * *'");
expect(workflow).toContain("- cron: '30 9 * * *'");
expect(workflow).toContain("- cron: '0 11 * * *'");
expect(workflow).toContain("- cron: '0 12 * * *'");
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
npm test -- scripts/workflow-config.test.js
```

Expected: the `catalog update workflow` schedule test fails because the four cron lines are absent.

- [ ] **Step 3: Add the four daily schedules**

Add these entries under `on.schedule` in `.github/workflows/update-catalog.yml`, preserving the existing schedules:

```yaml
    - cron: '0 9 * * *' # Beijing 17:00
    - cron: '30 9 * * *' # Beijing 17:30
    - cron: '0 11 * * *' # Beijing 19:00
    - cron: '0 12 * * *' # Beijing 20:00
```

Scheduled events continue to use the workflow's existing default `incremental` mode; no mode-selection code changes are required.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run:

```bash
npm test -- scripts/workflow-config.test.js
```

Expected: all tests in `scripts/workflow-config.test.js` pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits with status 0 and no test, lint, build, or whitespace errors are reported.

- [ ] **Step 6: Commit the implementation**

```bash
git add .github/workflows/update-catalog.yml scripts/workflow-config.test.js docs/superpowers/plans/2026-08-11-afternoon-catalog-schedule.md
git commit -m "ci: restore afternoon catalog updates"
```
