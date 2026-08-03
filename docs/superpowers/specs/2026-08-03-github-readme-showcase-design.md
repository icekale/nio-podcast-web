# GitHub README Showcase Design

## Goal

Turn the repository front page into a visitor-facing introduction to NIO Radio while preserving the existing developer and operations documentation. The first screen should communicate what the app is, show the current mobile experience, and provide a direct path to the live site.

## Audience

The primary audience is a listener arriving from GitHub who may not know the implementation details. Developer information remains available after the product introduction but should not dominate the first screen.

## README Structure

1. Centered NIO Radio icon, product name, and one concise Chinese description.
2. Two large mobile screenshots placed side by side: the home screen and the playback queue.
3. A prominent link to `https://nio.k4le.top/` immediately below the screenshots.
4. A short feature section covering automatic catalog updates, playback progress, listening history, play later, and installable PWA behavior.
5. Brief mobile installation instructions for Chrome and Safari-compatible add-to-home-screen flows.
6. Existing local development, catalog generation, deployment, caching, and recovery documentation retained below the visitor-facing sections.

## Screenshot Specification

- Capture the current production application rather than reusing earlier reference images.
- Use a mobile viewport representative of a modern phone.
- Store screenshots under `docs/images/` with stable names suitable for README links.
- Capture one home view and one queue view.
- Ensure the fixed mini player, safe-area treatment, artwork, and current white system-bar theme are represented correctly.
- Avoid browser chrome, debugging overlays, selection markers, or stale UI from an earlier deployment.

## GitHub Repository Metadata

- Description: `面向手机浏览器的 NIO 播客 PWA，支持每日更新、播放进度、最近听过和稍后播放。`
- Homepage: `https://nio.k4le.top/`
- Topics: `nio`, `podcast`, `pwa`, `react`, `vite`, `github-pages`

## Validation

- Verify both README image paths resolve in the repository.
- Confirm the README remains readable when the screenshots wrap on a narrow viewport.
- Run the existing test, lint, and production build commands because README assets and repository changes will be pushed through the normal release workflow.
- Confirm the GitHub About description, homepage, and topics after updating them.
