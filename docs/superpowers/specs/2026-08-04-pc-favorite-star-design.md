# PC Favorite Star Design

## Goal

On desktop album cards, replace the three-dot favorite menu with a direct star button beside the title. Unfavorited cards show an outline star; favorited cards show a filled amber star. Clicking toggles the favorite immediately. Mobile keeps the three-dot menu unchanged.

## Interaction

- Star position: the existing grid action slot at the title-right (the same `top: calc(100cqw + var(--space-3))` position used by the three-dot today).
- Unfavorited: outline star in muted ink; hover shifts toward teal-dark.
- Favorited: filled star in amber (`#f2a900`; hover darkens), so the state is readable at a glance.
- Click toggles the favorite directly (no menu). The card is still fully clickable to open the album.
- Accessibility: `aria-pressed={favorited}`, `aria-label="收藏 <专辑名>"` or `取消收藏 <专辑名>`.
- Works on both the desktop search/全部专辑 grid and the 我的收藏 page (unfavoriting there removes the card, per existing behavior).

## Component changes

- `AlbumResults` gains a `starAction` boolean prop: when true (and `onToggleFavorite` is set) it renders `FavoriteStarButton`; otherwise the existing three-dot `FavoriteAlbumMenu` stays (mobile rows).
- `AlbumsScreen`, `SearchScreen`, and `FavoritesScreen` accept `starAction` and pass it through.
- `App` passes `starAction={desktopLayout}` so the star appears only on desktop; mobile keeps the three-dot.
- `FavoritesScreen` empty-state hint text changes from 「点击专辑右上角的 ⋯」 to 「点击专辑标题右侧的 ☆」.

## Styles

- Reuse the existing grid action slot; the star button is the compact 1.75rem icon button already defined there.
- Amber fill and hover colors are literal values in `App.css` (no palette token change).

## Tests

- Update the desktop grid favorite tests to click the star button (`收藏 <名>` / `取消收藏 <名>`) instead of the three-dot menu.
- New assertions: `aria-pressed` reflects the state and toggles after a click.
- CSS contract: the filled-star amber rule exists.
- E2E: extend the desktop grid test to click the star and assert `aria-pressed` becomes true.
- Mobile tests stay untouched and must keep passing (three-dot still present on rows).

## Non-goals

- No change to the mobile three-dot menu.
- No cover overlay badge.
- No new menu actions.
