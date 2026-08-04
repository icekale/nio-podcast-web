# PC Favorites Collection Design

## Goal

Add a PC-only 我的收藏 destination in the desktop sidebar that shows the user's favorited albums in the album-cover grid, with an empty state. Mobile keeps today's behavior: favorited albums pin to the top of 全部专辑 and there is no separate favorites page (user decision).

## Navigation

- The desktop sidebar gains a 我的收藏 link after 稍后播放. The link is text-only, matching the current sidebar links (the preview mockup showed star icons on every link; adding icons to all links is an optional follow-up, not part of this change).
- New route `#/favorites` maps to screen `favorites` in `parseHash`. The sidebar link opens it; back from favorites returns home.
- Mobile has no entry for favorites. Direct hash access on mobile renders the same screen with a back top bar (harmless; no dedicated mobile entry).
- The screen's own top bar is hidden on desktop, consistent with the other screens.

## Favorites screen

- Heading 我的收藏 plus the favorited count, styled like the search page heading.
- The album-cover grid below shows only favorited albums, newest favorite first (the `nio_favorite_albums_v1` id order), reusing `AlbumResults` in grid mode with the favorite menu. The three-dot menu shows 取消收藏 and removes the card immediately.
- Empty state (zero favorites): a star icon, 还没有收藏专辑, a hint pointing at the three-dot menu in 全部专辑, and a 去全部专辑看看 button that opens `#/search`.

## Data flow

- Reuse the existing `favoriteAlbums` state at the `App` root (already persisted to `nio_favorite_albums_v1`).
- FavoritesScreen receives `favoriteIds`, `onToggleFavorite`, `onBrowse`, and `onBack`; the grid is the catalog filtered to ids in `favoriteIds`, preserving id order.

## Code changes

- `src/router.js`: map `/favorites` to `{ screen: 'favorites' }`.
- `src/components/DesktopNav.jsx`: add the 我的收藏 link and an `onFavorites` prop.
- `src/screens/FavoritesScreen.jsx`: new screen (grid + empty state).
- `src/App.jsx`: render the favorites screen, wire the sidebar action, and route back to home from favorites.
- `src/App.css`: favorites screen styles (heading, empty state, desktop top-bar hiding).
- Tests: `src/router.test.js` for the new route; `src/desktop-layout.test.jsx` for the sidebar link and active state; new `FavoritesScreen` integration coverage (favorites only, newest-first, unfavorite removes the card, empty state, browse navigation).

## Verification

- Full Vitest suite, lint, production build, and Playwright E2E (extend the desktop smoke to visit `#/favorites`).
- Browser acceptance on desktop: the favorites page shows only favorited albums; unfavoriting removes the card; removing all shows the empty state; the mobile 全部专辑 directory still only pins favorites (no new entry).

## Non-goals

- No mobile favorites entry.
- No change to the favorite toggle affordance (three-dot menu, no badges).
- No cross-device sync.
