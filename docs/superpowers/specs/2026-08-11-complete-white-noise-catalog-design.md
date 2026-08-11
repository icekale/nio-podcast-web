# Complete White Noise Catalog Design

**Date:** 2026-08-11

**Goal:** Expand the custom white-noise album from 30 tracks to every distinct OGG sound in the pinned XMSLEEP revision.

## Source And Scope

Use XMSLEEP revision `3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629` as the immutable source. Its `audio/` tree contains 113 OGG files across rain, nature, animals, urban, places, transport, things, and noise categories. Include all 113 OGG files and omit same-content MP3 alternatives so the album has no format duplicates.

The existing 30 entries remain first and retain their current order and generated episode IDs. This keeps `小雨` as the first track and preserves references already stored in playback history, queues, and later playback. Append the remaining 83 entries with consecutive IDs. Use the simplified-Chinese titles from the pinned upstream `sounds_remote.json`; distinguish the two upstream tracks both named `屋檐落雨` as `屋檐雨声` for `rain-on-eaves.ogg` and `屋檐落雨` for `屋檐落雨.ogg`.

## Data Model And Playback

Keep the existing static `sounds` tuple list in `src/customAlbums.js`. Each tuple contains title, duration in milliseconds, and revision-relative OGG path. Measure the new files with `ffprobe` during implementation and commit the resulting durations; the application does not fetch or parse an upstream manifest at runtime.

All tracks retain `playbackMode: 'loop-one'` and use the existing commit-pinned raw GitHub URL. The browser only requests the selected audio file, so listing 113 tracks does not download the complete approximately 125 MB collection or add storage traffic to the NIO Radio Pages origin.

## Pagination

Keep the existing local pagination behavior at 30 entries per page. The 113 entries produce page sizes of 30, 30, 30, and 23, using the existing `加载更多` control without UI changes.

## Testing

Update the custom-album tests before implementation to require:

- exactly 113 unique episode IDs and 113 unique pinned OGG URLs;
- `小雨`, `大雨`, and `车顶雨声` remain the first three tracks;
- every track remains looped and pinned to the approved revision;
- pagination returns 30, 30, 30, and 23 entries with correct `hasMore` values;
- album `episodeCount` and API `totalCount` both report 113.

Run the targeted custom-album and API tests, then the full test suite, lint, and production build.

## Scope Boundaries

This change does not alter the player, queue behavior, timer, album artwork, album copy, favorite ordering, catalog scheduler, or audio hosting strategy. It does not add runtime manifest loading or include duplicate MP3 files.
