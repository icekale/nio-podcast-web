# PC UI Polish Design

## Goal

Improve desktop interaction feedback and motion without changing the mobile experience or the calm product character.

## 1. Sidebar Transitions

- `.desktop-nav-link` gains a 160ms background/color transition for hover and active states.
- The 安装应用 button fades and rises 4px over 200ms when it appears.

## 2. Album Hover Feedback

- Desktop cover-grid cards lift 2px with a soft shadow on hover (160ms) and scale to 0.98 on press.
- Row-style album results gain a hover background on desktop.

## 3. Desktop Player Entrance

- The mini player slides up and fades in over 200ms when it appears on desktop.
- When the player is dismissed, it slides down and fades out over 180ms using a short closing presence, then unmounts.
- Mobile keeps the previous instant behavior because the closing lifecycle only activates at the desktop breakpoint.

## 4. Search Debounce

- Search input updates the route immediately but filters the grid after a 120ms debounce.
- The result count pops subtly when it changes.

## 5. Desktop Route Motion

- At the desktop breakpoint, route transitions use 240ms and an 8px vertical rise instead of the mobile 16px horizontal slide. Mobile keyframes stay unchanged.

## 6. Drawer Row Stagger

- Playback-drawer rows fade and rise with a capped 30ms-per-row stagger (max 240ms total).
- The reduced-motion rule also zeroes `animation-delay`.

## Constraints

- All motion stays transform/opacity based and respects `prefers-reduced-motion`.
- No new animation library; no changes to route/queue/player logic beyond the player closing presence.
