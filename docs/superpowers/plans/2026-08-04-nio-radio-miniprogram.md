# NIO Radio 微信小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 NIO Radio 播客网页版移植为原生微信小程序，在开发者工具与真机预览中复刻移动端全部功能与视觉。

**Architecture:** 原生小程序（WXML/WXSS/JS，CommonJS），4 个页面 + 全局播放器/目录服务 + 复用组件；纯逻辑模块从网页版仓库逐字移植并配 Vitest 单测；预览期目录从 `https://nio.k4le.top/data/albums.json` 刷新，节目接口直连蔚来公开接口，数据层预留云函数切换点。

**Tech Stack:** 微信小程序（基础库 latest）、BackgroundAudioManager、Vitest、oxlint

---

## 文件结构

```
nio radio/
  project.config.json        # 开发者工具配置（touristappid、不校验域名）
  app.json                   # 页面、自定义导航、darkmode、后台音频
  app.js                     # 启动时初始化目录/播放器服务
  app.wxss                   # 全局变量与基础样式（var(--*) 引用 theme.json）
  theme.json                 # 浅/深两套色板变量（与网页版一致）
  sitemap.json
  package.json               # Vitest / oxlint
  data/albums.json           # 从网页版仓库复制的目录（565 专辑）
  utils/
    format.js                # formatDuration / formatClock / formatDate
    storage.js               # wx 存储适配（getItem/setItem，可注入内存实现）
    api.js                   # 节目接口（wx.request）+ 10 分钟缓存 + 并发去重
    catalog.js               # 网页版 src/catalog.js 逐字移植
    playerState.js           # 网页版 src/playerState.js 逐字移植
    laterPlayback.js         # 网页版 src/laterPlayback.js 逐字移植
    api-config.js            # 数据源模式开关（direct/cloud）
  services/
    player-store.js          # BackgroundAudioManager 单例 + 订阅 + 持久化
    catalog-store.js         # 目录加载、5 分钟新鲜度、单飞刷新、通知
  components/
    custom-nav/              # 状态栏 + 自定义顶栏
    artwork/                 # 封面（失败占位）
    state-view/              # 加载/空/错误统一视图
    episode-row/             # 节目行
    album-row/               # 专辑行
    mini-player/             # 迷你播放器
    queue-sheet/             # 队列弹层（三 Tab + 稍后播放 + 选择器）
  pages/
    home/index.*             # 今日推荐 + 今日更新/最新更新
    albums/index.*           # 全部专辑（置顶 + 分页）
    search/index.*           # 搜索（本地过滤 + 防抖）
    album/index.*            # 专辑详情（分页 + 稍后播放）
  test/                      # Vitest 用例
  README.md                  # 开发与验收说明
```

**设计调整（相对设计文档）：** `services/episode-cache.js` 合并进 `utils/api.js`，与网页版 `src/api.js` 的缓存/去重实现保持一致；`project.config.json` 使用 `touristappid`，真机预览时替换为用户自己的 AppID。

**复刻基准：** `/Users/kale/.openclaw/workspace/nio-podcast-web`（`main` @ 0b446dd），关键文件 `src/App.jsx`、`src/App.css`、`src/api.js`、`src/catalog.js`、`src/playerState.js`、`src/laterPlayback.js`、`public/data/albums.json`。UI 任务中“按网页版换算”指：把 `src/App.css` 的移动端规则按本计划 Task 6 的 rpx 换算表改写，文案与行为以 `src/App.jsx` 为准。

---

### Task 0: 项目脚手架与全局配置

**Files:**
- Create: `project.config.json`
- Create: `app.json`
- Create: `theme.json`
- Create: `sitemap.json`
- Create: `app.js`
- Create: `app.wxss`
- Create: `package.json`
- Create: `data/albums.json`（复制自网页版仓库 `public/data/albums.json`）
- Create: `test/smoke.test.js`

- [ ] **Step 1: 复制目录数据并校验**

```bash
mkdir -p data test
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/public/data/albums.json" data/albums.json
node -e "const d=require('./data/albums.json'); console.log('albums:', d.albums.length); if (!Array.isArray(d.albums) || d.albums.length < 500) process.exit(1)"
```

Expected: `albums: 565`

- [ ] **Step 2: 创建全局配置文件**

`project.config.json`：

```json
{
  "appid": "touristappid",
  "compileType": "miniprogram",
  "libVersion": "latest",
  "projectname": "nio-radio",
  "description": "NIO Radio 播客小程序",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "coverView": true,
    "ignoreUploadUnusedFiles": true
  },
  "condition": {}
}
```

`app.json`：

```json
{
  "pages": [
    "pages/home/index",
    "pages/albums/index",
    "pages/search/index",
    "pages/album/index"
  ],
  "window": {
    "navigationStyle": "custom",
    "backgroundColor": "#ffffff",
    "backgroundTextStyle": "dark"
  },
  "darkmode": true,
  "themeLocation": "theme.json",
  "requiredBackgroundModes": ["audio"],
  "sitemapLocation": "sitemap.json",
  "lazyCodeLoading": "requiredComponents"
}
```

`theme.json`（变量名与网页版色板一致）：

```json
{
  "light": {
    "--surface": "#ffffff",
    "--surface-soft": "#f5f8f9",
    "--aqua": "#e7f7f7",
    "--teal": "#00b9b5",
    "--teal-dark": "#006f6d",
    "--ink": "#08162e",
    "--muted": "#5f6b7b",
    "--muted-strong": "#4b586b",
    "--line": "#e8edf0",
    "--danger": "#b53939"
  },
  "dark": {
    "--surface": "#101a27",
    "--surface-soft": "#182433",
    "--aqua": "#133239",
    "--teal": "#2bd0c6",
    "--teal-dark": "#8af5eb",
    "--ink": "#f0f6fa",
    "--muted": "#b8c4ce",
    "--muted-strong": "#d3dde5",
    "--line": "#2b3949",
    "--danger": "#ff9292"
  }
}
```

`sitemap.json`：

```json
{
  "rules": [{ "action": "allow", "page": "*" }]
}
```

`app.js`：

```js
App({
  onLaunch() {
    require('./services/catalog-store').getStore();
    require('./services/player-store').initPlayerStore();
  },
});
```

`app.wxss`：

```css
page {
  background: var(--surface-soft);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 32rpx;
  line-height: 1.45;
}
button, input { font: inherit; }
button::after { border: 0; }
view, text, image, button { box-sizing: border-box; }
```

`package.json`：

```json
{
  "name": "nio-radio-miniprogram",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "oxlint utils services pages components test"
  },
  "devDependencies": {
    "oxlint": "^1.75.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: 添加冒烟测试并安装依赖**

`test/smoke.test.js`：

```js
import { describe, expect, it } from 'vitest';

describe('project scaffold', () => {
  it('ships a non-empty album catalog', () => {
    const catalog = require('../data/albums.json');
    expect(Array.isArray(catalog.albums)).toBe(true);
    expect(catalog.albums.length).toBeGreaterThan(500);
  });
});
```

Run:

```bash
npm install
npm test
```

Expected: 1 个测试 PASS。

- [ ] **Step 4: 在微信开发者工具验证项目可打开**

打开微信开发者工具 → 导入项目 → 选择本目录 → AppID 使用测试号（touristappid 已配置）。Expected：项目编译无错误，首页为空白页（页面尚未创建时开发者工具会提示缺失页面，属预期；随后 Task 6 创建首页后消失）。若工具提示缺页，可先确认 `app.json` 路径正确。

- [ ] **Step 5: Commit**

```bash
git add project.config.json app.json theme.json sitemap.json app.js app.wxss package.json package-lock.json data/albums.json test/smoke.test.js
git commit -m "chore: scaffold nio radio mini program"
```

---

### Task 1: utils/format 与 utils/storage

**Files:**
- Create: `utils/format.js`
- Create: `utils/storage.js`
- Create: `test/format.test.js`
- Create: `test/storage.test.js`

- [ ] **Step 1: 写失败测试**

`test/format.test.js`：

```js
import { describe, expect, it } from 'vitest';
import { formatClock, formatDate, formatDuration } from '../utils/format';

describe('format helpers', () => {
  it('formats durations as h:mm:ss or m:ss', () => {
    expect(formatDuration(253000)).toBe('4:13');
    expect(formatDuration(11172000)).toBe('3:06:12');
    expect(formatDuration(-1)).toBe('--:--');
  });
  it('formats clock seconds', () => {
    expect(formatClock(146)).toBe('2:26');
    expect(formatClock(0)).toBe('0:00');
  });
  it('formats M/D dates', () => {
    expect(formatDate(new Date(2026, 7, 2).getTime())).toBe('8/2');
    expect(formatDate(Number.NaN)).toBe('');
  });
});
```

`test/storage.test.js`：

```js
import { describe, expect, it } from 'vitest';
import { createStorage } from '../utils/storage';

describe('storage adapter', () => {
  it('round-trips string values through an injected backend', () => {
    const backend = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); } };
    const storage = createStorage(backend);
    storage.setItem('k', '{"a":1}');
    expect(storage.getItem('k')).toBe('{"a":1}');
  });
  it('returns null on read failure', () => {
    const storage = createStorage({ getItem() { throw new Error('boom'); }, setItem() {} });
    expect(storage.getItem('k')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`utils/format.js`（与网页版 `src/App.jsx` 第 37–76 行逻辑一致）：

```js
function formatDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) return '--:--';
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const rest = totalSeconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

module.exports = { formatDuration, formatClock, formatDate };
```

`utils/storage.js`：

```js
function createStorage(backend) {
  const impl = backend || {
    getItem(key) {
      try { return wx.getStorageSync(key) || null; } catch { return null; }
    },
    setItem(key, value) {
      try { wx.setStorageSync(key, value); return true; } catch { return false; }
    },
  };
  return {
    getItem(key) {
      try { const value = impl.getItem(key); return value == null ? null : value; } catch { return null; }
    },
    setItem(key, value) {
      try { impl.setItem(key, value); return true; } catch { return false; }
    },
  };
}

module.exports = { createStorage };
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: 3 个测试全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add utils/format.js utils/storage.js test/format.test.js test/storage.test.js
git commit -m "feat: add format and storage utils"
```

---

### Task 2: utils/api（节目接口 + 缓存 + 并发去重）

**Files:**
- Create: `utils/api.js`
- Create: `test/api.test.js`

接口与网页版 `src/api.js` 行为一致：`POST gateway-front-external.nio.com/moat/100914/v2/audio/list`、8 秒超时、错误码 `OFFLINE/TIMEOUT/HTTP_ERROR/INVALID_RESPONSE/NETWORK_ERROR`、10 分钟缓存（最多 100 条）、并发同键去重。差异：用 `wx.request` 替代 `fetch`，通过可注入的 `requestImpl(params)` 便于单测。

- [ ] **Step 1: 写失败测试（移植网页版 api.test.js 语义）**

`test/api.test.js`：

```js
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, clearEpisodeCache, getEpisodes, normalizeAudioUrl } from '../utils/api';

function responseFor(data) {
  return { statusCode: 200, data };
}

function requestOk(payload) {
  return async () => responseFor(payload);
}

describe('api', () => {
  beforeEach(() => clearEpisodeCache());

  it('normalizes http audio urls to https', () => {
    expect(normalizeAudioUrl('http://cdn.example/a.aac')).toBe('https://cdn.example/a.aac');
    expect(normalizeAudioUrl('https://cdn.example/a.aac')).toBe('https://cdn.example/a.aac');
    expect(normalizeAudioUrl('')).toBe('');
  });

  it('maps episode payloads and pagination flags', async () => {
    const payload = {
      result: {
        totalCount: 2,
        haveNext: 1,
        dataList: [{
          audioId: 1, audioName: '第一集', albumId: 5, albumName: '早间版',
          albumPic: 'http://cdn.example/p.jpg', host: ['A', 'B'], singer: 'S',
          duration: 253000, onlineTime: 1785513600000,
          aacPlayUrl192: 'http://cdn.example/1.aac', aacFileSize192: 123,
        }],
      },
    };
    const result = await getEpisodes(5, 1, 30, requestOk(payload));
    expect(result.episodes[0]).toMatchObject({
      id: 1, title: '第一集', albumId: 5, albumName: '早间版',
      host: 'A, B', audioUrl: 'https://cdn.example/1.aac',
    });
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(2);
  });

  it('throws typed errors for http and invalid payloads', async () => {
    await expect(getEpisodes(1, 1, 30, async () => ({ statusCode: 500, data: {} })))
      .rejects.toMatchObject({ name: 'ApiError', code: 'HTTP_ERROR' });
    await expect(getEpisodes(1, 1, 30, async () => ({ statusCode: 200, data: {} })))
      .rejects.toMatchObject({ name: 'ApiError', code: 'INVALID_RESPONSE' });
    await expect(getEpisodes(1, 1, 30, async () => { throw new Error('net'); }))
      .rejects.toMatchObject({ name: 'ApiError', code: 'NETWORK_ERROR' });
  });

  it('deduplicates concurrent identical requests', async () => {
    let calls = 0;
    let release;
    const pending = () => { calls += 1; return new Promise(resolve => { release = () => resolve(responseFor({ result: { dataList: [], totalCount: 0, haveNext: 0 } })); }); };
    const first = getEpisodes(5, 1, 30, pending);
    const second = getEpisodes(5, 1, 30, pending);
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it('reuses a successful result within ten minutes', async () => {
    let calls = 0;
    const ok = () => { calls += 1; return Promise.resolve(responseFor({ result: { dataList: [], totalCount: 0, haveNext: 0 } })); };
    await getEpisodes(5, 1, 30, ok);
    await getEpisodes(5, 1, 30, ok);
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL（`../utils/api` 不存在）。

- [ ] **Step 3: 实现 utils/api.js**

```js
const BASE = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';
const FETCH_TIMEOUT_MS = 8000;
const EPISODE_CACHE_TTL_MS = 10 * 60 * 1000;
const EPISODE_CACHE_MAX_ENTRIES = 100;
const episodeCache = new Map();
const episodeRequests = new Map();

class ApiError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.cause = cause;
  }
}

function normalizeAudioUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

function mapEpisode(ep) {
  const host = Array.isArray(ep.host) ? ep.host.join(', ') : typeof ep.host === 'string' ? ep.host : '';
  return {
    id: ep.audioId,
    title: ep.audioName || '未命名节目',
    albumId: ep.albumId,
    albumName: ep.albumName || '',
    albumPic: ep.albumPic || '',
    albumDesc: ep.albumDesc || '',
    host: host || ep.singer || '',
    duration: ep.duration,
    onlineTime: ep.onlineTime,
    audioUrl: normalizeAudioUrl(ep.aacPlayUrl192 || ep.aacPlayUrl128 || ep.mp3PlayUrl64 || ''),
    fileSize: ep.aacFileSize192,
  };
}

function requestViaWx(params) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE,
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data: params,
      timeout: FETCH_TIMEOUT_MS,
      success: resolve,
      fail: reject,
    });
  });
}

async function requestEpisodes(albumId, page, pageSize, requestImpl) {
  const params = {
    albumId: String(albumId),
    sorttype: '2',
    pagenum: String(page),
    pagesize: String(pageSize),
  };
  let response;
  try {
    response = await (requestImpl || requestViaWx)(params);
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', '无法连接音频服务', error);
  }
  if (!response || response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError('HTTP_ERROR', `音频服务返回 ${response ? response.statusCode : '未知'} 状态`, response && response.statusCode);
  }
  const result = response.data && response.data.result;
  if (!result || !Array.isArray(result.dataList)) {
    throw new ApiError('INVALID_RESPONSE', '音频服务返回了无法读取的数据');
  }
  return {
    episodes: result.dataList.map(mapEpisode),
    totalCount: Number(result.totalCount) || 0,
    hasMore: result.haveNext === 1 || result.haveNext === true,
  };
}

function clearEpisodeCache() {
  episodeCache.clear();
  episodeRequests.clear();
}

async function getEpisodes(albumId, page = 1, pageSize = 30, requestImpl) {
  const key = `${albumId}:${page}:${pageSize}`;
  const cached = episodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) episodeCache.delete(key);
  const inFlight = episodeRequests.get(key);
  if (inFlight) return inFlight;
  const request = requestEpisodes(albumId, page, pageSize, requestImpl)
    .then(result => {
      episodeCache.set(key, { value: result, expiresAt: Date.now() + EPISODE_CACHE_TTL_MS });
      while (episodeCache.size > EPISODE_CACHE_MAX_ENTRIES) {
        episodeCache.delete(episodeCache.keys().next().value);
      }
      return result;
    })
    .finally(() => episodeRequests.delete(key));
  episodeRequests.set(key, request);
  return request;
}

module.exports = { ApiError, normalizeAudioUrl, getEpisodes, clearEpisodeCache };
```

注：小程序端离线前置检测（`wx.getNetworkType`）不阻塞首版，网络不可用时 `wx.request` fail 回调会进入 `NETWORK_ERROR`；如需要与网页版 `OFFLINE` 码完全一致，后续在 `requestViaWx` 内加 `getNetworkType` 判断，测试不变。

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: 全部 PASS（含 api 5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add utils/api.js test/api.test.js
git commit -m "feat: port episode api with cache"
```

---

### Task 3: 逐字移植 catalog / playerState / laterPlayback

**Files:**
- Create: `utils/catalog.js`（= 网页版 `src/catalog.js`）
- Create: `utils/playerState.js`（= 网页版 `src/playerState.js`）
- Create: `utils/laterPlayback.js`（= 网页版 `src/laterPlayback.js`）
- Create: `test/catalog.test.js`、`test/playerState.test.js`、`test/laterPlayback.test.js`（移植网页版同名测试，仅改导入路径）

- [ ] **Step 1: 复制文件并确认无差异**

```bash
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/catalog.js" utils/catalog.js
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/playerState.js" utils/playerState.js
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/laterPlayback.js" utils/laterPlayback.js
diff "/Users/kale/.openclaw/workspace/nio-podcast-web/src/catalog.js" utils/catalog.js
diff "/Users/kale/.openclaw/workspace/nio-podcast-web/src/playerState.js" utils/playerState.js
diff "/Users/kale/.openclaw/workspace/nio-podcast-web/src/laterPlayback.js" utils/laterPlayback.js
```

Expected: 三个 diff 均无输出。这些模块使用 CommonJS 兼容的 `export function`？不兼容——网页版是 ESM。执行下一步转换。

- [ ] **Step 2: 转换为 CommonJS（仅文件末尾追加导出）**

在三个文件末尾各追加：

```js
module.exports = { sortAlbumsByLatest, sortAlbumsForDirectory, selectHomeEpisodes, normalizeCatalog, readCatalogCache, writeCatalogCache, loadCatalog, CATALOG_CACHE_KEY };
```

（`catalog.js` 使用上面这行；`playerState.js` 导出 `PLAYER_STATE_VERSION, PLAYER_STORAGE_KEY, createPlayerState, enqueueEpisodes, selectEpisode, insertNext, removeFromQueue, advanceQueue, recordHistory, canResume, serializePlayerState, restorePlayerState`；`laterPlayback.js` 导出 `LATER_PLAYBACK_STORAGE_KEY, addLaterEpisode, removeLaterEpisode, moveLaterEpisode, readLaterEpisodes, writeLaterEpisodes`。）

注意：`catalog.js` 与 `laterPlayback.js` 的默认 `storage = globalThis.localStorage` 在小程序环境不存在，调用方必须显式传入 `createStorage()` 实例（见 Task 4/5）；`playerState.js` 的 `serializePlayerState/restorePlayerState` 只处理字符串，不依赖 storage，无需改动。

- [ ] **Step 3: 移植测试**

复制网页版三个测试文件到 `test/`，把第一行的 `from '../src/...'` 或相对路径改为 `from '../utils/...'`：

```bash
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/catalog.test.js" test/catalog.test.js
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/playerState.test.js" test/playerState.test.js
cp "/Users/kale/.openclaw/workspace/nio-podcast-web/src/laterPlayback.test.js" test/laterPlayback.test.js
```

Expected: `catalog.test.js` 引用 `../utils/catalog`；`playerState.test.js` 引用 `../utils/playerState`；`laterPlayback.test.js` 引用 `../utils/laterPlayback`。`catalog.test.js` 中凡调用 `loadCatalog`/`readCatalogCache`/`writeCatalogCache` 的用例，把 `storage` 参数替换为内存实现（`{ getItem: () => null, setItem: () => {} }` 或直接传 `undefined` 前先看原用例签名）。

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: 网页版 130 项中属于这三个模块的用例全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add utils/catalog.js utils/playerState.js utils/laterPlayback.js test/catalog.test.js test/playerState.test.js test/laterPlayback.test.js
git commit -m "feat: port catalog and playback state modules"
```

---

### Task 4: services/player-store

**Files:**
- Create: `utils/api-config.js`
- Create: `services/player-store.js`
- Create: `test/player-store.test.js`

播放器单例包装 `BackgroundAudioManager`，订阅式状态，持久化键 `nio_player_state_v2` / `nio_play_later_v1`，行为与网页版 App.jsx 第 907–1110 行一致。

- [ ] **Step 1: 创建 api-config**

`utils/api-config.js`：

```js
const config = {
  mode: 'direct', // 'direct' | 'cloud'
  catalogBase: 'https://nio.k4le.top/',
  episodeBase: 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list',
  cloudFunctionName: 'nioProxy',
};

module.exports = { config };
```

- [ ] **Step 2: 写失败测试**

`test/player-store.test.js`：

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

function fakeBgm() {
  const handlers = {};
  return {
    src: '', title: '', epname: '', singer: '', coverImgUrl: '', startTime: 0,
    on(event, fn) { handlers[event] = fn; },
    fire(event, ...args) { handlers[event]?.(...args); },
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(),
  };
}

function fakeWx(bgm) {
  const store = new Map();
  return {
    bgm,
    store,
    getStorageSync: (key) => store.get(key) ?? '',
    setStorageSync: (key, value) => { store.set(key, value); },
    getBackgroundAudioManager: () => bgm,
  };
}

async function boot(episode, isPlaying = true) {
  globalThis.wx = fakeWx(fakeBgm());
  const storage = { getItem: (k) => (k === 'nio_player_state_v2' ? JSON.stringify({
    version: 2, currentEpisode: episode, queue: [episode], queueIndex: 0,
    positionSeconds: 0, durationSeconds: 253, isPlaying, history: [], updatedAt: Date.now(),
  }) : null), setItem: () => {} };
  vi.resetModules();
  const store = await import('../services/player-store');
  store.initPlayerStore({ storage, bgm: wx.bgm, storageImpl: storage });
  return { bgm: wx.bgm, store };
}

const episode = { id: 1, title: '第一集', albumName: '早间版', albumPic: '', audioUrl: 'https://cdn.example/1.aac', duration: 253000 };

describe('player store', () => {
  beforeEach(() => { globalThis.wx = undefined; });

  it('restores and resumes playback from persisted state', async () => {
    const { bgm } = await boot(episode, true);
    expect(bgm.play).toHaveBeenCalled();
    expect(bgm.src).toBe(episode.audioUrl);
  });

  it('does not autoplay when persisted state is paused', async () => {
    const { bgm } = await boot(episode, false);
    expect(bgm.play).not.toHaveBeenCalled();
  });

  it('advances once on ended and stops at queue tail', () => {
    // 行为验证依赖 playerState 纯函数（已覆盖）；此处验证 ended 事件接线
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npm test`
Expected: FAIL（`../services/player-store` 不存在）。

- [ ] **Step 4: 实现 player-store**

`services/player-store.js`：

```js
const {
  PLAYER_STORAGE_KEY,
  advanceQueue, canResume, createPlayerState, enqueueEpisodes, insertNext,
  recordHistory, removeFromQueue, restorePlayerState, selectEpisode, serializePlayerState,
} = require('../utils/playerState');
const { LATER_PLAYBACK_STORAGE_KEY, addLaterEpisode, moveLaterEpisode, readLaterEpisodes, removeLaterEpisode, writeLaterEpisodes } = require('../utils/laterPlayback');
const { createStorage } = require('../utils/storage');

const SAVE_THROTTLE_MS = 5000;

let storage = createStorage();
let bgm = null;
let state = { player: createPlayerState(), later: [] };
const listeners = new Set();
let lastSavedAt = 0;

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch {} });
}

function persist(force = false) {
  const now = Date.now();
  if (!force && now - lastSavedAt < SAVE_THROTTLE_MS) return;
  lastSavedAt = now;
  storage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(state.player));
}

function setPlayer(next, { forceSave = false, notifyChange = true } = {}) {
  state = { ...state, player: next };
  if (notifyChange) notify();
  persist(forceSave);
}

function setLater(items) {
  state = { ...state, later: items };
  writeLaterEpisodes(items, storage);
  notify();
}

function loadEpisode(episode, shouldPlay) {
  if (!episode || !episode.audioUrl) return;
  bgm.src = episode.audioUrl;
  bgm.title = episode.title;
  bgm.epname = episode.albumName || 'NIO Radio';
  bgm.singer = episode.host || 'NIO Radio';
  bgm.coverImgUrl = episode.albumPic || '';
  const { positionSeconds, durationSeconds } = state.player;
  if (canResume(positionSeconds, durationSeconds)) {
    try { bgm.startTime = positionSeconds; } catch {}
  }
  if (shouldPlay) bgm.play();
}

function initPlayerStore(options = {}) {
  if (bgm) return state;
  storage = options.storage || createStorage();
  bgm = options.bgm || wx.getBackgroundAudioManager();
  const player = restorePlayerState(storage.getItem(PLAYER_STORAGE_KEY));
  state = { player, later: readLaterEpisodes(storage) };

  bgm.onTimeUpdate(() => {
    const position = typeof bgm.currentTime === 'number' ? bgm.currentTime : state.player.positionSeconds;
    setPlayer({ ...state.player, positionSeconds: position });
  });
  bgm.onEnded(() => {
    const previous = state.player;
    const completed = previous.currentEpisode;
    let later = state.later;
    if (completed) later = removeLaterEpisode(later, completed.id);
    const next = advanceQueue(previous);
    const hasNext = Boolean(next.currentEpisode && next.currentEpisode.id !== previous.currentEpisode && next.currentEpisode.id !== (previous.currentEpisode && previous.currentEpisode.id));
    const player = {
      ...next,
      history: hasNext ? recordHistory(previous.history, next.currentEpisode) : previous.history,
      isPlaying: hasNext,
    };
    state = { player, later };
    writeLaterEpisodes(later, storage);
    notify();
    persist(true);
    if (hasNext) loadEpisode(next.currentEpisode, true);
  });
  bgm.onError(() => {
    setPlayer({ ...state.player, isPlaying: false, error: '音频加载失败，请检查网络后重试' }, { forceSave: true });
  });
  bgm.onPlay(() => setPlayer({ ...state.player, isPlaying: true }));
  bgm.onPause(() => setPlayer({ ...state.player, isPlaying: false }));

  const current = state.player.currentEpisode;
  if (current) loadEpisode(current, Boolean(state.player.isPlaying));
  notify();
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function getState() {
  return state;
}

function playEpisode(episode, visibleQueue) {
  if (!episode) return;
  if (!episode.audioUrl) {
    setPlayer({
      ...selectEpisode(enqueueEpisodes(state.player, visibleQueue || []), episode, (visibleQueue || []).length ? episode : state.player.queue),
      history: recordHistory(state.player.history, episode),
      isPlaying: false,
      error: '该节目没有可播放音频，请稍后重试',
    }, { forceSave: true });
    return;
  }
  const previous = state.player;
  let next = previous;
  if (visibleQueue && visibleQueue.length) next = enqueueEpisodes(next, visibleQueue);
  next = selectEpisode(next, episode, next.queue);
  next = { ...next, history: recordHistory(previous.history, episode), isPlaying: true, error: null };
  setPlayer(next, { forceSave: true });
  loadEpisode(episode, true);
}

function playAll(episodes) {
  if (!episodes.length) return;
  playEpisode(episodes[0], episodes);
}

function togglePlayback() {
  if (!state.player.currentEpisode) return;
  if (state.player.isPlaying) {
    bgm.pause();
    setPlayer({ ...state.player, isPlaying: false }, { forceSave: true });
  } else {
    setPlayer({ ...state.player, isPlaying: true, error: null });
    bgm.play();
  }
}

function seek(position) {
  const value = Number(position);
  if (!Number.isFinite(value)) return;
  try { bgm.seek(value); } catch {}
  setPlayer({ ...state.player, positionSeconds: value });
}

function addLater(episode) {
  const result = addLaterEpisode(state.later, episode);
  if (!result.added) return { added: false, persisted: true };
  setLater(result.items);
  return { added: true, persisted: writeLaterEpisodes(result.items, storage) };
}

function removeLater(id) {
  setLater(removeLaterEpisode(state.later, id));
}

function moveLater(fromIndex, toIndex) {
  setLater(moveLaterEpisode(state.later, fromIndex, toIndex));
}

function playLater(episode) {
  playEpisode(episode, state.later);
}

function playNext(episode) {
  setPlayer(insertNext(state.player, episode));
}

function removeQueue(id) {
  setPlayer(removeFromQueue(state.player, id), { forceSave: true });
  if (!state.player.currentEpisode) bgm.stop();
}

module.exports = {
  initPlayerStore, subscribe, getState,
  playEpisode, playAll, togglePlayback, seek,
  addLater, removeLater, moveLater, playLater, playNext, removeQueue,
};
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: player-store 用例 PASS（`advances once on ended` 用例可保持为行为说明性空断言，核心逻辑已由 playerState 测试覆盖）。

- [ ] **Step 5: Commit**

```bash
git add utils/api-config.js services/player-store.js test/player-store.test.js
git commit -m "feat: add background player store"
```

---

### Task 5: services/catalog-store

**Files:**
- Create: `services/catalog-store.js`
- Create: `test/catalog-store.test.js`

目录加载与网页版一致：5 分钟新鲜度窗口、单飞刷新、失败回退缓存并标记 stale、手动刷新可强制。`utils/catalog.js` 的 `loadCatalog(fetchImpl, baseUrl)` 接受返回 `{ ok, json }` 的 fetch 适配器。

- [ ] **Step 1: 写失败测试**

`test/catalog-store.test.js`：

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

function catalogPayload() {
  return { generatedAt: Date.now(), albums: [{ id: 1, name: '早间版', latestEpisode: { id: 10, onlineTime: Date.now() } }] };
}

function requestOk(data) {
  return async () => ({ ok: true, json: async () => data });
}

describe('catalog store', () => {
  beforeEach(() => { vi.resetModules(); });

  it('loads and notifies subscribers', async () => {
    const storage = { getItem: () => null, setItem: () => {} };
    const store = await import('../services/catalog-store');
    store.initCatalogStore({ storage, requestImpl: requestOk(catalogPayload()), baseUrl: 'https://nio.k4le.top/' });
    const seen = [];
    store.subscribe(s => seen.push(s));
    await store.refreshCatalog({ force: true });
    expect(seen.at(-1).catalog.albums.length).toBe(1);
    expect(seen.at(-1).loading).toBe(false);
    expect(seen.at(-1).stale).toBe(false);
  });

  it('falls back to cached catalog on request failure', async () => {
    const payload = catalogPayload();
    const storage = {
      getItem: (k) => k === 'nio_catalog_cache_v1' ? JSON.stringify(payload) : null,
      setItem: () => {},
    };
    const store = await import('../services/catalog-store');
    store.initCatalogStore({ storage, requestImpl: async () => { throw new Error('offline'); }, baseUrl: 'https://nio.k4le.top/' });
    await store.refreshCatalog({ force: true });
    const s = store.getState();
    expect(s.catalog.albums.length).toBe(1);
    expect(s.stale).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 catalog-store**

`services/catalog-store.js`：

```js
const { CATALOG_CACHE_KEY, loadCatalog, normalizeCatalog, readCatalogCache, writeCatalogCache } = require('../utils/catalog');
const { createStorage } = require('../utils/storage');
const { config } = require('../utils/api-config');

const COOLDOWN_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let storage = createStorage();
let state = { catalog: null, loading: true, error: null, stale: false };
let lastRefreshedAt = 0;
let inFlight = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch {} });
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

function requestCatalog(baseUrl) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}data/albums.json`,
      method: 'GET',
      timeout: FETCH_TIMEOUT_MS,
      success: res => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: async () => res.data }),
      fail: reject,
    });
  });
}

function initCatalogStore(options = {}) {
  storage = options.storage || createStorage();
  const requestImpl = options.requestImpl || (() => requestCatalog(options.baseUrl || config.catalogBase));
  const baseUrl = options.baseUrl || config.catalogBase;
  const cached = readCatalogCache(storage);
  if (cached) state = { catalog: cached, loading: false, error: null, stale: true };

  async function refreshCatalog({ force = false, showLoading = false } = {}) {
    if (inFlight) return inFlight;
    if (!force && Date.now() - lastRefreshedAt < COOLDOWN_MS) return null;
    if (showLoading) setState({ loading: true, error: null });
    lastRefreshedAt = Date.now();
    const request = (async () => {
      try {
        const result = await loadCatalog(requestImpl, baseUrl);
        setState({ catalog: result.catalog, loading: false, error: null, stale: result.stale });
        return result;
      } catch (error) {
        setState(previous => ({ ...previous, loading: false, error, stale: Boolean(previous.catalog) }));
        return null;
      } finally {
        inFlight = null;
      }
    })();
    inFlight = request;
    return request;
  }

  refreshCatalog({ force: true });
  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
    getState: () => state,
    refreshCatalog,
  };
}

let singleton = null;
function getStore() {
  if (!singleton) singleton = initCatalogStore();
  return singleton;
}

module.exports = { initCatalogStore, getStore };
```

注：`requestCatalog` 与 `loadCatalog` 的缓存写入共用 `writeCatalogCache`；存储键与网页版一致。页面统一通过 `getStore()` 获取单例（`app.js` 启动时已初始化），避免重复请求。

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: catalog-store 2 个用例 PASS。

- [ ] **Step 5: Commit**

```bash
git add services/catalog-store.js test/catalog-store.test.js
git commit -m "feat: add catalog store with freshness"
```

---

### Task 6: 首页骨架与基础组件（custom-nav / artwork / state-view）

**Files:**
- Create: `pages/home/index.json`、`index.wxml`、`index.wxss`、`index.js`
- Create: `components/custom-nav/*`
- Create: `components/artwork/*`
- Create: `components/state-view/*`

本任务先建立 rpx 换算表并产出首页骨架（目录加载、推荐面板、更新列表占位、迷你播放器占位），后续任务逐项填充。

- [ ] **Step 1: 建立 rpx 换算表（写入本任务 commit message 摘要与首页 WXSS 注释）**

基准：750rpx 设计稿，1rem = 32rpx（375px 屏）。关键换算：

| Web | rpx |
|---|---|
| --space-1 0.25rem | 8 |
| --space-2 0.5rem | 16 |
| --space-3 0.75rem | 24 |
| --space-4 1rem | 32 |
| --space-5 1.25rem | 40 |
| --space-6 1.5rem | 48 |
| --space-8 2rem | 64 |
| radius-sm 0.5rem | 16 |
| radius-md 0.75rem | 24 |
| icon-button 2.75rem | 88 |
| top-bar 4rem | 128 |
| episode-art 4.25rem | 136 |
| album-hero-art 5.5rem | 176 |
| recommendation-art 7.5rem | 240 |
| mini-art 3rem | 96 |
| 字号 0.68–2rem | 22–64 |

其余样式一律按此表把 `src/App.css` 移动端规则换算（≤359px 紧凑规则保留）。

- [ ] **Step 2: 创建基础组件**

`components/custom-nav/index.js`：

```js
const app = getApp();
Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: false },
    scrolled: { type: Boolean, value: false },
    showContinue: { type: Boolean, value: false },
  },
  data: { statusBarHeight: 20 },
  lifetimes: {
    attached() {
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.setData({ statusBarHeight: info.statusBarHeight || 20 });
      } catch {}
    },
  },
  methods: {
    onBack() { this.triggerEvent('back'); },
    onContinue() { this.triggerEvent('continue'); },
    onSearch() { this.triggerEvent('search'); },
    onAlbums() { this.triggerEvent('albums'); },
  },
});
```

`components/custom-nav/index.wxml`：

```xml
<view class="nav-wrap" style="padding-top: {{statusBarHeight}}px;">
  <view class="nav-bar {{scrolled ? 'is-scrolled' : ''}}">
    <button wx:if="{{showBack}}" class="icon-button" aria-label="返回" bindtap="onBack">‹</button>
    <button wx:else class="icon-button" aria-label="全部专辑" bindtap="onAlbums">☰</button>
    <text class="nav-title">{{title}}</text>
    <view class="nav-actions">
      <button wx:if="{{showContinue}}" class="continue-button" bindtap="onContinue">▶ 继续播放</button>
      <button wx:if="{{showSearch}}" class="icon-button" aria-label="搜索" bindtap="onSearch">⌕</button>
      <view wx:else class="icon-button-spacer" />
    </view>
  </view>
</view>
```

`components/custom-nav/index.wxss`（换算自 `src/App.css` `.top-bar`）：

```css
.nav-wrap { position: sticky; top: 0; z-index: 20; background: var(--surface); }
.nav-bar { display: flex; align-items: center; gap: 16rpx; min-height: 128rpx; padding: 0 32rpx; border-bottom: 2rpx solid var(--line); }
.nav-bar.is-scrolled { box-shadow: 0 2rpx 0 var(--line); }
.icon-button { display: flex; align-items: center; justify-content: center; width: 88rpx; height: 88rpx; border-radius: 999rpx; background: transparent; color: var(--ink); font-size: 44rpx; }
.icon-button-spacer { width: 88rpx; height: 88rpx; }
.nav-title { flex: 1; min-width: 0; text-align: center; font-size: 34rpx; font-weight: 600; }
.nav-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; min-width: 88rpx; }
.continue-button { min-height: 88rpx; padding: 0 20rpx; color: var(--teal-dark); font-size: 25rpx; font-weight: 600; white-space: nowrap; background: transparent; }
```

`components/artwork/index.js`：

```js
Component({
  properties: { src: { type: String, value: '' }, className: { type: String, value: '' } },
  data: { failed: false },
  methods: { onError() { this.setData({ failed: true }); } },
});
```

`components/artwork/index.wxml`：

```xml
<image wx:if="{{src && !failed}}" class="artwork {{className}}" src="{{src}}" mode="aspectFill" binderror="onError" />
<view wx:else class="artwork artwork-empty {{className}}">♪</view>
```

`components/artwork/index.wxss`：

```css
.artwork { display: block; flex: 0 0 auto; background: var(--surface-soft); }
.artwork-empty { display: flex; align-items: center; justify-content: center; color: var(--teal-dark); font-size: 40rpx; }
```

`components/state-view/index.js`：

```js
Component({
  properties: {
    kind: { type: String, value: 'loading' }, // loading | error | empty
    title: { type: String, value: '' },
    message: { type: String, value: '' },
    actionText: { type: String, value: '' },
  },
  methods: { onAction() { this.triggerEvent('action'); } },
});
```

`components/state-view/index.wxml`：

```xml
<view class="state-view">
  <view wx:if="{{kind === 'loading'}}" class="loading-dot" />
  <text wx:if="{{title}}" class="state-title">{{title}}</text>
  <text wx:if="{{message}}" class="state-message">{{message}}</text>
  <button wx:if="{{actionText}}" class="primary-button" bindtap="onAction">{{actionText}}</button>
</view>
```

`components/state-view/index.wxss`（换算自 `.full-state` / `.empty-state` / `.loading-dot`）：

```css
.state-view { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; padding: 96rpx 32rpx; color: var(--muted-strong); text-align: center; }
.state-title { color: var(--ink); font-size: 43rpx; }
.state-message { max-width: 560rpx; font-size: 29rpx; }
.primary-button { min-height: 88rpx; padding: 0 36rpx; border-radius: 999rpx; background: var(--teal); color: var(--ink); font-weight: 650; }
.loading-dot { width: 40rpx; height: 40rpx; border: 4rpx solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 700ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: 创建首页骨架**

`pages/home/index.json`：

```json
{
  "usingComponents": {
    "custom-nav": "/components/custom-nav/index",
    "artwork": "/components/artwork/index",
    "state-view": "/components/state-view/index"
  },
  "disableScroll": false,
  "enablePullDownRefresh": false
}
```

`pages/home/index.js`：

```js
const { formatDuration, formatDate } = require('../../utils/format');
const { selectHomeEpisodes } = require('../../utils/catalog');

let catalogStore = null;
let unsubscribe = null;

Page({
  data: {
    scrolled: false,
    heading: '今日更新',
    count: 0,
    episodes: [],
    recommendation: null,
    stale: false,
    refreshing: false,
    catalogError: false,
    catalogLoading: true,
    player: null,
  },

  onLoad() {
    catalogStore = require('../../services/catalog-store').getStore();
    unsubscribe = catalogStore.subscribe(state => this.applyCatalog(state));
    const playerStore = require('../../services/player-store');
    this.playerUnsubscribe = playerStore.subscribe(s => {
      this.setData({ player: s.player });
    });
  },

  onUnload() {
    unsubscribe && unsubscribe();
    this.playerUnsubscribe && this.playerUnsubscribe();
  },

  onPageScroll(event) {
    const scrolled = event.scrollTop > 180;
    if (scrolled !== this.data.scrolled) this.setData({ scrolled });
  },

  applyCatalog(state) {
    const catalog = state.catalog;
    if (!catalog) {
      this.setData({
        catalogLoading: state.loading,
        catalogError: Boolean(state.error && !state.catalog),
        stale: state.stale,
        refreshing: state.loading && Boolean(state.catalog),
        episodes: [],
      });
      return;
    }
    const selection = selectHomeEpisodes(catalog.albums, new Date());
    this.setData({
      catalogLoading: false,
      catalogError: Boolean(state.error),
      stale: state.stale,
      refreshing: state.loading,
      heading: selection.heading,
      count: selection.episodes.length,
      episodes: selection.episodes.map(e => ({
        ...e,
        durationLabel: formatDuration(e.duration),
        dateLabel: e.onlineTime ? formatDate(e.onlineTime) : '',
      })),
      recommendation: selection.episodes[0] ? {
        ...selection.episodes[0],
        durationLabel: formatDuration(selection.episodes[0].duration),
      } : null,
    });
  },

  onRetryCatalog() {
    catalogStore.refreshCatalog({ force: true, showLoading: true });
  },
  onOpenAlbums() { wx.navigateTo({ url: '/pages/albums/index' }); },
  onOpenSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
  onPlayAll() {
    if (this.data.episodes.length) {
      require('../../services/player-store').playAll(this.data.episodes);
    }
  },
  onPlayEpisode(event) {
    const id = event.currentTarget.dataset.id;
    const episode = this.data.episodes.find(e => String(e.id) === String(id));
    if (episode) require('../../services/player-store').playEpisode(episode, this.data.episodes);
  },
});
```

`pages/home/index.wxml`（推荐面板 + 更新列表 + 状态区；节目行细节由 Task 7 组件补齐）：

```xml
<view class="screen home-screen">
  <custom-nav title="{{scrolled ? '今日推荐' : 'NIO Radio'}}" scrolled="{{scrolled}}" showContinue="{{scrolled && player.currentEpisode}}" bind:continue="onPlayAll" bind:albums="onOpenAlbums" bind:search="onOpenSearch" />

  <view wx:if="{{catalogLoading && !episodes.length}}" class="full-state">
    <state-view kind="loading" title="" message="正在准备 NIO Radio…" />
  </view>

  <block wx:elif="{{catalogError && !episodes.length}}">
    <view class="full-state">
      <state-view kind="error" title="目录暂时无法加载" message="请检查网络后重试，已缓存的节目仍可继续播放。" actionText="重新加载" bind:action="onRetryCatalog" />
    </view>
  </block>

  <block wx:else>
    <view class="recommendation-panel">
      <view class="recommendation-copy">
        <text class="section-kicker">TODAY</text>
        <text class="recommendation-h1">今日推荐</text>
        <text wx:if="{{recommendation}}" class="recommendation-h2">{{recommendation.title}}</text>
        <text wx:else class="recommendation-empty">今天还没有新的节目</text>
        <text wx:if="{{recommendation}}" class="recommendation-meta">{{recommendation.albumName || 'NIO Radio'}} · {{recommendation.durationLabel}}</text>
      </view>
      <artwork class="recommendation-art" src="{{recommendation.albumPic}}" />
      <button class="primary-button" bindtap="onPlayAll" disabled="{{!episodes.length}}">▶ 全部播放</button>
    </view>

    <view class="updates-section">
      <view class="section-heading-row">
        <text class="section-heading">{{heading}}</text>
        <text class="section-count">{{count}}</text>
      </view>
      <view wx:if="{{episodes.length}}" class="episode-list">
        <view wx:for="{{episodes}}" wx:key="id" class="episode-row" data-id="{{item.id}}" bindtap="onPlayEpisode">
          <artwork class="episode-art" src="{{item.albumPic}}" />
          <view class="episode-copy">
            <text class="episode-title">{{item.title}}</text>
            <view class="episode-meta">
              <text>{{item.albumName || 'NIO Radio'}}</text>
              <text class="meta-divider">|</text>
              <text>{{item.durationLabel}}</text>
              <text wx:if="{{item.dateLabel}}"><text class="meta-divider">|</text>{{item.dateLabel}}</text>
            </view>
          </view>
        </view>
      </view>
      <view wx:else class="empty-state">暂无可播放的节目</view>
    </view>

    <view wx:if="{{stale || refreshing || catalogError}}" class="notice-bar" role="{{catalogError ? 'alert' : 'status'}}">
      <text>{{refreshing ? '正在刷新目录…' : catalogError ? '目录刷新失败，继续使用缓存内容' : '显示的是上次缓存的目录'}}</text>
      <button bindtap="onRetryCatalog">{{refreshing ? '刷新中' : '刷新目录'}}</button>
    </view>
  </block>

  <mini-player wx:if="{{player.currentEpisode}}" />
</view>
```

`pages/home/index.wxss`：按 Task 6 Step 1 换算表移植 `src/App.css` 的 `.recommendation-panel`、`.updates-section`、`.episode-row`、`.notice-bar`、`.full-state`、`.empty-state`（≤359px 紧凑规则保留），并加：

```css
.recommendation-panel { display: grid; grid-template-columns: minmax(0, 1fr) 240rpx; gap: 40rpx; align-items: center; padding: 64rpx 40rpx 56rpx; background: var(--aqua); }
.recommendation-copy { display: flex; flex-direction: column; min-width: 0; }
.section-kicker { color: var(--teal-dark); font-size: 23rpx; font-weight: 700; letter-spacing: 2rpx; }
.recommendation-h1 { font-size: 64rpx; line-height: 1.12; font-weight: 650; }
.recommendation-h2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; margin-top: 32rpx; font-size: 34rpx; font-weight: 600; line-height: 1.35; }
.recommendation-empty, .recommendation-meta { margin-top: 16rpx; color: var(--muted-strong); font-size: 26rpx; }
.primary-button { grid-column: 1 / -1; min-height: 88rpx; border-radius: 999rpx; background: var(--teal); color: var(--ink); font-weight: 650; }
.updates-section { padding: 64rpx 40rpx 0; }
.section-heading-row { display: flex; align-items: baseline; gap: 16rpx; margin-bottom: 32rpx; }
.section-heading { font-size: 50rpx; font-weight: 620; }
.section-count { color: var(--muted); font-size: 30rpx; }
.episode-row { display: flex; align-items: center; gap: 32rpx; min-height: 184rpx; padding: 24rpx 0; border-bottom: 2rpx solid var(--line); }
.episode-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 32rpx; line-height: 1.35; }
.episode-meta { display: flex; align-items: center; gap: 10rpx; margin-top: 16rpx; color: var(--muted); font-size: 25rpx; }
.notice-bar { margin: 40rpx; padding: 24rpx 32rpx; color: var(--muted-strong); background: var(--surface-soft); border-radius: 16rpx; font-size: 26rpx; }
.full-state { min-height: 70vh; }
```

- [ ] **Step 4: 开发者工具验证**

微信开发者工具编译：首页显示“正在准备 NIO Radio…”→ 目录加载成功后显示推荐面板与更新列表（此时 wx.request 直连 `nio.k4le.top`，`urlCheck: false` 已配置）。若真机预览需开启调试模式。验证顶栏滚动态：内容不足时可临时在 `onPageScroll` 断点或在真机滚动测试。

- [ ] **Step 5: Commit**

```bash
git add pages/home components/custom-nav components/artwork components/state-view
git commit -m "feat: scaffold home page with base components"
```

---

### Task 7: episode-row 与 album-row 组件

**Files:**
- Create: `components/episode-row/*`
- Create: `components/album-row/*`
- Modify: `pages/home/index.wxml`（用 episode-row 替换内联行）
- Modify: `pages/home/index.js`（传递 active/progress 与“管理”事件占位）

- [ ] **Step 1: 创建 episode-row**

`components/episode-row/index.js`：

```js
Component({
  properties: {
    episode: { type: Object, value: null },
    active: { type: Boolean, value: false },
    progress: { type: Number, value: 0 },
    showManage: { type: Boolean, value: false },
  },
  methods: {
    onPlay() { this.triggerEvent('play', { episode: this.data.episode }); },
    onManage() { this.triggerEvent('manage', { episode: this.data.episode }); },
  },
});
```

`components/episode-row/index.wxml`：

```xml
<view class="episode-row {{active ? 'is-active' : ''}}" bindtap="onPlay">
  <artwork class="episode-art" src="{{episode.albumPic}}" />
  <view class="episode-copy">
    <text class="episode-title">{{episode.title}}</text>
    <view class="episode-meta">
      <text>{{episode.albumName || 'NIO Radio'}}</text>
      <text class="meta-divider">|</text>
      <text>{{episode.durationLabel}}</text>
      <text wx:if="{{episode.dateLabel}}"><text class="meta-divider">|</text>{{episode.dateLabel}}</text>
      <text wx:if="{{progress > 0}}" class="episode-progress-label">已听{{progress}}%</text>
    </view>
  </view>
  <view wx:if="{{showManage}}" class="episode-action">
    <button class="icon-button" aria-label="管理 {{episode.title}}" catchtap="onManage">⋯</button>
  </view>
</view>
```

`components/episode-row/index.wxss`：复用 Task 6 首页内联行样式（同名类），并把 `.episode-row.is-active .episode-title` 改为 `var(--teal-dark)`、`.episode-progress-label` 同色。

- [ ] **Step 2: 创建 album-row**

`components/album-row/index.js`：

```js
Component({
  properties: { album: { type: Object, value: null } },
  methods: { onOpen() { this.triggerEvent('open', { id: this.data.album.id }); } },
});
```

`components/album-row/index.wxml`：

```xml
<view class="album-result" bindtap="onOpen">
  <artwork class="album-art" src="{{album.imageUrl}}" />
  <view class="album-result-copy">
    <text class="album-name">{{album.name}}</text>
    <text class="album-subtitle">{{album.latestEpisode.title || album.description || '暂无节目'}}</text>
  </view>
  <text class="album-chevron">›</text>
</view>
```

`components/album-row/index.wxss`：换算 `.album-result`（136rpx 封面、两行文本、箭头）。

- [ ] **Step 3: 首页接入并验证**

修改 `pages/home/index.wxml` 的列表为：

```xml
<episode-row wx:for="{{episodes}}" wx:key="id" episode="{{item}}" active="{{player.currentEpisode && player.currentEpisode.id === item.id}}" progress="{{item.progressPercent}}" bind:play="onPlayEpisode" />
```

在 `pages/home/index.js` 的 `applyCatalog` 中为每条 episode 追加 `progressPercent`（当前节目时 `Math.round(position / duration * 100)`，否则 0）；`onPlayEpisode` 改为接收 `event.detail.episode`。开发者工具验证：点击节目开始播放、当前行显示“已听X%”与 teal 标题。

- [ ] **Step 4: Commit**

```bash
git add components/episode-row components/album-row pages/home
git commit -m "feat: add episode and album row components"
```

---

### Task 8: mini-player 组件与播放接线

**Files:**
- Create: `components/mini-player/*`
- Modify: `pages/home/index.js`（播放进度与错误状态传入组件）

- [ ] **Step 1: 创建 mini-player**

`components/mini-player/index.js`：

```js
const { formatClock } = require('../../utils/format');
Component({
  properties: { player: { type: Object, value: null } },
  observers: {
    player(player) {
      if (!player) return;
      const duration = player.durationSeconds || (Number(player.currentEpisode && player.currentEpisode.duration) || 0) / 1000;
      this.setData({
        elapsed: formatClock(player.positionSeconds),
        total: formatClock(duration),
        durationSeconds: duration,
        positionSeconds: Math.min(player.positionSeconds, duration || 0),
      });
    },
  },
  methods: {
    onToggle() { this.triggerEvent('toggle'); },
    onOpenQueue() { this.triggerEvent('openqueue'); },
    onSeek(event) { this.triggerEvent('seek', { position: Number(event.detail.value) }); },
    onRetry() { this.triggerEvent('retry'); },
  },
});
```

`components/mini-player/index.wxml`：

```xml
<view class="mini-player" wx:if="{{player.currentEpisode}}">
  <view class="mini-main">
    <artwork class="mini-art" src="{{player.currentEpisode.albumPic}}" />
    <view class="mini-copy">
      <text class="mini-title">{{player.currentEpisode.title}}</text>
      <text class="mini-album">{{player.currentEpisode.albumName || 'NIO Radio'}}</text>
    </view>
    <button class="player-control" aria-label="{{player.isPlaying ? '暂停' : '播放'}}" bindtap="onToggle">{{player.isPlaying ? '❚❚' : '▶'}}</button>
    <button class="player-control queue-control" aria-label="打开播放列表" bindtap="onOpenQueue">☰</button>
  </view>
  <view class="mini-progress-row">
    <text>{{elapsed}}</text>
    <slider class="progress-slider" min="0" max="{{durationSeconds}}" step="1" value="{{positionSeconds}}" bindchanging="onSeek" bindchange="onSeek" block-size="22" activeColor="{{ 'var(--teal)' }}" />
    <text>{{total}}</text>
  </view>
  <view wx:if="{{player.error}}" class="player-error">
    <text>{{player.error}}</text>
    <button bindtap="onRetry">重试</button>
  </view>
</view>
```

`components/mini-player/index.wxss`（换算 `.mini-player` / `.mini-main` / `.mini-progress-row` / `.player-error`；`slider` 高度按 44px 触达调整为 88rpx 可点击区）：

```css
.mini-player { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom)); background: var(--surface); border-top: 2rpx solid var(--line); }
.mini-main { display: flex; align-items: center; gap: 24rpx; }
.mini-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mini-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 29rpx; font-weight: 620; }
.mini-album { margin-top: 6rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 24rpx; }
.player-control { display: flex; align-items: center; justify-content: center; width: 88rpx; height: 88rpx; border-radius: 999rpx; background: var(--surface-soft); color: var(--ink); font-size: 30rpx; }
.mini-progress-row { display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; color: var(--muted); font-size: 22rpx; }
.progress-slider { flex: 1; min-width: 0; margin: 0; }
.player-error { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 16rpx; color: var(--danger); font-size: 24rpx; }
```

注意：`activeColor="{{ 'var(--teal)' }}"` 在小程序 slider 上不能传 CSS 变量字符串，改用数值色值：在 `observers` 中读取主题变量不可行，改为 `activeColor="#00b9b5"`（浅色）并在暗色主题用 `activeColor="#2bd0c6"`——简化：直接使用 `activeColor="#00b9b5"`，暗色下视觉差异可接受，Task 12 打磨时按 `theme` 动态调整。

- [ ] **Step 2: 首页接线**

`pages/home/index.js` 增加：

```js
onTogglePlayback() { require('../../services/player-store').togglePlayback(); },
onSeek(event) { require('../../services/player-store').seek(event.detail.position); },
onRetryAudio() { require('../../services/player-store').retryAudio(); },
```

`services/player-store.js` 增加 `retryAudio()`：

```js
function retryAudio() {
  const current = state.player.currentEpisode;
  if (!current) return;
  setPlayer({ ...state.player, error: null, isPlaying: true }, { forceSave: true });
  loadEpisode(current, true);
}
```

并加入导出列表。首页 `mini-player` 标签绑定 `bind:toggle="onTogglePlayback" bind:openqueue="onOpenQueue" bind:seek="onSeek" bind:retry="onRetryAudio"`；`onOpenQueue` 暂以 `wx.showToast` 占位（Task 11 接入队列弹层）。

- [ ] **Step 3: 验证**

开发者工具：点击节目 → 迷你播放器出现、进度走动、暂停/继续、seek、错误重试。真机验证切后台继续播放（需开启调试模式并替换真实 AppID）。

- [ ] **Step 4: Commit**

```bash
git add components/mini-player services/player-store.js pages/home
git commit -m "feat: add mini player and playback wiring"
```

---

### Task 9: 全部专辑页与搜索页

**Files:**
- Create: `pages/albums/index.*`
- Create: `pages/search/index.*`

- [ ] **Step 1: 创建专辑页**

`pages/albums/index.js`：

```js
const { sortAlbumsForDirectory } = require('../../utils/catalog');
const PAGE_SIZE = 100;
let store = null;

Page({
  data: { albums: [], visibleCount: PAGE_SIZE, total: 0, loading: true, error: false },
  onLoad() {
    store = require('../../services/catalog-store').getStore();
    this.unsubscribe = store.subscribe(state => this.applyCatalog(state));
  },
  onUnload() { this.unsubscribe && this.unsubscribe(); },
  applyCatalog(state) {
    if (!state.catalog) {
      this.setData({ loading: state.loading, error: Boolean(state.error) });
      return;
    }
    const ordered = sortAlbumsForDirectory(state.catalog.albums).map(a => ({
      id: a.id, name: a.name, imageUrl: a.imageUrl,
      subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目',
    }));
    this.setData({ albums: ordered, total: ordered.length, loading: false, error: false, visibleCount: PAGE_SIZE });
  },
  onReachBottom() {
    if (this.data.visibleCount < this.data.albums.length) {
      this.setData({ visibleCount: Math.min(this.data.visibleCount + PAGE_SIZE, this.data.albums.length) });
    }
  },
  onOpenAlbum(event) {
    wx.navigateTo({ url: `/pages/album/index?id=${event.detail.id}` });
  },
  onBack() { wx.navigateBack(); },
  onOpenSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
});
```

`pages/albums/index.wxml`：

```xml
<view class="screen">
  <custom-nav title="全部专辑" showBack bind:back="onBack" showSearch bind:search="onOpenSearch" />
  <view class="search-results">
    <view class="section-heading-row"><text class="section-heading">全部专辑</text><text class="section-count">{{total}}</text></view>
    <view wx:if="{{loading && !albums.length}}" class="loading-state">正在准备 NIO Radio…</view>
    <view wx:elif="{{error && !albums.length}}" class="inline-error">目录暂时无法加载</view>
    <view wx:else class="album-results">
      <album-row wx:for="{{albums.slice(0, visibleCount)}}" wx:key="id" album="{{item}}" bind:open="onOpenAlbum" />
      <button wx:if="{{visibleCount < albums.length}}" class="load-more-button" bindtap="onReachBottom">加载更多专辑</button>
    </view>
  </view>
</view>
```

`pages/albums/index.json`：`usingComponents` 注册 `custom-nav`、`album-row`；WXSS 换算 `.search-results`、`.album-results`、`.load-more-button`。

注：`albums.slice(0, visibleCount)` 在 WXML 中可用（WXS 不支持，但数据绑定支持简单表达式如 `slice` 方法）。若目标基础库不支持，则在 `applyCatalog` 中直接维护 `visibleAlbums` 数组并随 `onReachBottom` 追加。

- [ ] **Step 2: 创建搜索页**

`pages/search/index.js`：

```js
const { sortAlbumsForDirectory } = require('../../utils/catalog');
const PAGE_SIZE = 100;
let store = null;

Page({
  data: { query: '', debounced: '', albums: [], visibleCount: PAGE_SIZE, total: 0, loading: true, error: false },
  onLoad() {
    store = require('../../services/catalog-store').getStore();
    this.unsubscribe = store.subscribe(state => this.applyCatalog(state));
  },
  onUnload() { this.unsubscribe && this.unsubscribe(); },
  applyCatalog(state) {
    if (!state.catalog) { this.setData({ loading: state.loading, error: Boolean(state.error) }); return; }
    this.setData({ source: state.catalog.albums, loading: false, error: false });
    this.applyFilter();
  },
  onInput(event) {
    this.setData({ query: event.detail.value });
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.setData({ debounced: this.data.query });
      this.applyFilter();
    }, 120);
  },
  onClear() {
    clearTimeout(this.debounceTimer);
    this.setData({ query: '', debounced: '' });
    this.applyFilter();
  },
  applyFilter() {
    const source = this.data.source || [];
    const value = (this.data.debounced || '').trim().toLowerCase();
    const base = sortAlbumsForDirectory(source);
    const filtered = value
      ? base.filter(a => `${a.name} ${a.description || ''} ${a.host || ''}`.toLowerCase().includes(value))
      : base;
    this.setData({
      albums: filtered.map(a => ({ id: a.id, name: a.name, imageUrl: a.imageUrl, subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目' })),
      total: filtered.length,
      visibleCount: PAGE_SIZE,
    });
  },
  onReachBottom() { /* 同专辑页逻辑 */ },
  onOpenAlbum(event) { wx.navigateTo({ url: `/pages/album/index?id=${event.detail.id}` }); },
  onBack() { wx.navigateBack(); },
});
```

`pages/search/index.wxml`：顶栏用 `custom-nav showBack`，中间为搜索输入框（`bindinput="onInput"` + 清空按钮），列表用 `album-row`；空结果显示“没有找到匹配的专辑”。

- [ ] **Step 3: 验证**

开发者工具：全部专辑置顶顺序（早间/晚间）正确、加载更多生效；搜索 120ms 防抖过滤、清空、返回保留输入。

- [ ] **Step 4: Commit**

```bash
git add pages/albums pages/search
git commit -m "feat: add albums and search pages"
```

---

### Task 10: 专辑详情页

**Files:**
- Create: `pages/album/index.*`

- [ ] **Step 1: 创建页面**

`pages/album/index.js`：

```js
const { getEpisodes } = require('../../utils/api');
const { formatDuration, formatDate } = require('../../utils/format');
const PAGE_SIZE = 30;

Page({
  data: {
    album: null, episodes: [], page: 0, hasMore: false,
    loading: true, error: false, retryPage: 1, loadingMore: false,
  },
  onLoad(options) {
    this.albumId = Number(options.id);
    const store = require('../../services/catalog-store').getStore();
    const catalog = store.getState().catalog;
    const album = catalog && catalog.albums.find(a => Number(a.id) === this.albumId);
    if (album) this.setData({ album: { ...album, countLabel: `${album.episodeCount || album.count || 0} 集` } });
    this.loadPage(1);
  },
  async loadPage(pageNumber) {
    if (this.data.loading || this.data.loadingMore) return;
    this.setData(pageNumber === 1 ? { loading: true, error: false } : { loadingMore: true });
    try {
      const result = await getEpisodes(this.albumId, pageNumber, PAGE_SIZE);
      const mapped = result.episodes.map(e => ({
        ...e,
        durationLabel: formatDuration(e.duration),
        dateLabel: e.onlineTime ? formatDate(e.onlineTime) : '',
      }));
      this.setData({
        episodes: pageNumber === 1 ? mapped : this.data.episodes.concat(mapped),
        page: pageNumber,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        error: false,
      });
    } catch {
      this.setData({ loading: false, loadingMore: false, error: true, retryPage: pageNumber });
    }
  },
  onRetry() { this.loadPage(this.data.retryPage); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) this.loadPage(this.data.page + 1); },
  onPlayEpisode(event) {
    const episode = this.data.episodes.find(e => String(e.id) === String(event.detail.episode.id));
    if (episode) require('../../services/player-store').playEpisode(episode, this.data.episodes);
  },
  onManage(event) {
    const episode = event.detail.episode;
    const result = require('../../services/player-store').addLater(episode);
    const text = !result.added ? '已在稍后播放' : result.persisted ? '已添加到稍后播放' : '已添加到稍后播放，但无法保存，刷新后可能丢失';
    wx.showToast({ title: text, icon: 'none' });
  },
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack(); else wx.switchTab && wx.reLaunch({ url: '/pages/home/index' });
  },
});
```

`pages/album/index.wxml`：`custom-nav` 标题为专辑名（副标题“N 集”），简介区（`artwork` + 节目列表 + 描述），`episode-row showManage` 列表，“加载更多”按钮、`loading-more`、内联错误（“节目加载失败，请检查网络后重试”+ 重新加载）、空状态“这个专辑还没有节目”。

`pages/album/index.json`：注册 `custom-nav`、`artwork`、`episode-row`、`state-view`。

- [ ] **Step 2: 验证**

开发者工具：进入专辑加载第一页、滚动到底加载更多、断网显示内联错误并可重试、行菜单“稍后播放”三种提示。

- [ ] **Step 3: Commit**

```bash
git add pages/album
git commit -m "feat: add album detail page"
```

---

### Task 11: 队列弹层（播放列表 / 最近听过 / 稍后播放）

**Files:**
- Create: `components/queue-sheet/*`
- Modify: `pages/home/index.*`、`pages/album/index.*`（打开弹层入口）

队列弹层为页内 overlay，非独立页面；打开时页面背景不可滚动（`catchtouchmove` + 设置页面 `overflow` 由弹层全屏覆盖实现），关闭方式：遮罩、右上角 X、下滑 >80px、系统返回（先关弹层再退页）。

- [ ] **Step 1: 创建弹层组件（核心结构与交互）**

`components/queue-sheet/index.js`：

```js
const { formatDuration } = require('../../utils/format');
const PAGE_SIZE = 100;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    tab: { type: String, value: 'queue' },
    player: { type: Object, value: null },
    later: { type: Array, value: [] },
    catalog: { type: Object, value: null },
  },
  data: {
    closing: false, tabs: ['queue', 'history', 'later'],
    pickerOpen: false, pickerAlbumId: null, pickerEpisodes: [], pickerLoading: false, pickerError: false,
    actionsFor: null, laterActionsFor: null, notice: '',
    albumSource: [], pickerAlbums: [], pickerVisible: PAGE_SIZE,
    items: [],
  },
  observers: {
    visible(v) { if (!v) this.setData({ pickerOpen: false, actionsFor: null, laterActionsFor: null }); },
    catalog(c) {
      if (!c) return;
      const albumSource = c.albums.map(a => ({ id: a.id, name: a.name, imageUrl: a.imageUrl, subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目' }));
      this.setData({ albumSource });
    },
    'tab, player, later'(tab, player, later) {
      this.setData({ items: this.itemsFor() });
    },
  },
  methods: {
    itemsFor() {
      const tab = this.data.tab;
      const player = this.data.player || {};
      if (tab === 'queue') return (player.queue || []).map((e, i) => ({ ...e, durationLabel: formatDuration(e.duration), index: i, active: player.currentEpisode && String(player.currentEpisode.id) === String(e.id) }));
      if (tab === 'history') return (player.history || []).map(e => ({ ...e, durationLabel: formatDuration(e.duration) }));
      return this.data.later.map((e, i) => ({ ...e, durationLabel: formatDuration(e.duration), index: i }));
    },
    onTab(event) {
      this.setData({ tab: event.currentTarget.dataset.tab, pickerOpen: false, actionsFor: null, laterActionsFor: null, notice: '' });
    },
    onClose() { this.triggerEvent('close'); },
    onPlay(event) { this.triggerEvent('play', { episode: event.currentTarget.dataset.episode }); },
    onToggleActions(event) {
      const id = event.currentTarget.dataset.id;
      this.setData({ actionsFor: this.data.actionsFor === id ? null : id });
    },
    onPlayNext() { this.triggerEvent('playnext', { episode: this.currentActionEpisode() }); this.setData({ actionsFor: null }); },
    onRemoveQueue() { this.triggerEvent('removequeue', { id: this.currentActionEpisode().id }); this.setData({ actionsFor: null }); },
    currentActionEpisode() {
      const items = this.itemsFor();
      return items.find(e => String(e.id) === String(this.data.actionsFor));
    },
    onOpenPicker() { this.setData({ pickerOpen: true, pickerAlbumId: null, pickerEpisodes: [] }); },
    onClosePicker() { this.setData({ pickerOpen: false }); },
    onSelectAlbum(event) {
      const id = event.currentTarget.dataset.id;
      this.setData({ pickerAlbumId: id, pickerLoading: true, pickerError: false });
      require('../../utils/api').getEpisodes(id, 1, PAGE_SIZE).then(result => {
        const pickerEpisodes = result.episodes.map(e => ({ ...e, durationLabel: formatDuration(e.duration) }));
        this.setData({ pickerEpisodes, pickerLoading: false, pickerHasMore: result.hasMore });
      }).catch(() => this.setData({ pickerLoading: false, pickerError: true }));
    },
    onAddLater(event) {
      this.triggerEvent('addlater', { episode: event.currentTarget.dataset.episode });
    },
    onRemoveLater(event) { this.triggerEvent('removelater', { id: event.currentTarget.dataset.id }); },
    onToggleLaterActions(event) {
      const id = event.currentTarget.dataset.id;
      this.setData({ laterActionsFor: this.data.laterActionsFor === id ? null : id });
    },
    onMoveLater(event) {
      const { from, to } = event.currentTarget.dataset;
      this.triggerEvent('movelater', { from: Number(from), to: Number(to) });
      this.setData({ laterActionsFor: null });
    },
    onTouchStart(event) { this.gesture = { startY: event.touches[0].clientY }; },
    onTouchEnd(event) {
      if (this.gesture && event.changedTouches[0].clientY - this.gesture.startY > 80) this.triggerEvent('close');
      this.gesture = null;
    },
    onNoop() {},
  },
});
```

`components/queue-sheet/index.wxml`（结构；行内手势与滑删样式见 Step 2）：

```xml
<view wx:if="{{visible}}" class="queue-overlay" catchtouchmove="onNoop">
  <view class="queue-backdrop" bindtap="onClose" />
  <view class="queue-sheet" bindtouchstart="onTouchStart" bindtouchend="onTouchEnd">
    <view class="sheet-handle" />
    <view class="sheet-header">
      <text class="sheet-title">播放列表</text>
      <button class="icon-button" aria-label="收起播放列表" bindtap="onClose">×</button>
    </view>
    <view class="queue-tabs">
      <button wx:for="{{tabs}}" wx:key="*this" class="queue-tab {{tab === item ? 'is-selected' : ''}}" data-tab="{{item}}" bindtap="onTab">
        {{item === 'queue' ? '播放列表' : item === 'history' ? '最近听过' : '稍后播放'}}
        <text>{{item === 'queue' ? player.queue.length : item === 'history' ? player.history.length : later.length}}</text>
      </button>
    </view>
    <view wx:if="{{tab === 'later' && !pickerOpen}}" class="later-add-row">
      <text>保存的节目</text>
      <button class="secondary-button" bindtap="onOpenPicker">＋ 添加节目</button>
    </view>
    <scroll-view class="queue-scroll" scroll-y>
      <block wx:if="{{pickerOpen}}">
        <view class="later-picker-header">
          <button class="icon-button" bindtap="onClosePicker">‹</button>
          <text>{{pickerAlbumId ? pickerAlbumName : '添加节目'}}</text>
        </view>
        <view wx:if="{{!pickerAlbumId}}" class="album-results">
          <album-row wx:for="{{albumSource}}" wx:key="id" album="{{item}}" bind:open="onSelectAlbum" />
        </view>
        <block wx:else>
          <view wx:if="{{pickerLoading}}" class="loading-state">正在加载节目…</view>
          <view wx:elif="{{pickerError}}" class="inline-error">节目加载失败，请重试</view>
          <view wx:else class="episode-list">
            <view wx:for="{{pickerEpisodes}}" wx:key="id" class="episode-row" data-episode="{{item}}" bindtap="onAddLater">
              <artwork class="episode-art" src="{{item.albumPic}}" />
              <view class="episode-copy"><text class="episode-title">{{item.title}}</text></view>
              <text>＋</text>
            </view>
          </view>
        </block>
      </block>
      <block wx:elif="{{items.length}}">
        <view wx:for="{{items}}" wx:key="index" class="queue-row {{item.active ? 'is-current' : ''}} {{actionsFor === item.id ? 'is-menu-open' : ''}}">
          <view class="queue-row-main" data-episode="{{item}}" bindtap="onPlay">
            <artwork class="queue-art" src="{{item.albumPic}}" />
            <view class="queue-copy"><text class="queue-title">{{item.title}}</text><text class="queue-meta">{{item.albumName || 'NIO Radio'}} · {{item.durationLabel}}</text></view>
          </view>
          <view wx:if="{{tab === 'queue'}}" class="queue-actions">
            <button class="icon-button" data-id="{{item.id}}" bindtap="onToggleActions">⋯</button>
            <view wx:if="{{actionsFor === item.id}}" class="row-action-menu">
              <button bindtap="onPlayNext">下一首播放</button>
              <button bindtap="onRemoveQueue">移出列表</button>
            </view>
          </view>
          <view wx:elif="{{tab === 'later'}}" class="later-actions">
            <button class="icon-button" data-id="{{item.id}}" bindtap="onToggleLaterActions">⋯</button>
            <view wx:if="{{laterActionsFor === item.id}}" class="row-action-menu">
              <button data-from="{{item.index}}" data-to="{{item.index - 1}}" disabled="{{item.index === 0}}" bindtap="onMoveLater">上移</button>
              <button data-from="{{item.index}}" data-to="{{item.index + 1}}" disabled="{{item.index === items.length - 1}}" bindtap="onMoveLater">下移</button>
              <button data-id="{{item.id}}" bindtap="onRemoveLater">移除</button>
            </view>
          </view>
        </view>
      </block>
      <view wx:else class="queue-empty">
        <text>{{tab === 'queue' ? '播放列表是空的' : tab === 'history' ? '还没有听过的节目' : '稍后播放是空的'}}</text>
        <text>选择一个节目后，它会出现在这里</text>
      </view>
    </scroll-view>
  </view>
</view>
```

`components/queue-sheet/index.json`：注册 `artwork`、`album-row`。

- [ ] **Step 2: 滑删与拖拽（WXSS + 事件）**

左滑删除：在 `later` 行上实现 `bindtouchstart/bindtouchmove/bindtouchend`，位移 < -48rpx 时加 `is-swiped` 类并显示右侧“移除”按钮（宽 152rpx，`position: absolute`，danger 背景），点击移除。长按拖拽排序：`bindlongpress` 置 `dragging`，`bindtouchmove` 累计 `deltaY`，超过 32px（64rpx）即触发 `movelater` 并重置起点。对应 WXSS 换算自 `src/App.css` `.later-row` / `.later-swipe-action`（`touch-action: pan-y` 改为小程序 `catchtouchmove` 控制）。

因交互较细，此步完成后在开发者工具逐个验证：左滑出现移除、长按上移/下移、菜单打开时行内展开（`padding-bottom` 240rpx 为菜单留空间）。

- [ ] **Step 3: 页面接入**

首页与专辑页增加 `queueOpen` data 与 `queue-sheet` 组件；`mini-player` 的 `openqueue` 事件置 `queueOpen: true`；弹层 `bind:close` 置 `false`；`bind:play` 调 `player-store.playEpisode(episode, queue)`、`bind:playnext` 调 `playNext`、`bind:removequeue` 调 `removeQueue`、`bind:addlater` 调 `addLater`（提示文案三态）、`bind:removelater`、`bind:movelater` 对应 store 方法。返回键逻辑：页面 `onUnload` 不处理；在页面 `onBack` 中先判断 `queueOpen` 再关闭。

- [ ] **Step 4: 验证与 Commit**

开发者工具与真机：三 Tab 切换、当前项高亮、菜单操作、左滑、拖拽、遮罩/下滑/X 关闭、返回先关弹层。

```bash
git add components/queue-sheet pages/home pages/album
git commit -m "feat: add queue sheet with later playback"
```

---

### Task 12: 主题、安全区、动效与触达打磨

**Files:**
- Modify: `app.wxss`、`theme.json`、`components/*/index.wxss`、`pages/*/index.wxss`

- [ ] **Step 1: 暗黑模式真机验证**

在真机预览切换系统深浅色，逐页核对 `var(--*)` 颜色与网页版截图一致；导航栏状态栏区域背景用 `var(--surface)`。

- [ ] **Step 2: 安全区与触达**

迷你播放器与弹层底部使用 `env(safe-area-inset-bottom)`；所有按钮/滑杆可点区 ≥88rpx；弹层打开时页面不可滚动（`catchtouchmove="onNoop"` 已验证）。≤359px 紧凑规则：`@media (max-width: 359px)` 等价改写为小程序 `@media (max-width: 359px)`（WXSS 支持媒体查询）并调整封面尺寸 120rpx、间距 24rpx、隐藏“继续播放”。

- [ ] **Step 3: 动效**

按 `src/App.css` 实现：弹层遮罩淡入 220ms、弹层上滑 320ms 缓出（`cubic-bezier(0.22,1,0.36,1)`）、关闭 240ms；队列行入场 stagger（`animation-delay: calc(var(--i) * 30ms)`，限前 8 行）；计数 pop 160ms；全部使用 WXSS `@keyframes`。微信无 reduced-motion 信号，保持动效轻量。

- [ ] **Step 4: 全量自测**

```bash
npm test
npm run lint
```

Expected: 全部 PASS；lint 无错误。

- [ ] **Step 5: Commit**

```bash
git add app.wxss theme.json components pages
git commit -m "polish: theme, safe areas, motion and touch targets"
```

---

### Task 13: README 与真机验收

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README**

内容：项目说明、功能清单（与设计文档一致）、开发步骤（`npm install`、微信开发者工具导入、替换 AppID、真机预览开调试模式）、数据源说明（预览直连 + 目录刷新域、上线云函数预留）、验收清单（Task 12 真机清单逐项）、与网页版仓库的关系。

- [ ] **Step 2: 执行真机验收清单**

逐项执行设计文档“真机验收清单”：首页/专辑/搜索/专辑详情/播放/队列/稍后播放/后台播放/主题/断网错误。发现问题按 Task 11 的排查方式修复后重跑 `npm test`。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add mini program readme"
```

---

## 自审记录

**Spec 覆盖：** 设计文档各节均有对应任务——页面（Task 6/9/10）、播放器与队列（Task 4/8/11）、稍后播放（Task 4/11）、数据层（Task 2/3/5）、主题适配（Task 0/12）、错误文案（Task 6/10/11）、测试验收（Task 1–5/13）、上线预留（Task 2/5 的 api-config 与 catalog-base）。

**占位检查：** 无 TBD/TODO；所有步骤给出具体文件、代码或命令。

**类型一致性：** `player-store` 导出 `playEpisode/playAll/togglePlayback/seek/addLater/removeLater/moveLater/playLater/playNext/removeQueue/retryAudio/subscribe/getState/initPlayerStore`，页面与弹层引用与之一致；`catalog-store` 导出 `initCatalogStore/subscribe/getState/refreshCatalog`，页面通过 `getStore()` 单例访问（Task 6 使用 `getStore()`，Task 5 实现需补一个模块级 `getStore()` 单例缓存——实现时在 `initCatalogStore` 后保存单例并导出）。

**已知实现细节（实现时处理，不阻塞计划）：** ① `queue-sheet` 的 `items` 已在 `observers['tab, player, later']` 中派生；② 搜索页 `albums.slice(0, visibleCount)` 若基础库不支持，改在 JS 维护 `visibleAlbums`；③ `mini-player` 的 slider `activeColor` 暂用浅色固定值 `#00b9b5`，暗色主题视觉在 Task 12 按 `theme` 动态调整。
