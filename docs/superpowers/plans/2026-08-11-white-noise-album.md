# White Noise Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a theme-aware “白噪音” album with 30 commit-pinned XMSLEEP tracks, loop-one playback, and existing sleep-timer integration.

**Architecture:** Keep custom album metadata and normalized episodes in one dependency-free module. Inject that album after catalog normalization, short-circuit `getEpisodes()` for its numeric ID, and mark its episodes with `playbackMode: 'loop-one'`; all NIO API paths remain unchanged. Extend the existing `Artwork` boundary with an optional dark source so the approved paired cover works everywhere without special-case CSS in each screen.

**Tech Stack:** React 19, Vite 8, Vitest + Testing Library, Playwright, Lucide React, GitHub Pages.

---

## File Map

- Create `src/customAlbums.js`: the custom album, 30 normalized episodes, and small lookup helpers.
- Create `src/customAlbums.test.js`: content, stable URL, and pagination tests.
- Modify `src/catalog.js` and `src/catalog.test.js`: inject once, exclude evergreen content from home, and sort custom content last unless favorited.
- Modify `src/api.js` and `src/api.test.js`: return local custom episodes without touching the NIO API.
- Modify `src/components/Artwork.jsx`, its callers, `src/App.css`, and `src/components/Artwork.test.jsx`: theme-aware artwork.
- Create `public/covers/white-noise-light.png` and `public/covers/white-noise-dark.png`: approved 1200px water-ripple covers.
- Modify `src/playerState.js`, `src/laterPlayback.js`, and their tests: persist `albumPicDark` and `playbackMode`.
- Modify `src/App.jsx`, `src/components/QueueSheet.jsx`, and `src/App.test.jsx`: loop current custom sound and adapt sleep timer.
- Create `THIRD_PARTY_NOTICES.md`: XMSLEEP, Moodist, Pixabay Content License, and CC0 notices.

### Task 1: Custom Album Data

**Files:**
- Create: `src/customAlbums.test.js`
- Create: `src/customAlbums.js`

- [ ] **Step 1: Write the failing data contract tests**

```js
import { describe, expect, it } from 'vitest';
import { CUSTOM_WHITE_NOISE_ALBUM, CUSTOM_WHITE_NOISE_ALBUM_ID, getCustomEpisodes, isLoopingEpisode } from './customAlbums';

describe('custom white-noise album', () => {
  it('contains 30 ordered, looping, commit-pinned tracks', () => {
    const result = getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 1, 30);
    expect(result.episodes).toHaveLength(30);
    expect(result.episodes.slice(0, 3).map(item => item.title)).toEqual(['小雨', '大雨', '车顶雨声']);
    expect(result.episodes.every(isLoopingEpisode)).toBe(true);
    expect(result.episodes.every(item => item.audioUrl.includes('/3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629/'))).toBe(true);
    expect(new Set(result.episodes.map(item => item.id)).size).toBe(30);
  });

  it('uses the approved album copy and paginates without a request', () => {
    expect(CUSTOM_WHITE_NOISE_ALBUM).toMatchObject({
      name: '白噪音', category: 'commute', description: '让雨声与风声，陪你安静抵达。', episodeCount: 30,
    });
    expect(getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 2, 20)).toMatchObject({ totalCount: 30, hasMore: false });
    expect(getCustomEpisodes(5, 1, 30)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/customAlbums.test.js`

Expected: FAIL because `src/customAlbums.js` does not exist.

- [ ] **Step 3: Add the data module with all 30 sounds**

Use numeric IDs so the existing router and favorite storage require no migration. Implement the module with this exact catalog and durations (milliseconds):

```js
export const CUSTOM_WHITE_NOISE_ALBUM_ID = 900001;
const CUSTOM_EPISODE_BASE_ID = 900001000;
const XMSLEEP_REVISION = '3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629';
const XMSLEEP_RAW = `https://raw.githubusercontent.com/Tosencen/XMSLEEP/${XMSLEEP_REVISION}/audio`;
const LIGHT_COVER = 'covers/white-noise-light.png';
const DARK_COVER = 'covers/white-noise-dark.png';

const sounds = [
  ['小雨', 149865, 'rain/light-rain.ogg'], ['大雨', 14863, 'rain/heavy_rain.ogg'],
  ['车顶雨声', 10015, 'rain/rain-on-car-roof.ogg'], ['伞上雨声', 26554, 'rain/rain-on-umbrella.ogg'],
  ['帐篷雨声', 150649, 'rain/rain-on-tent.ogg'], ['叶上雨声', 42219, 'rain/rain-on-leaves.ogg'],
  ['雨打窗台', 40240, 'rain/rain-on-windowsill.ogg'], ['雷雨声', 154737, 'rain/thunderstorm.ogg'],
  ['开车时遇雨', 50782, 'rain/rain-while-driving.ogg'], ['空荡街道的雨', 47320, 'rain/rain-on-empty-street.ogg'],
  ['绵绵细雨', 148320, 'rain/drizzle.ogg'], ['大雨落玻璃', 39280, 'rain/heavy-rain-on-glass.ogg'],
  ['河流', 105520, 'nature/river.ogg'], ['海浪', 95360, 'nature/waves.ogg'],
  ['篝火', 113560, 'nature/campfire.ogg'], ['风声', 72640, 'nature/wind.ogg'],
  ['树间风声', 57200, 'nature/wind-in-trees.ogg'], ['瀑布', 22160, 'nature/waterfall.ogg'],
  ['水滴', 47960, 'nature/droplets.ogg'], ['咖啡厅', 199094, 'places/cafe.ogg'],
  ['地铁站', 171030, 'places/subway-station.ogg'], ['办公室', 139727, 'places/office.ogg'],
  ['图书馆', 176528, 'places/library.ogg'], ['火车', 61063, 'transport/train.ogg'],
  ['火车内', 66503, 'transport/inside-a-train.ogg'], ['飞机', 60031, 'transport/airplane.ogg'],
  ['白噪音', 9502, 'noise/white-noise.ogg'], ['粉红噪音', 9506, 'noise/pink-noise.ogg'],
  ['棕噪音', 9510, 'noise/brown-noise.ogg'], ['风扇', 15137, 'things/风扇.ogg'],
];

export const CUSTOM_WHITE_NOISE_EPISODES = sounds.map(([title, duration, path], index) => ({
  id: CUSTOM_EPISODE_BASE_ID + index + 1,
  title,
  albumId: CUSTOM_WHITE_NOISE_ALBUM_ID,
  albumName: '白噪音',
  albumPic: LIGHT_COVER,
  albumPicDark: DARK_COVER,
  host: '',
  duration,
  onlineTime: 0,
  audioUrl: `${XMSLEEP_RAW}/${path}`,
  playbackMode: 'loop-one',
}));

export const CUSTOM_WHITE_NOISE_ALBUM = {
  id: CUSTOM_WHITE_NOISE_ALBUM_ID,
  name: '白噪音',
  description: '让雨声与风声，陪你安静抵达。',
  category: 'commute',
  episodeCount: CUSTOM_WHITE_NOISE_EPISODES.length,
  imageUrl: LIGHT_COVER,
  imageUrlDark: DARK_COVER,
  evergreen: true,
  latestEpisode: CUSTOM_WHITE_NOISE_EPISODES[0],
};

export function isCustomAlbumId(id) { return Number(id) === CUSTOM_WHITE_NOISE_ALBUM_ID; }
export function isLoopingEpisode(episode) { return episode?.playbackMode === 'loop-one'; }
export function getCustomEpisodes(albumId, page = 1, pageSize = 30) {
  if (!isCustomAlbumId(albumId)) return null;
  const start = Math.max(0, (Number(page) - 1) * Number(pageSize));
  const episodes = CUSTOM_WHITE_NOISE_EPISODES.slice(start, start + Number(pageSize));
  return { episodes, totalCount: CUSTOM_WHITE_NOISE_EPISODES.length, hasMore: start + episodes.length < CUSTOM_WHITE_NOISE_EPISODES.length };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/customAlbums.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/customAlbums.js src/customAlbums.test.js
git commit -m "feat: add white noise album data"
```

### Task 2: Catalog Injection and Sorting

**Files:**
- Modify: `src/catalog.js`
- Modify: `src/catalog.test.js`

- [ ] **Step 1: Add failing catalog tests**

```js
import { CUSTOM_WHITE_NOISE_ALBUM, CUSTOM_WHITE_NOISE_ALBUM_ID } from './customAlbums';

it('injects the custom album once and keeps it out of home updates', () => {
  const regular = { id: 42, name: '普通专辑', latestEpisode: episode(420, 1000) };
  const first = normalizeCatalog({ generatedAt: 1, albums: [regular] });
  const second = normalizeCatalog(first);
  expect(second.albums.filter(item => item.id === CUSTOM_WHITE_NOISE_ALBUM_ID)).toHaveLength(1);
  expect(selectHomeEpisodes(second.albums, new Date(1000)).episodes).toEqual([regular.latestEpisode]);
});

it('places the custom album last unless it is favorited', () => {
  const regular = { id: 42, name: '普通专辑', latestEpisode: episode(420, 1000) };
  expect(sortAlbumsForDirectory([CUSTOM_WHITE_NOISE_ALBUM, regular]).map(item => item.id))
    .toEqual([regular.id, CUSTOM_WHITE_NOISE_ALBUM_ID]);
  expect(sortAlbumsForDirectory([CUSTOM_WHITE_NOISE_ALBUM, regular], [CUSTOM_WHITE_NOISE_ALBUM_ID]).map(item => item.id))
    .toEqual([CUSTOM_WHITE_NOISE_ALBUM_ID, regular.id]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/catalog.test.js`

Expected: FAIL because the custom album is not injected or specially sorted.

- [ ] **Step 3: Implement minimal catalog integration**

Import `CUSTOM_WHITE_NOISE_ALBUM` and `isCustomAlbumId`. In `normalizeCatalog`, remove stale copies of the custom ID, append the canonical object once, then run the existing numeric validation and latest sort. In `sortAlbumsForDirectory`, place non-favorite custom albums in a `customTail` bucket returned after regular and city buckets. In `selectHomeEpisodes`, filter `album.evergreen !== true` before mapping `latestEpisode`.

- [ ] **Step 4: Run catalog tests and full catalog-dependent tests**

Run: `npm test -- src/catalog.test.js src/App.catalog.test.jsx src/App.album.test.jsx`

Expected: all selected suites PASS; update only exact album-count expectations affected by the intentional injected album.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js src/App.catalog.test.jsx src/App.album.test.jsx
git commit -m "feat: inject white noise into catalog"
```

### Task 3: Local Episode API and Persistence

**Files:**
- Modify: `src/api.js`
- Modify: `src/api.test.js`
- Modify: `src/playerState.js`
- Modify: `src/playerState.test.js`
- Modify: `src/laterPlayback.js`
- Modify: `src/laterPlayback.test.js`

- [ ] **Step 1: Add failing boundary and persistence tests**

```js
const fetchImpl = vi.fn();
const page = await getEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 1, 30, fetchImpl);
expect(page.episodes).toHaveLength(30);
expect(fetchImpl).not.toHaveBeenCalled();

const custom = { ...episode(1), albumPicDark: 'dark.png', playbackMode: 'loop-one' };
expect(restorePlayerState(serializePlayerState(selectEpisode(createPlayerState(), custom))).currentEpisode)
  .toMatchObject({ albumPicDark: 'dark.png', playbackMode: 'loop-one' });
```

Add the equivalent localStorage round-trip assertion to `laterPlayback.test.js`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/api.test.js src/playerState.test.js src/laterPlayback.test.js`

Expected: custom API test calls the NIO fetch; custom fields disappear during persistence.

- [ ] **Step 3: Implement the boundary changes**

At the start of `getEpisodes()`, return `getCustomEpisodes(albumId, page, pageSize)` when non-null. Add `'albumPicDark'` and `'playbackMode'` to both serialized episode field lists. Do not bump the storage version because the change is additive and old records remain valid.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/api.test.js src/playerState.test.js src/laterPlayback.test.js`

Expected: all selected suites PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api.js src/api.test.js src/playerState.js src/playerState.test.js src/laterPlayback.js src/laterPlayback.test.js
git commit -m "feat: serve and persist custom audio"
```

### Task 4: Approved Theme-Aware Cover

**Files:**
- Create: `public/covers/white-noise-light.png`
- Create: `public/covers/white-noise-dark.png`
- Modify: `src/components/Artwork.jsx`
- Modify: `src/components/Artwork.test.jsx`
- Modify: `src/components/AlbumResults.jsx`
- Modify: `src/components/EpisodeRow.jsx`
- Modify: `src/components/MiniPlayer.jsx`
- Modify: `src/components/QueueSheet.jsx`
- Modify: `src/screens/AlbumScreen.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add a failing `Artwork` picture-source test**

```jsx
render(<Artwork src="light.png" darkSrc="dark.png" alt="封面" />);
expect(document.querySelector('source[media="(prefers-color-scheme: dark)"]')).toHaveAttribute('srcset', 'dark.png');
expect(screen.getByRole('img', { name: '封面' })).toHaveAttribute('src', 'light.png');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/components/Artwork.test.jsx`

Expected: FAIL because `Artwork` ignores `darkSrc`.

- [ ] **Step 3: Implement a theme-aware artwork boundary**

```jsx
export function Artwork({ src, darkSrc, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return (
    <picture className={`artwork ${className}`}>
      {darkSrc ? <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} /> : null}
      <img className="artwork-media" src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </picture>
  );
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}
```

Add `.artwork-media { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; }`. Pass `imageUrlDark` or `albumPicDark` from every existing caller. The favorite control remains Lucide `Heart`, never a star.

When building Media Session artwork in `App.jsx`, report `image/png` for the custom `.png` cover and retain `image/jpeg` for existing non-PNG covers.

- [ ] **Step 4: Render the approved two cover assets**

Create a temporary 1200×1200 HTML composition with the approved concentric ripple geometry, system Chinese sans text, and these exact palettes:

```css
/* light */ background:#e7f7f7; color:#08162e; --ripple:#00b9b5;
/* dark  */ background:#08162e; color:#f0f6fa; --ripple:#2bd0c6;
```

Render with Playwright using `--viewport-size="1200,1200" --color-scheme=light|dark`, save the PNGs under `public/covers/`, inspect both with `view_image`, and remove the temporary HTML after validation. The image text is exactly `NIO RADIO` and `白噪音`, with letter spacing `0`.

- [ ] **Step 5: Run component tests and build asset checks**

Run: `npm test -- src/components/Artwork.test.jsx src/App.album.test.jsx && file public/covers/white-noise-*.png`

Expected: tests PASS; both files report 1200×1200 PNG.

- [ ] **Step 6: Commit**

```bash
git add public/covers/white-noise-light.png public/covers/white-noise-dark.png src/components src/screens/AlbumScreen.jsx src/App.css
git commit -m "feat: add adaptive white noise cover"
```

### Task 5: Loop-One Playback and Sleep Timer

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/QueueSheet.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add failing interaction tests**

```jsx
it('loops white noise and only offers minute sleep timers', async () => {
  window.history.replaceState({ nioDepth: 0 }, '', '#/album/900001');
  render(<App initialCatalog={catalog} />);
  fireEvent.click(await screen.findByRole('button', { name: /小雨/ }));
  expect(document.querySelector('audio')).toHaveAttribute('loop');

  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('button', { name: '睡眠定时' }));
  expect(screen.getByRole('menuitem', { name: '15 分钟' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '本集结束' })).not.toBeInTheDocument();
});

it('keeps normal episodes sequential with episode-end sleep', async () => {
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  expect(document.querySelector('audio')).not.toHaveAttribute('loop');
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('button', { name: '睡眠定时' }));
  expect(screen.getByRole('menuitem', { name: '本集结束' })).toBeInTheDocument();
});
```

Extend the first test with fake timers and a spy on `HTMLMediaElement.prototype.pause`: choose `15 分钟`, advance 15 minutes, and assert the spy was called.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/App.test.jsx -t "white noise|sleep timer|normal episode"`

Expected: FAIL because playback is not loop-aware and the menu always shows “本集结束”.

- [ ] **Step 3: Implement loop and timer behavior**

Compute `const loopingCurrentEpisode = isLoopingEpisode(player.currentEpisode);`, add `loop={loopingCurrentEpisode}` to the existing `<audio>` element, and add `allowEpisodeEnd={!loopingCurrentEpisode}` to the existing `<QueueSheet>` call.

In `startPlayback`, clear an active `{ mode: 'episode-end' }` timer before starting a loop-one episode. In `QueueSheet`, render the “本集结束” menu item only when `allowEpisodeEnd` is true. Keep all existing minute presets, close action, Escape behavior, and timeout effect unchanged.

- [ ] **Step 4: Run interaction tests and verify GREEN**

Run: `npm test -- src/App.test.jsx src/playbackPrefs.test.js`

Expected: all selected suites PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/QueueSheet.jsx src/App.test.jsx
git commit -m "feat: loop white noise playback"
```

### Task 6: Third-Party Notices and Full Automated Verification

**Files:**
- Create: `THIRD_PARTY_NOTICES.md`
- Modify only if required by verified regressions: affected test files

- [ ] **Step 1: Add the license notices**

Record XMSLEEP copyright and MIT license URL, Moodist copyright and MIT license URL, and XMSLEEP’s stated Pixabay Content License / CC0 source links. Do not add source text to the album UI.

- [ ] **Step 2: Run all automated checks**

Run:

```bash
npm test
npm run lint
npm run build
npm run e2e
```

Expected: every command exits 0. Fix only regressions caused by this feature and repeat the full command that failed.

- [ ] **Step 3: Check asset and repository hygiene**

Run:

```bash
git diff --check
git status --short
du -h public/covers/white-noise-*.png
```

Expected: no whitespace errors, only intended files changed, and cover files are reasonably compressed.

- [ ] **Step 4: Commit notices and verification fixes**

```bash
git add THIRD_PARTY_NOTICES.md
git commit -m "docs: credit white noise audio sources"
```

### Task 7: Mobile Visual QA and Release

**Files:**
- Modify only if browser QA finds a requirement-breaking defect.

- [ ] **Step 1: Start the production preview**

Run: `npm run preview -- --host 127.0.0.1 --port 4173`

Expected: Vite serves the production build at `http://127.0.0.1:4173/nio-podcast-web/` or the printed local URL.

- [ ] **Step 2: Verify real UI states in Chromium**

At 320×700, 390×844, and 430×932:

- Open 全部专辑 and confirm “白噪音” is last in 通勤场景.
- Favorite it with the heart and confirm it moves to the favorite block.
- Open the album and confirm 30 tracks, rain first, no text overflow, and no console errors.
- Play 小雨 and confirm the current item loops, minute timers remain, and “本集结束” is absent.
- Emulate dark color scheme and confirm every occurrence uses the dark cover.
- Verify the existing three-dot episode menu does not overlap adjacent rows.

Capture and inspect screenshots for the album directory and album detail in both themes. Patch only observed defects, rerun affected tests, then rerun `npm run build`.

- [ ] **Step 3: Push and monitor deployment**

```bash
git status --short --branch
git push origin main
gh run list --workflow deploy.yml --branch main --limit 1
gh run watch "$(gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: push succeeds and the Pages deployment concludes `success`.

- [ ] **Step 4: Verify the public Pages URL**

Open `https://icekale.github.io/nio-podcast-web/`, hard-refresh once, repeat the core 390×844 flow, and confirm the deployed commit is visible with no console errors.
