# Afternoon Catalog Schedule Design

**Date:** 2026-08-11

**Goal:** Restore the four daily catalog refreshes that cover NIO Radio's late-afternoon and evening publishing window.

## Design

Keep GitHub Actions as the scheduler and retain the existing catalog update workflow. Add four daily cron entries to `.github/workflows/update-catalog.yml`:

- `0 9 * * *` for 17:00 Beijing time
- `30 9 * * *` for 17:30 Beijing time
- `0 11 * * *` for 19:00 Beijing time
- `0 12 * * *` for 20:00 Beijing time

These scheduled runs use the workflow's existing default incremental mode. Existing 07:30, 18:00, 21:00, 24:00, and 02:00 schedules remain unchanged. This is preferred over adding an external scheduler or changing the catalog generator because it restores the requested coverage with the smallest possible change and follows the repository's existing scheduling model.

## Testing

Update `scripts/workflow-config.test.js` first so the workflow configuration test requires all four restored cron expressions. Verify that the targeted test fails before editing the workflow, then add the four schedules and run the targeted test, full test suite, lint, and production build.

## Scope

This change does not alter catalog generation, frontend selection logic, deployment behavior, or the separate catalog freshness health check.
