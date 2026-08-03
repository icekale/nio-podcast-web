# Desktop Search-Only Album Browsing Design

## Goal

Make 搜索 the single desktop album-browsing entry: the sidebar keeps 今日推荐, 搜索, and 稍后播放, and the search page shows the full album cover grid when no keyword is entered.

## Sidebar

- Desktop navigation becomes: 今日推荐, 搜索, 稍后播放.
- The 全部专辑 sidebar item is removed. The `/albums` route and mobile album directory stay unchanged.

## Search Page

- The search page renders the album cover grid for both empty and filtered queries, so an empty query is equivalent to the album directory.
- Typing filters the grid by album name, description, and host; clearing restores all albums.
- Mobile search results remain row-style because the grid class only applies at the desktop breakpoint.

## Desktop Top Bar

- The redundant home top-bar 全部专辑/搜索 buttons are hidden on desktop; the sidebar covers both actions. The search page's own search field remains visible.

## Verification

- Update the desktop navigation tests for the three sidebar items and the empty-query grid behavior.
- Add CSS contract assertions for the hidden home top-bar buttons.
- Run the full suite, lint, build, and deploy.
