# Desktop Albums And Search Merge Design

## Goal

Merge the desktop sidebar's 全部专辑 and 搜索 entries into one 全部专辑 entry that includes an inline search box, so desktop users browse and filter the album grid in one place.

## Sidebar

- Desktop navigation becomes: 今日推荐, 全部专辑, 稍后播放.
- The standalone 搜索 sidebar item is removed; the mobile top-bar search flow and `/search` route remain unchanged.

## Album Directory

- The 全部专辑 page gains a desktop-only search field above the cover grid.
- Typing filters the grid by album name, description, and host; clearing restores the full pinned-order grid.
- The heading count reflects the filtered result count while searching.
- Mobile layout of the album directory is unchanged; the search field is hidden below the desktop breakpoint.

## Desktop Top Bar

- On desktop, the redundant home top-bar 全部专辑/搜索 buttons and the album top-bar search button are hidden, since the sidebar and inline search cover those actions.

## Verification

- Update the desktop navigation tests for the new sidebar items, inline search, filtering, and clearing.
- Add CSS contract assertions for the desktop-only search field and hidden top-bar buttons.
- Run the full suite, lint, build, and deploy.
