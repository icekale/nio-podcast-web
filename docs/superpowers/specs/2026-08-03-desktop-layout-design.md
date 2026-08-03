# NIO Radio Desktop Layout Design

## Goal

Give NIO Radio a desktop experience by responsively extending the existing mobile web app at wide viewports, keeping the same codebase, URLs, playback state, design tokens, and overall style as the mobile version.

## Audience And Context

Desktop listeners want to browse programs and listen at the same time. The core scenario is "listen while browsing": the current program and the content list stay visible together, and the queue is reachable without leaving the page.

## Breakpoint And Shell

- Desktop layout activates at `min-width: 1024px`; tablets in portrait and phones keep the current mobile shell.
- The app container changes from the 430px mobile cap to a centered `max-width: 1280px` layout. The page background uses the existing `--surface-soft` token.
- Desktop shell structure: a fixed 220px left navigation column, a flexible main content area, and a full-width bottom player bar.

## Left Navigation

- Top shows the NIO Radio icon and name, reusing `public/favicon.svg` and the current typography tokens.
- Items: 今日推荐, 全部专辑, 搜索, 稍后播放. The active item is highlighted using the existing `--teal` / `--teal-dark` tokens.
- The sidebar exists only on desktop; mobile keeps the current top-bar buttons.

## Desktop Player Bar

- The existing `MiniPlayer` is upgraded at the desktop breakpoint: artwork and title on the left, play/pause and a wide progress slider in the middle, and a queue button on the right that opens the desktop drawer.
- Player bar height grows on desktop; it stays hidden until an episode is loaded, matching mobile behavior.

## Home Screen

- Left column: the 今日推荐 card with cover, title, album name, duration, and the 全部播放 button.
- Right column: the 今日更新 row list, reusing the mobile `EpisodeRow` markup and style with slightly larger cover art.
- The mobile single-column layout below the breakpoint is unchanged.

## Album Directory

- 全部专辑 renders as a responsive cover grid (4–6 columns) at the desktop breakpoint; the existing 100-item paging and 加载更多 button remain.
- Search results keep the row-list style on desktop.

## Album Detail

- Left column: large cover, album name, episode count, and description.
- Right column: the episode list with the existing row style, inline 稍后播放 action, and 加载更多 paging.

## Playback Queue Drawer

- On desktop, the queue button opens a 380px drawer sliding in from the right, over a translucent backdrop, reusing the existing `--shadow-sheet` and surface tokens.
- The drawer keeps the 播放列表 / 最近听过 / 稍后播放 tabs, all existing row actions, swipe/drag behaviors inside the later tab, focus containment, Escape/backdrop close, and the same closing lifecycle as the mobile `QueueSheet`.
- Mobile keeps the current bottom-sheet presentation.

## Search

- The search field sits at the top of the content area; results use the wide row list. Search state, query routing, and clear/back behavior are unchanged.

## Consistency Constraint

- Reuse the existing CSS custom properties in `:root`, component classes, typography, spacing, radii, and brand colors. No new color palette, fonts, or visual language.
- The desktop layout is expressed with media queries and shared components; the mobile layout and its tokens must remain pixel-identical below the breakpoint.

## Accessibility And Performance

- Keep `prefers-reduced-motion` handling, keyboard focus management, focus restoration after drawer close, and 44px touch targets.
- The drawer and player bar animate only transform/opacity; no new layout-driving animations.
- No changes to catalog fetching, caching, PWA scope, routes, or backend workflows.

## Verification

- Add automated tests for the desktop breakpoint classes, sidebar active states, drawer direction/presentation, and player bar layout.
- Run the full Vitest suite, lint, production build, and `git diff --check`.
- Verify desktop viewport (1280x800 and 1024x768) and mobile viewport (390x844) interactions, then deploy and confirm the live site.

## Non-goals

- No separate desktop route or new backend.
- No redesign of the mobile experience.
- No changes to audio caching, catalog freshness, or PWA install behavior.
