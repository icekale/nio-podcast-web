# Review Findings Fix Design

## Goal

Resolve the four actionable findings from the code review without changing product behavior:

1. Pointer capture for later-playback drag reordering.
2. Player-state consistency when the persisted current episode is not in the queue.
3. Single queue advancement on audio end.
4. Removal of legacy, schema-incompatible catalog cache helpers in `api.js`.

## 1. Pointer Capture For Drag Reorder

`LaterQueueRow` must call `setPointerCapture` when a touch gesture starts so pointer move/up events keep targeting the row even when the finger leaves it. `releasePointerCapture` runs on pointerup and pointercancel. This prevents the row from staying stuck in the `is-dragging` state and makes reorder finish reliably.

## 2. Player-State Consistency

`restorePlayerState` enforces the invariant that `currentEpisode` belongs to `queue`. When the persisted `currentEpisode` is valid but not present in the queue, the restored state falls back to `queue[queueIndex]`. This keeps `insertNext`, `advanceQueue`, and `removeFromQueue` consistent because they all assume the current episode is in the queue.

## 3. Single Queue Advancement

`handleEnded` computes the advanced player state once from the current committed snapshot and uses that same result for history, playing state, and the React playing flag. The duplicate `advanceQueue` call is removed.

## 4. Remove Legacy Catalog Cache Helpers

Delete `CACHE_KEY`, `getCachedAlbums`, `setCachedAlbums`, `discoverAlbums`, `SEED_ALBUMS`, and `ALL_SEED_IDS` from `src/api.js`. They are unused, and they write a different schema to the same localStorage key that `catalog.js` owns. `normalizeAudioUrl`, `ApiError`, `getEpisodes`, and `clearEpisodeCache` remain because they are imported and used.

## Verification

- Add regression tests for restore-state alignment, pointer-capture calls, and audio-end single advancement behavior.
- Run the full Vitest suite, lint, production build, and `git diff --check`.
- Verify the queue drag and playback flow in a mobile viewport, then deploy and confirm the live site.
