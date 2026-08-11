# Complete White Noise Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the pinned custom white-noise album from 30 tracks to all 113 distinct XMSLEEP OGG sounds without changing existing episode IDs.

**Architecture:** Keep the current static tuple list and append 83 measured entries after the existing 30. Preserve local pagination and loop-one playback, then verify the committed URL set exactly matches the pinned upstream OGG tree.

**Tech Stack:** JavaScript ES modules, Vitest, Node.js 22, ffprobe, GitHub raw assets

---

### Task 1: Define complete-catalog behavior with failing tests

**Files:**
- Modify: `src/customAlbums.test.js`
- Modify: `src/api.test.js`

- [ ] **Step 1: Replace the 30-track assertions with complete catalog assertions**

Replace the two tests in `src/customAlbums.test.js` with:

```js
it('contains all 113 ordered, looping, commit-pinned OGG tracks', () => {
  const pages = [1, 2, 3, 4].map(page => getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, page, 30));
  const episodes = pages.flatMap(result => result.episodes);

  expect(pages.map(result => result.episodes.length)).toEqual([30, 30, 30, 23]);
  expect(pages.map(result => result.hasMore)).toEqual([true, true, true, false]);
  expect(episodes).toHaveLength(113);
  expect(episodes.slice(0, 3).map(item => item.title)).toEqual(['小雨', '大雨', '车顶雨声']);
  expect(episodes.every(isLoopingEpisode)).toBe(true);
  expect(episodes.every(item => item.audioUrl.includes('/3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629/'))).toBe(true);
  expect(episodes.every(item => item.audioUrl.endsWith('.ogg'))).toBe(true);
  expect(new Set(episodes.map(item => item.id)).size).toBe(113);
  expect(new Set(episodes.map(item => item.audioUrl)).size).toBe(113);
});

it('uses the approved album copy and reports complete pagination totals', () => {
  expect(CUSTOM_WHITE_NOISE_ALBUM).toMatchObject({
    name: '白噪音',
    category: 'commute',
    description: '让雨声与风声，陪你安静抵达。',
    episodeCount: 113,
  });
  expect(getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 2, 20)).toMatchObject({
    totalCount: 113,
    hasMore: true,
  });
  expect(getCustomEpisodes(5, 1, 30)).toBeNull();
});
```

- [ ] **Step 2: Require the API boundary to report the complete total**

Add these assertions to the existing `returns custom episodes without calling the NIO API` test in `src/api.test.js`:

```js
expect(result.totalCount).toBe(113);
expect(result.hasMore).toBe(true);
```

- [ ] **Step 3: Run the targeted tests and verify RED**

Run:

```bash
npm test -- src/customAlbums.test.js src/api.test.js
```

Expected: failures report 30 tracks and `totalCount: 30` instead of 113.

### Task 2: Append every missing pinned OGG sound

**Files:**
- Modify: `src/customAlbums.js`

- [ ] **Step 1: Append the 83 measured tuples after the existing `风扇` tuple**

Insert the following entries before the closing `];` of `sounds`:

```js
  ['呼啸的风', 52841, 'nature/howling-wind.ogg'],
  ['雪中行走', 35960, 'nature/walk-in-snow.ogg'],
  ['踩踏树叶', 19881, 'nature/walk-on-leaves.ogg'],
  ['踩踏碎石', 69680, 'nature/walk-on-gravel.ogg'],
  ['丛林', 257480, 'nature/jungle.ogg'],
  ['田野', 397881, 'nature/field.ogg'],
  ['湖泊', 41535, 'nature/lake.ogg'],
  ['雨落雨披', 64668, 'rain/rain-on-raincoat.ogg'],
  ['雨敲木屋', 56517, 'rain/rain-on-wooden-house.ogg'],
  ['屋檐雨声', 40960, 'rain/rain-on-eaves.ogg'],
  ['鸟鸣', 115119, 'animals/birds.ogg'],
  ['海鸥', 43475, 'animals/seagulls.ogg'],
  ['蟋蟀', 172538, 'animals/crickets.ogg'],
  ['狼嚎', 55371, 'animals/wolf.ogg'],
  ['猫头鹰', 12943, 'animals/owl.ogg'],
  ['青蛙', 78648, 'animals/frog.ogg'],
  ['狗叫', 16179, 'animals/dog-barking.ogg'],
  ['马奔腾', 9143, 'animals/horse-gallop.ogg'],
  ['猫咪呼噜', 38662, 'animals/cat-purring.ogg'],
  ['乌鸦', 58078, 'animals/crows.ogg'],
  ['鲸鱼', 30006, 'animals/whale.ogg'],
  ['蜂巢', 45155, 'animals/beehive.ogg'],
  ['啄木鸟', 15319, 'animals/woodpecker.ogg'],
  ['鸡', 202076, 'animals/chickens.ogg'],
  ['牛', 59699, 'animals/cows.ogg'],
  ['羊', 31194, 'animals/sheep.ogg'],
  ['高速公路', 132503, 'urban/highway.ogg'],
  ['道路', 102353, 'urban/road.ogg'],
  ['救护车警笛', 22589, 'urban/ambulance-siren.ogg'],
  ['繁忙街道', 175356, 'urban/busy-street.ogg'],
  ['人群', 72563, 'urban/crowd.ogg'],
  ['交通', 39890, 'urban/traffic.ogg'],
  ['烟花', 34495, 'urban/fireworks.ogg'],
  ['机场', 311610, 'places/airport.ogg'],
  ['教堂', 70479, 'places/church.ogg'],
  ['寺庙', 91617, 'places/temple.ogg'],
  ['建筑工地', 125049, 'places/construction-site.ogg'],
  ['水下', 43249, 'places/underwater.ogg'],
  ['拥挤酒吧', 58735, 'places/crowded-bar.ogg'],
  ['夜晚村庄', 106417, 'places/night-village.ogg'],
  ['超市', 175094, 'places/supermarket.ogg'],
  ['旋转木马', 160764, 'places/carousel.ogg'],
  ['实验室', 21234, 'places/laboratory.ogg'],
  ['洗衣房', 32484, 'places/laundry-room.ogg'],
  ['餐厅', 170887, 'places/restaurant.ogg'],
  ['厨房烹饪', 66500, 'places/kitchen.ogg'],
  ['潜艇', 46032, 'transport/submarine.ogg'],
  ['帆船', 160521, 'transport/sailboat.ogg'],
  ['划船', 25535, 'transport/rowing-boat.ogg'],
  ['键盘', 12147, 'things/keyboard.ogg'],
  ['打字机', 21781, 'things/typewriter.ogg'],
  ['纸张', 17209, 'things/paper.ogg'],
  ['时钟', 15940, 'things/clock.ogg'],
  ['风铃', 83009, 'things/wind-chimes.ogg'],
  ['颂钵', 49082, 'things/singing-bowl.ogg'],
  ['吊扇', 15593, 'things/ceiling-fan.ogg'],
  ['烘干机', 28025, 'things/dryer.ogg'],
  ['幻灯机', 142884, 'things/slide-projector.ogg'],
  ['沸水', 18498, 'things/boiling-water.ogg'],
  ['气泡', 6390, 'things/bubbles.ogg'],
  ['调频收音机', 70230, 'things/tuning-radio.ogg'],
  ['摩尔斯电码', 75388, 'things/morse-code.ogg'],
  ['洗衣机', 22530, 'things/washing-machine.ogg'],
  ['黑胶效果', 65901, 'things/vinyl-effect.ogg'],
  ['雨刷', 15124, 'things/windshield-wipers.ogg'],
  ['掏耳朵1', 32616, 'things/ear-cleaning-1.ogg'],
  ['掏耳朵2', 124704, 'things/ear-cleaning-2.ogg'],
  ['吉他', 31627, 'things/guitar.ogg'],
  ['轻钢琴', 103027, 'things/light-piano.ogg'],
  ['古筝', 149040, 'things/guzheng.ogg'],
  ['优雅钢琴', 173521, 'things/优雅钢琴.ogg'],
  ['冥想琴音', 55819, 'things/冥想琴音.ogg'],
  ['发呆音', 150951, 'things/发呆音.ogg'],
  ['学习', 48651, 'noise/study.ogg'],
  ['吃薯片', 51965, 'noise/eating-chips.ogg'],
  ['钢琴声', 128000, 'noise/piano.ogg'],
  ['夏夜虫鸣', 40587, 'nature/夏夜虫鸣.ogg'],
  ['雨棚', 38010, 'rain/雨棚.ogg'],
  ['小雨加风', 28606, 'rain/小雨加风.ogg'],
  ['尖尖流雨', 55819, 'rain/尖尖流雨.ogg'],
  ['敞亮雨', 38010, 'rain/敞亮雨.ogg'],
  ['顶棚雨', 110084, 'rain/顶棚雨.ogg'],
  ['屋檐落雨', 22081, 'rain/屋檐落雨.ogg'],
```

- [ ] **Step 2: Run the targeted tests and verify GREEN**

Run:

```bash
npm test -- src/customAlbums.test.js src/api.test.js
```

Expected: both test files pass, reporting 113 total tracks and four pages.

### Task 3: Verify source completeness and application integrity

**Files:**
- Modify: `docs/superpowers/plans/2026-08-11-complete-white-noise-catalog.md` only to check completed steps

- [ ] **Step 1: Compare committed URLs with the pinned upstream OGG tree**

Run:

```bash
node --input-type=module -e '
const revision = "3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629";
const response = await fetch(`https://api.github.com/repos/Tosencen/XMSLEEP/git/trees/${revision}?recursive=1`);
const tree = await response.json();
const expected = tree.tree.filter(item => item.type === "blob" && item.path.startsWith("audio/") && item.path.endsWith(".ogg")).map(item => item.path.slice(6)).sort();
const { CUSTOM_WHITE_NOISE_EPISODES } = await import("./src/customAlbums.js");
const actual = CUSTOM_WHITE_NOISE_EPISODES.map(item => decodeURIComponent(new URL(item.audioUrl).pathname.split("/audio/")[1])).sort();
if (expected.length !== 113 || JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error({ expectedCount: expected.length, actualCount: actual.length, missing: expected.filter(path => !actual.includes(path)), extra: actual.filter(path => !expected.includes(path)) });
  process.exit(1);
}
console.log("Verified 113/113 pinned OGG paths");
'
```

Expected: `Verified 113/113 pinned OGG paths`.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all 21 test files and 204 tests pass, lint exits cleanly, the production build succeeds, and no whitespace errors are reported. The exact test total may increase if another independent change lands before execution; zero failures is mandatory.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/customAlbums.js src/customAlbums.test.js src/api.test.js docs/superpowers/plans/2026-08-11-complete-white-noise-catalog.md
git commit -m "feat: complete white noise catalog"
```
