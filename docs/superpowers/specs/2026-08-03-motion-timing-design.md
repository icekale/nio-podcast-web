# NIO Radio Mobile Motion Timing Design

## Goal

Make the existing mobile route and playback-queue transitions feel calmer and less abrupt while preserving their current behavior, layout, and accessibility semantics.

## Scope

Adjust only the CSS timing and easing for:

- Home, album directory, search, and album-detail route entrances.
- Playback queue backdrop and bottom-sheet entrance/exit.

Keep the existing transform distances, queue presence lifecycle, focus restoration, scroll behavior, fixed mini-player, and reduced-motion behavior unchanged.

## Motion Design

### Route transitions

Both `forward` and `back` route entrances use `260ms` with the existing ease-out quintic curve. The existing `16px` horizontal offset remains because it communicates navigation direction without making the page appear to slide away.

### Playback queue

The backdrop fades in over `220ms` while the sheet rises over `320ms`, allowing the surface to settle after the page context dims. On exit, the backdrop fades over `180ms` and the sheet leaves over `240ms`. Exit uses a smooth standard ease-in-out curve instead of the current steep ease-in curve so the final frame does not snap away.

Only `transform` and `opacity` are animated. No layout properties, blur, persistent `will-change`, or additional animation dependency is introduced.

## Accessibility

The existing `prefers-reduced-motion: reduce` rule continues to reduce animation and transition duration to an effectively immediate value. Queue focus management, keyboard dismissal, browser history, and swipe dismissal are unchanged.

## Verification

- Add a focused CSS contract test that checks the route, backdrop, sheet, and exit durations and confirms the reduced-motion override remains present.
- Run the full Vitest suite, lint, production build, and `git diff --check`.
- Verify the deployed mobile UI at a 430px-wide viewport for route navigation and queue open/close; confirm the transitions are visibly slower but do not block interaction or create overflow.

## Non-goals

- No new motion library.
- No new animation surfaces or decorative choreography.
- No changes to route state, queue behavior, catalog data, player behavior, or backend workflows.
