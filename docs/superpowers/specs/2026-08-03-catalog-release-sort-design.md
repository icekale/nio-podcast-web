# Catalog Release And Sort Design

## Problem

The scheduled catalog job on 2026-08-03 successfully scanned 565 albums, detected catalog changes, passed 103 tests, lint, and the PWA build, then failed in `npm run deploy`. The `gh-pages` package creates a Git commit, but the workflow did not configure `user.name` and `user.email` until the later catalog commit step. Because deployment failed first, neither GitHub Pages nor `main` received the refreshed catalog.

The web client already sorts normalized albums by `latestEpisode.onlineTime` descending. NIO commonly assigns the same midnight timestamp to many episodes published on one day, so the client should use the same album-ID tie-breaker as the catalog generator to keep the full directory deterministic.

## Requirements

- A changed scheduled catalog must configure Git identity before `gh-pages` creates its deployment commit.
- Tests, lint, and build must still complete before deployment.
- The catalog source commit must still happen only after a successful Pages deployment.
- The full album directory must sort by latest episode time descending.
- Albums with the same latest episode time must sort by numeric album ID ascending, matching the generator.
- Existing custom-domain and legacy GitHub Pages URLs must remain valid.

## Design

Add a conditional `Configure Git identity` workflow step after the PWA build and before `Deploy GitHub Pages`. It will set the repository-local GitHub Actions bot identity once. Remove the duplicate identity commands from `Commit catalog state`; both deployment and source commit will then use the same configuration.

Extend `sortAlbumsByLatest` with the same numeric ID tie-breaker already used by `sortGeneratedAlbums`. `normalizeCatalog`, the home selector, search results, and the full album directory already consume this function, so no component-level branching or new state is needed.

## Testing

- Extend the workflow text test to require `Build PWA -> Configure Git identity -> Deploy GitHub Pages -> Commit catalog state` and verify the bot identity commands are present before deployment.
- Extend the catalog selector test with equal timestamps in unsorted input and require deterministic ID ordering.
- Run all tests, lint, production build, production dependency audit, and `git diff --check`.
- After merging to `main`, manually dispatch an incremental catalog update and wait for it to complete.
- Verify `main` receives the catalog commit and both public URLs serve a current `generatedAt`, latest episodes, manifest, and service worker.

## Recovery

If the manual run fails before deployment, no catalog source commit is made and the next run can retry. If it fails after deployment but before the catalog commit, Pages already has current data; rerunning the same incremental job safely recreates and commits the catalog state.
