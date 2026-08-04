# Album Directory Favorites and City-Channel Sorting Design

## Goal

In the full album directory, sort city-channel albums to the bottom and let users favorite albums so they pin to the top. Favorites apply to both the mobile 全部专辑 page and the desktop search/grid directory, and persist locally per device.

## City-Channel Sort

An album is a city channel when its name contains any of: `城市资讯`, `城市频道`, `天气预报`. This covers 上海天气预报, 广东城市资讯, 南京城市频道, etc.

Directory order (used by `sortAlbumsForDirectory`):

1. The user's favorited albums, newest favorite first.
2. The pinned briefing albums: `5` 资讯充电站·早间版, then `23` 资讯充电站·晚间版.
3. Other non-city albums, latest episode first (today's ordering).
4. City-channel albums, latest episode first.

The order applies everywhere the directory is rendered: mobile 全部专辑 page and desktop search grid (empty query = directory). Home, episode lists, and the play-later album picker are unchanged.

## Favorite Interaction

- Each album row (mobile) and album card (desktop) gets a trailing three-dot button, matching the existing `.row-action-menu` pattern already used by `EpisodeRow` and the queue sheet (restrained, no badge).
- The menu has one item: 收藏专辑 / 取消收藏. Toggling favoriting is immediate.
- Favorited albums carry no visual badge (menu text and top placement are the only indicators).
- Menu behavior matches existing rows: toggle on click, close on outside pointerdown or Escape, proper `aria-expanded`/`aria-haspopup`/`aria-controls`/`role="menu"` attributes.
- On mobile the row remains click-to-open; the three-dot replaces the trailing chevron. On desktop the three-dot sits in the card's top-right corner.
- The play-later album picker (`QueueSheet` picker) does not show the favorite menu.

## Data and Storage

- New localStorage key `nio_favorite_albums_v1`: array of album ids, newest favorite first. Per-device, matching play-progress and play-later persistence.
- New module `src/favoriteAlbums.js` with pure helpers (load, toggle, recency ordering) so behavior is unit-testable.
- Favorite state lives at the `App` root and is passed to `AlbumsScreen` and desktop `SearchScreen`.

## Code Changes

- `src/catalog.js`: extend `sortAlbumsForDirectory(albums, favoriteIds = [])`; add a city-channel predicate shared with tests.
- `src/components/AlbumResults.jsx`: accept optional `favoriteIds`/`onToggleFavorite` props; render the three-dot menu only when handlers are present.
- `src/screens/AlbumsScreen.jsx`, `src/screens/SearchScreen.jsx`: pass favorite props through.
- `src/App.jsx`: hold and persist favorite state; wire handlers.
- `src/App.css`: card three-dot placement and menu positioning inside the grid.
- Tests: `src/catalog.test.js`, `src/App.test.jsx` (and desktop variants) for city detection, four-tier ordering, toggle, and persistence.

## Verification

- Unit tests for city predicate, ordering tiers, favorite toggle, and localStorage round-trip.
- Existing Playwright E2E continues to pass (home, directory, player).
- Full Vitest suite, lint, build, and deploy via the existing `main` push workflow.

## Non-goals

- No cross-device favorite sync (no server storage).
- No separate favorites section or filter; favorites only reorder the directory.
- No badge/indicator on favorited albums.
- No change to home, search filtering, or episode-level actions.
