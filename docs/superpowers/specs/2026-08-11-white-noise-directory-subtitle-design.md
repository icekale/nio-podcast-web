# White Noise Directory Subtitle

## Goal

In the all-albums directory, show the white-noise album subtitle as:

> 让雨声与风声，陪你安静抵达。

## Scope

- Add a directory-specific subtitle to the custom white-noise album data.
- Make the shared album directory card prefer that subtitle over the latest episode title.
- Keep all other albums showing their latest episode title.
- Do not change the white-noise episode names, album detail description, sorting, playback, or queue album picker.

## Implementation

Add a `directorySubtitle` field to `CUSTOM_WHITE_NOISE_ALBUM`. In `AlbumResults`, render `directorySubtitle` first, then preserve the existing fallback order of latest episode title, album description, and `暂无节目`.

## Verification

- Add a regression test proving the all-albums white-noise card shows the requested sentence instead of `小雨`.
- Run the full test suite, lint, and production PWA build.
- Verify the local desktop all-albums page in the browser.
