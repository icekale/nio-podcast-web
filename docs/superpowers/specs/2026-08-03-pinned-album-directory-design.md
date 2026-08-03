# Pinned Album Directory Design

## Goal

Pin `资讯充电站·早间版` and `资讯充电站·晚间版` at the top of the full album directory so listeners can reach the two daily briefing channels without scrolling.

## Scope

The pinned order applies only to the `全部专辑` page. The home `今日更新` list, search results, album pickers used by later playback, and the raw catalog ordering remain unchanged.

## Behavior

The two pinned albums keep a fixed order: `资讯充电站·早间版` first, then `资讯充电站·晚间版`. Every other album continues to sort by its latest episode update time, with the existing equal-time album-id ordering. The directory header count keeps showing the full album count.

Pinned albums keep their real episode times and metadata; no stored catalog data is rewritten. The rule lives in the client catalog selectors so future catalog refreshes cannot erase it.

## Implementation

- Add a directory-order selector in `src/catalog.js` that places the pinned album ids first and then applies the existing latest-episode ordering to the remaining albums.
- Use that selector only when rendering `AlbumsScreen`; search and later-playback pickers continue using their current inputs.
- Add selector tests covering pinned-first ordering, pinned id order, and non-pinned ordering by latest episode.
- Add an application test confirming the two pinned albums appear before other albums in the full directory.

## Non-goals

- No changes to home-page episode selection or its ordering.
- No changes to search filtering or results.
- No changes to catalog generation, published JSON, or GitHub Actions.
