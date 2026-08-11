# Desktop Album Back Navigation

## Goal

Restore a clear back action on desktop album detail pages without changing the existing mobile interaction or expanding the navigation model.

## Current Problem

`AlbumScreen` renders a back button for every viewport, but the desktop media query hides it. Desktop users who enter an album from the catalog, search, or favorites therefore have no visible in-app way to return.

## Design

- Keep the existing icon-only back button on mobile.
- On desktop, show the same button in the sticky album header with an `ArrowLeft` icon and the label `返回`.
- Use the existing `onBack` behavior so the action returns to the actual previous screen and preserves search, favorites, and scroll context.
- When an album is opened directly without in-app history, retain the existing fallback to `#/albums`.
- Reuse existing color, focus, hover, spacing, and typography tokens. Do not add breadcrumbs, a new sidebar destination, or decorative treatment.
- Keep the interactive target at least 44px high and retain the accessible name `返回专辑列表`.

## Responsive Layout

- Mobile: the button remains a 44px circular icon control; its visible text is hidden.
- Desktop: the button width expands to fit the icon and `返回` label. The album title and episode count continue to use the remaining header width without wrapping into the control.

## Verification

- Add a regression test proving the desktop media rule no longer hides the album back button and does not expose desktop text on mobile.
- Confirm the existing navigation test still returns to the originating screen.
- Run the full unit suite, lint, and production build.
- Check desktop and mobile album pages in the browser for layout, focus visibility, and text overflow.

## Scope

Only the album detail header and its responsive styles are changed. No route behavior, sidebar structure, catalog behavior, or player behavior changes.
