# Album Topic Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-coverage vehicle-scene album categories with seven topic categories so most catalog albums land in a named group, while search, favorites, sorting, queues, and playback stay unchanged.

**Architecture:** Keep classification in `scripts/album-categories.js` during catalog generation. The browser only reads `album.category`. `src/catalog.js` imports the shared topic list so labels and order cannot drift. Recategorize the committed `public/data/albums.json` in place; do not add runtime classifiers, confidence fields, or a new cache key.

**Tech Stack:** Node ESM, Vitest, existing catalog generator, React catalog screens.

**Spec:** `docs/superpowers/specs/2026-08-28-album-topic-categories-design.md`

---

## File map

- Modify: `scripts/album-categories.js` — topic ids, manual map, keyword rules, coverage report
- Modify: `scripts/album-categories.test.js` — classification contract
- Modify: `scripts/generate-catalog.mjs` — print coverage after assigning `category`
- Modify: `src/catalog.js` — topic order and short labels
- Modify: `src/catalog.test.js` — grouping and labels
- Modify: `src/customAlbums.js` — white noise → `audio`
- Modify: `src/customAlbums.test.js`
- Modify: `public/data/albums.json` — rewrite `category` values only
- Unchanged: `src/components/CategorySections.jsx` (already renders `group.label` and “更多专辑”)
- Do not touch: daytime home playlist, album pagination, player/queue/favorites persistence, search matching, PWA cache, miniprogram

---

### Task 1: Lock the topic classification contract

**Files:**
- Modify: `scripts/album-categories.test.js`

- [ ] **Step 1: Replace the scene-category tests with topic-category tests**

Overwrite `scripts/album-categories.test.js` with:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  TOPIC_CATEGORIES,
  categorizeAlbum,
  categorizeAlbumName,
  reportCategoryCoverage,
} from './album-categories.js';

describe('album categories', () => {
  it('defines seven topic categories in display order', () => {
    expect(TOPIC_CATEGORIES).toEqual([
      { id: 'news', label: '资讯热点' },
      { id: 'car', label: '汽车蔚来' },
      { id: 'business', label: '商业科技' },
      { id: 'culture', label: '文化知识' },
      { id: 'lifestyle', label: '生活兴趣' },
      { id: 'audio', label: '音乐声音' },
      { id: 'kids', label: '亲子成长' },
    ]);
  });

  it('classifies typical albums into each topic', () => {
    expect(categorizeAlbum({ id: 64, name: '广州城市资讯' })).toBe('news');
    expect(categorizeAlbum({ id: 268, name: '用车百宝箱' })).toBe('car');
    expect(categorizeAlbum({ id: 541, name: '商业就是这样' })).toBe('business');
    expect(categorizeAlbum({ id: 608, name: '星星书房' })).toBe('culture');
    expect(categorizeAlbum({ id: 381, name: '晨曦说养生' })).toBe('lifestyle');
    expect(categorizeAlbum({ id: 306, name: '华语乐动听' })).toBe('audio');
    expect(categorizeAlbum({ id: 422, name: '金龟子讲绘本故事' })).toBe('kids');
  });

  it('prefers the manual id mapping over automatic rules', () => {
    expect(categorizeAlbum({ id: 35, name: '芝士分子' })).toBe('kids');
    expect(categorizeAlbum({ id: 584, name: 'N问' })).toBe('culture');
    expect(categorizeAlbum({ id: 5, name: '资讯充电站·早间版' })).toBe('news');
    expect(categorizeAlbum({ id: 401, name: '故事FM' })).toBe('lifestyle');
    expect(categorizeAlbum({ id: 107, name: '城市频道精选集' })).toBe('news');
    expect(categorizeAlbum({ id: 689, name: '青听' })).toBe('lifestyle');
  });

  it('uses description and latest title when the album name is ambiguous', () => {
    expect(categorizeAlbum({
      id: 688,
      name: '十字路口',
      description: '',
      latestEpisode: { title: '22 岁的具身 CEO 与人工智能' },
    })).toBe('business');
  });

  it('resolves overlapping keywords with the spec priority', () => {
    expect(categorizeAlbumName('蔚来儿童音乐电台')).toBe('car');
    expect(categorizeAlbumName('儿童音乐电台')).toBe('kids');
    expect(categorizeAlbumName('科技早报')).toBe('news');
  });

  it('does not classify from vague words alone', () => {
    expect(categorizeAlbumName('故事FM')).toBeNull();
    expect(categorizeAlbumName('成长日记')).toBeNull();
    expect(categorizeAlbumName('声音漂流瓶')).toBeNull();
    expect(categorizeAlbum({ id: 999, name: '路人抓马' })).toBeNull();
    expect(categorizeAlbum(null)).toBeNull();
  });

  it('covers at least 90% of the committed catalog', () => {
    const { albums } = JSON.parse(readFileSync(resolve('public/data/albums.json'), 'utf8'));
    const unknown = albums.filter(album => !categorizeAlbum(album)).length;
    expect(unknown / albums.length).toBeLessThan(0.1);
  });

  it('reports coverage and warns above 12% without throwing', () => {
    const log = { log: vi.fn(), warn: vi.fn() };
    const sparse = [
      { id: 1, name: '资讯充电站·早间版', category: 'news' },
      { id: 2, name: '路人抓马', category: null },
      { id: 3, name: '无人知晓', category: null },
    ];
    const report = reportCategoryCoverage(sparse, log);
    expect(report).toMatchObject({ unknown: 2, total: 3, ratio: 2 / 3 });
    expect(log.warn).toHaveBeenCalledOnce();
    expect(() => reportCategoryCoverage(sparse, log)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `npm test -- --run scripts/album-categories.test.js`

Expected: FAIL because `TOPIC_CATEGORIES` and `reportCategoryCoverage` do not exist, and current ids are still `commute` / `relax` / `longhaul` / `city`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add scripts/album-categories.test.js
git commit -m "test: specify topic-based album categories"
```

---

### Task 2: Implement topic classification

**Files:**
- Modify: `scripts/album-categories.js`

- [ ] **Step 1: Replace the scene classifier with the topic classifier**

Overwrite `scripts/album-categories.js` with:

```js
// 官方 API 无分类字段。命中顺序：人工 ID > 自动规则 > null（更多专辑）。
export const TOPIC_CATEGORIES = [
  { id: 'news', label: '资讯热点' },
  { id: 'car', label: '汽车蔚来' },
  { id: 'business', label: '商业科技' },
  { id: 'culture', label: '文化知识' },
  { id: 'lifestyle', label: '生活兴趣' },
  { id: 'audio', label: '音乐声音' },
  { id: 'kids', label: '亲子成长' },
];

const TOPIC_PRIORITY = ['car', 'kids', 'audio', 'news', 'business', 'culture', 'lifestyle'];

const MANUAL_ALBUM_IDS = {
  news: [799, 800, 30, 5, 23, 507, 356, 663, 107],
  kids: [35, 728, 741, 472, 458],
  audio: [306, 307, 11, 41, 669, 18, 661, 547, 394],
  culture: [584, 577],
  lifestyle: [689, 692, 401],
  car: [570, 438, 268, 308, 745, 735],
};

const NAME_RULES = [
  ['car', /蔚来|nio\b|onvo|乐道|萤火虫|提车|用车|爱车|约fan|驾驶|车友|保养|赛车|formula|es8|es9|et9|ec6|换电|车展|发布会|老司机|直通车|驾趣|nio day|nomi|蔚友|车机|蔚爱|阅蔚|同频|李斌|苏苏福福|王安宇|加电|牛屋|wo的车|玩转wo|蔚星/i],
  ['kids', /绘本|童声|儿童|少年|亲子|宝宝|哄娃|宝贝|童话|寓言|儿歌|家庭教育|孩子|拼读|汤姆·索亚|金龟子|小小少年|恐龙|礼貌|胡小闹|呼噜西游|亚斯与莉莉|黏糊糊|童言|萌宠补习|王国》儿童|安武林|米雪老师|海洋奇妙|超人救援|动物剧场|神奇动物|必读故事/],
  ['audio', /音乐|乐行|乐动|歪波|点唱机|点歌|电台|歌单|热歌|音乐会|乐光|乐章|band\b|dance|r&b|电音|古典|白噪音|vibration|weekend dance|年代电台|歌歌歌歌|自成音浪|seeds精选|hit music/i],
  ['news', /资讯|新闻|早间|晚间|速递|报道|早报|晚报|天气预报|城市频道|城市资讯|观察局|前方加速度|充电站|世界杯|摸鱼早报/],
  ['business', /商业|创业|投资|财经|科技|互联网|人工智能|\bai\b|工业|职场|经济|品牌|硅谷|编码|debug|tech talk|疯投|组织进化|一人公司|搞钱|美市|slow brand|果壳|十字路口/i],
  ['culture', /历史|文化|读书|书房|知识|科普|博物|艺术|文学|人文|诗词|唐诗|读库|世界史|节气|哲学|人物|讲堂|n问|生命周刊|魔法书|大宋|唐砖|汉乡|奥术|了不起的女性|城市记忆|城市地图|汉声/i],
  ['lifestyle', /生活|健康|养生|旅行|漫游|美食|咖啡|酒|运动|体育|游戏|电影|时尚|探店|玩乐地图|饭局|影视|健身|宠物|萌宠|目的地|吃喝|宵夜|律师|法律|机核|体育地平线|探险|杂谈|乱劈柴|百事有感觉|吃吃白相|fun游|津津有味|不开玩笑|映画|好梗|大口说|去现场|打工人|周刊|喜剧|剧场|剧谈|律师生活|海獭|脑筋|广播剧/i],
];

const manualById = new Map();
for (const [categoryId, ids] of Object.entries(MANUAL_ALBUM_IDS)) {
  for (const id of ids) manualById.set(Number(id), categoryId);
}

function matchTopic(text) {
  if (!text) return null;
  const hits = NAME_RULES.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
  return TOPIC_PRIORITY.find(id => hits.includes(id)) || null;
}

export function categorizeAlbumName(name) {
  return matchTopic(name);
}

export function categorizeAlbum(album) {
  if (!album) return null;
  const manual = manualById.get(Number(album.id));
  if (manual) return manual;
  return matchTopic([album.name, album.description, album.latestEpisode?.title].filter(Boolean).join('\n'));
}

export function reportCategoryCoverage(albums, log = console) {
  const counts = Object.fromEntries(TOPIC_CATEGORIES.map(category => [category.id, 0]));
  const unknownAlbums = [];
  for (const album of albums || []) {
    if (album?.category && counts[album.category] != null) counts[album.category] += 1;
    else unknownAlbums.push(album);
  }
  const total = (albums || []).length;
  const unknown = unknownAlbums.length;
  const ratio = total ? unknown / total : 0;
  log.log(`Category coverage: ${TOPIC_CATEGORIES.map(category => `${category.id}=${counts[category.id]}`).join(' ')} unknown=${unknown}/${total} (${(ratio * 100).toFixed(1)}%)`);
  if (unknown) {
    log.log('Unclassified albums:');
    for (const album of unknownAlbums) log.log(`${album?.id ?? '?'}\t${album?.name ?? ''}`);
  }
  if (ratio > 0.12) log.warn(`WARNING: unclassified albums exceed 12% (${(ratio * 100).toFixed(1)}%)`);
  return { counts, unknown, total, ratio };
}
```

Do not export `SCENE_CATEGORIES`. Do not write confidence or reason fields.

- [ ] **Step 2: Run the classification tests**

Run: `npm test -- --run scripts/album-categories.test.js`

Expected: PASS. If the 90% coverage assertion fails, add the smallest extra keyword or manual id that correctly classifies several remaining albums; do not dump leftover talk shows into a random topic.

- [ ] **Step 3: Commit**

```bash
git add scripts/album-categories.js
git commit -m "feat: classify albums by topic instead of driving scene"
```

---

### Task 3: Print coverage from catalog generation

**Files:**
- Modify: `scripts/generate-catalog.mjs`

- [ ] **Step 1: Report coverage after assigning categories**

In `scripts/generate-catalog.mjs`, change the import to:

```js
import { categorizeAlbum, reportCategoryCoverage } from './album-categories.js';
```

After the existing loop that sets `album.category`, add:

```js
reportCategoryCoverage(albums);
```

Do not fail the generator when unknown albums exceed 12%.

- [ ] **Step 2: Run classification and catalog-generator tests**

Run: `npm test -- --run scripts/album-categories.test.js scripts/catalog-generator.test.js`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-catalog.mjs
git commit -m "feat: log album category coverage when generating catalog"
```

---

### Task 4: Show short topic labels in the directory

**Files:**
- Modify: `src/catalog.test.js`
- Modify: `src/catalog.js`

- [ ] **Step 1: Point catalog tests at topic order and labels**

In `src/catalog.test.js`, change the import of `SCENE_CATEGORY_LABELS, SCENE_CATEGORY_ORDER` to `TOPIC_CATEGORY_LABELS, TOPIC_CATEGORY_ORDER`.

Replace the grouping fixture and assertions:

```js
it('groups albums by topic category with unclassified fallback', () => {
  const albums = [
    { id: 1, name: '路人抓马', category: null, latestEpisode: episode(11, 100) },
    { id: 35, name: '芝士分子', category: 'kids', latestEpisode: episode(351, 300) },
    { id: 5, name: '资讯充电站·早间版', category: 'news', latestEpisode: episode(51, 200) },
    { id: 2, name: '华语经典精选', category: 'audio', latestEpisode: episode(22, 400) },
  ];
  const { groups, rest } = groupAlbumsByCategory(albums);
  expect(groups.map(group => group.id)).toEqual(TOPIC_CATEGORY_ORDER);
  expect(groups.find(group => group.id === 'news').albums.map(album => album.id)).toEqual([5]);
  expect(groups.find(group => group.id === 'kids').albums.map(album => album.id)).toEqual([35]);
  expect(groups.find(group => group.id === 'audio').albums.map(album => album.id)).toEqual([2]);
  expect(rest.map(album => album.id)).toEqual([1]);
});

it('exposes short topic labels for every category', () => {
  expect(TOPIC_CATEGORY_ORDER.map(id => TOPIC_CATEGORY_LABELS[id])).toEqual([
    '资讯热点',
    '汽车蔚来',
    '商业科技',
    '文化知识',
    '生活兴趣',
    '音乐声音',
    '亲子成长',
  ]);
});
```

- [ ] **Step 2: Run the catalog test and confirm it fails**

Run: `npm test -- --run src/catalog.test.js`

Expected: FAIL on missing `TOPIC_CATEGORY_*` exports and old scene labels.

- [ ] **Step 3: Switch catalog grouping to the shared topic list**

In `src/catalog.js`, add:

```js
import { TOPIC_CATEGORIES } from '../scripts/album-categories.js';
```

Replace the scene constants with:

```js
export const TOPIC_CATEGORY_ORDER = TOPIC_CATEGORIES.map(category => category.id);
export const TOPIC_CATEGORY_LABELS = Object.fromEntries(TOPIC_CATEGORIES.map(category => [category.id, category.label]));
```

Update `groupAlbumsByCategory` to use `TOPIC_CATEGORY_ORDER` and `TOPIC_CATEGORY_LABELS`. Remove `SCENE_CATEGORY_ORDER` and `SCENE_CATEGORY_LABELS`.

Leave `sortAlbumsForDirectory`, favorites, pins, boosts, and city-channel demotion unchanged.

- [ ] **Step 4: Run catalog tests**

Run: `npm test -- --run src/catalog.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "feat: show short topic labels in the album directory"
```

---

### Task 5: Move white noise into 音乐声音

**Files:**
- Modify: `src/customAlbums.test.js`
- Modify: `src/customAlbums.js`

- [ ] **Step 1: Expect the custom album in `audio`**

In `src/customAlbums.test.js`, change `category: 'commute'` to `category: 'audio'`.

- [ ] **Step 2: Run the custom-album test and confirm it fails**

Run: `npm test -- --run src/customAlbums.test.js`

Expected: FAIL because `CUSTOM_WHITE_NOISE_ALBUM.category` is still `'commute'`.

- [ ] **Step 3: Update the custom album category**

In `src/customAlbums.js`, set `category: 'audio'`.

Keep OGG hiding, looping playback, and cover paths unchanged.

- [ ] **Step 4: Run the custom-album test**

Run: `npm test -- --run src/customAlbums.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/customAlbums.js src/customAlbums.test.js
git commit -m "fix: file the white-noise album under music"
```

---

### Task 6: Rewrite committed catalog categories

**Files:**
- Modify: `public/data/albums.json`

- [ ] **Step 1: Recategorize the existing catalog without refetching**

Run from the repo root:

```bash
node --input-type=module <<'EOF'
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { categorizeAlbum, reportCategoryCoverage } from './scripts/album-categories.js';
import { writeCatalogAtomically } from './scripts/catalog-generator.js';

const output = resolve('public/data/albums.json');
const catalog = JSON.parse(await readFile(output, 'utf8'));
catalog.albums = catalog.albums.map(album => ({ ...album, category: categorizeAlbum(album) }));
const report = reportCategoryCoverage(catalog.albums);
if (report.ratio >= 0.1) {
  throw new Error(`unclassified ratio ${(report.ratio * 100).toFixed(1)}% exceeds 10% first-publish target`);
}
await writeCatalogAtomically(output, catalog);
EOF
```

Expected: script prints coverage, unknown < 10%, and rewrites only `category` values. Album ids, episode ids, and other fields stay the same.

Do not run a live catalog scan unless the JSON rewrite fails and the cause is stale album metadata.

- [ ] **Step 2: Re-run classification against the rewritten file**

Run: `npm test -- --run scripts/album-categories.test.js src/catalog.test.js src/customAlbums.test.js`

Expected: PASS, including the 90% coverage assertion.

- [ ] **Step 3: Commit**

```bash
git add public/data/albums.json
git commit -m "chore: recategorize catalog albums by topic"
```

---

### Task 7: Verify the directory still behaves

**Files:**
- No source changes unless a test names an old scene label.

- [ ] **Step 1: Run the full suite**

Run: `npm test && npm run lint && npm run build`

Expected: all unit tests pass, oxlint is clean, Vite build succeeds. Search, favorites, queue, daytime home, and album paging tests remain green.

- [ ] **Step 2: Spot-check the UI contract**

Confirm `CategorySections` still renders `group.label` plus count, expands 12 → all, and only shows “更多专辑” when `rest` is non-empty. No component change is required if Task 4 already supplies the new labels.

If any test still expects `通勤场景|资讯速递` or `category: 'commute'`, update that assertion to the new topic id/label. Do not change search matching or player behavior to make a test pass.

- [ ] **Step 3: Commit only if Step 2 required a follow-up fix**

```bash
git add <files>
git commit -m "fix: update leftover scene-category assertions"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Seven topics and display order | 1, 2, 4 |
| Single membership, “更多专辑” fallback | 1, 2, 4 |
| Name + description + latest title | 1, 2 |
| Manual id > rules > null | 1, 2 |
| Conflict priority 汽车蔚来 → … → 生活兴趣 | 1, 2 |
| Vague 故事 / 成长 / 声音 do not classify alone | 1, 2 |
| Coverage log and 12% warn without failing generate | 2, 3 |
| Short labels, existing expand/sort/search | 4 |
| White noise in 音乐声音 | 5 |
| Rewrite `category` only, no cache-key migration | 6 |
| First publish unknown < 10% | 1, 6 |
| No daytime / player / miniprogram changes | 7 |
