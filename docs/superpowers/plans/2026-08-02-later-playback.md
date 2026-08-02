# 稍后播放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在手机网页端加入持久化的“稍后播放”列表，支持从专辑选择单期节目、去重、移除、排序、连续播放和自然播放完成后自动移除。

**Architecture:** 使用独立的 `src/laterPlayback.js` 管理稍后播放节目的标准化、去重、排序和 `localStorage` 持久化。`App` 持有该列表并将操作回调传给播放列表弹层、专辑详情和添加节目子页面；现有播放器队列保持不变，开始播放时使用稍后播放列表的快照生成队列。

**Tech Stack:** React 19, Vite, Vitest, Testing Library, lucide-react, `localStorage`, GitHub Pages。

---

## 工作区与基线

实现前使用 `superpowers:using-git-worktrees` 创建独立工作树和 `codex/later-playback` 分支。不要在 `main` 上直接编写功能代码。工作树建立后运行：

```bash
cd /path/to/nio-podcast-web
npm test -- --run
npm run lint
```

预期：现有 Vitest 测试和 oxlint 均通过。若基线失败，先记录失败用例和原因，不把与本功能无关的修复混入本分支。

## Task 1: 独立的稍后播放状态模块

**Files:**
- Create: `src/laterPlayback.js`
- Create: `src/laterPlayback.test.js`

- [ ] **Step 1: 写失败的状态测试**

在 `src/laterPlayback.test.js` 添加以下测试数据和用例：

```js
import { describe, expect, it } from 'vitest';
import {
  addLaterEpisode,
  moveLaterEpisode,
  readLaterEpisodes,
  removeLaterEpisode,
  writeLaterEpisodes,
} from './laterPlayback';

const episode = (id, title = `节目 ${id}`) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: 'https://cdn.example/cover.jpg',
  duration: 60000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

describe('later playback state', () => {
  it('appends episodes and rejects duplicates by id', () => {
    const first = addLaterEpisode([], episode(1));
    const duplicate = addLaterEpisode(first.items, episode(1, '更新后的标题'));
    const second = addLaterEpisode(duplicate.items, episode(2));

    expect(first).toEqual({ added: true, items: [episode(1)] });
    expect(duplicate).toEqual({ added: false, items: [episode(1)] });
    expect(second.items.map(item => item.id)).toEqual([1, 2]);
  });

  it('removes an item and moves an item without changing other order', () => {
    const items = [episode(1), episode(2), episode(3)];
    expect(removeLaterEpisode(items, 2).map(item => item.id)).toEqual([1, 3]);
    expect(moveLaterEpisode(items, 2, 0).map(item => item.id)).toEqual([3, 1, 2]);
    expect(moveLaterEpisode(items, -1, 2)).toEqual(items);
  });

  it('persists valid data and treats malformed storage as empty', () => {
    const storage = { value: '', getItem: () => storage.value, setItem: (_key, value) => { storage.value = value; } };
    writeLaterEpisodes([episode(2), episode(1)], storage);
    expect(readLaterEpisodes(storage).map(item => item.id)).toEqual([2, 1]);
    storage.value = '{bad json';
    expect(readLaterEpisodes(storage)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败**

运行：`npx vitest run src/laterPlayback.test.js`

预期：FAIL，提示 `./laterPlayback` 或对应导出不存在。

- [ ] **Step 3: 写最小状态实现**

在 `src/laterPlayback.js` 实现下列固定接口：

```js
export const LATER_PLAYBACK_STORAGE_KEY = 'nio_play_later_v1';

export function addLaterEpisode(items, episode) {
  const normalized = normalizeEpisode(episode);
  if (!normalized || items.some(item => String(item.id) === String(normalized.id))) {
    return { added: false, items };
  }
  return { added: true, items: [...items, normalized] };
}

export function removeLaterEpisode(items, episodeId) {
  return items.filter(item => String(item.id) !== String(episodeId));
}

export function moveLaterEpisode(items, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function readLaterEpisodes(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(LATER_PLAYBACK_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? uniqueEpisodes(parsed) : [];
  } catch {
    return [];
  }
}

export function writeLaterEpisodes(items, storage = globalThis.localStorage) {
  try {
    storage?.setItem(LATER_PLAYBACK_STORAGE_KEY, JSON.stringify(uniqueEpisodes(items)));
    return true;
  } catch {
    return false;
  }
}
```

`normalizeEpisode` 只保留现有播放器使用的节目字段，`uniqueEpisodes` 按 `id` 保留第一次出现的条目；两者为模块内部函数。

- [ ] **Step 4: 运行状态测试确认通过**

运行：`npx vitest run src/laterPlayback.test.js`

预期：4 个断言组 PASS。

- [ ] **Step 5: 提交状态模块**

```bash
git add src/laterPlayback.js src/laterPlayback.test.js
git commit -m "feat: add persisted later playback state"
```

## Task 2: 接入 App 状态和播放完成规则

**Files:**
- Modify: `src/App.jsx`（导入区、`App` 状态、播放回调和 `QueueSheet` props）
- Create: `src/App.later-playback.test.jsx`

- [ ] **Step 1: 写失败的播放器集成测试**

在新测试文件中使用现有 `initialCatalog` 夹具，并把稍后播放数据预置到 `localStorage`。覆盖两个行为：自然播放结束后从列表移除；从稍后播放选择第二期后，当前队列从第二期开始播放并包含后续期。

```jsx
import { within } from '@testing-library/react';

it('removes a later episode after natural playback ends', async () => {
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1), episode(2)]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  const audio = document.querySelector('audio');
  fireEvent.ended(audio);

  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  const dialog = screen.getByRole('dialog', { name: '播放列表' });
  expect(within(dialog).queryByText('第一集')).not.toBeInTheDocument();
  expect(within(dialog).getByText('第二集')).toBeInTheDocument();
});

it('starts later playback at the selected item and keeps following items', async () => {
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1), episode(2), episode(3)]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '播放列表' })).getByRole('button', { name: '第二集' }));

  expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第二集');
});
```

测试中使用与现有测试相同的 `episode` 和 `catalog` 夹具；第二个用例的第三期只需由本文件顶部的 `episode(3)` helper 构造，因为该用例验证的是本地稍后播放列表，不依赖目录接口。

- [ ] **Step 2: 运行集成测试确认失败**

运行：`npx vitest run src/App.later-playback.test.jsx`

预期：FAIL，因为 App 尚未读取 `nio_play_later_v1`，且播放列表没有第三个标签。

- [ ] **Step 3: 接入持久化状态和自然结束处理**

在 `App.jsx` 中：

1. 导入 `addLaterEpisode`、`moveLaterEpisode`、`readLaterEpisodes`、`removeLaterEpisode`、`writeLaterEpisodes`。
2. 用 `useState(readLaterEpisodes)` 初始化 `laterEpisodes`，并用 `laterEpisodesRef` 保存结束事件读取的最新值。
3. 添加唯一操作回调：

```js
const addToLater = useCallback(episode => {
  let result;
  setLaterEpisodes(previous => {
    result = addLaterEpisode(previous, episode);
    writeLaterEpisodes(result.items);
    return result.items;
  });
  return result;
}, []);

const removeFromLater = useCallback(id => {
  setLaterEpisodes(previous => {
    const next = removeLaterEpisode(previous, id);
    writeLaterEpisodes(next);
    return next;
  });
}, []);
```

4. 在 `handleEnded` 中读取 `playerRef.current.currentEpisode`，在推进当前播放队列的同一个事件处理中调用 `removeFromLater` 的等价函数，确保无论节目从哪个入口启动都能移除。
5. 保留现有 `advanceQueue`、history 记录和音频播放状态行为；只增加稍后播放移除副作用。
6. 向 `QueueSheet` 传入 `laterEpisodes`、`onPlayLater`、`onRemoveLater`、`onMoveLater`、`catalog` 和添加回调。

为避免状态回调中的返回值竞态，界面提示不要依赖 `addToLater` 的同步返回值；由 `addToLater` 在 setter 内更新提示状态，或由纯函数先计算后提交。所有写入失败只产生非阻塞状态提示，不抛出异常。

- [ ] **Step 4: 运行集成测试确认通过**

运行：`npx vitest run src/App.later-playback.test.jsx src/playerState.test.js src/App.test.jsx`

预期：新增集成测试和既有播放器测试全部 PASS。

- [ ] **Step 5: 提交 App 状态接入**

```bash
git add src/App.jsx src/App.later-playback.test.jsx
git commit -m "feat: connect later playback to player state"
```

## Task 3: 播放列表第三个标签和添加节目子页面

**Files:**
- Modify: `src/App.jsx`（`QueueSheet`、添加节目子页面和回调）
- Modify: `src/App.later-playback.test.jsx`

- [ ] **Step 1: 写失败的列表与添加流程测试**

覆盖第三个 tab、数量、空状态、专辑选择、节目添加、重复提示和添加后仍停留在选择页：

```jsx
it('browses albums from the later tab and adds an episode without leaving the picker', async () => {
  getEpisodes.mockResolvedValue({ episodes: [episode(4, '待添加节目')], hasMore: false });
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  fireEvent.click(screen.getByRole('button', { name: '添加节目' }));
  fireEvent.click(screen.getAllByRole('button', { name: /NIO 精选/ })[0]);
  fireEvent.click(await screen.findByRole('button', { name: '添加 待添加节目 到稍后播放' }));

  expect(screen.getByText('已添加到稍后播放')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '返回稍后播放' })).toBeInTheDocument();
});

it('shows a duplicate notice and keeps one item', async () => {
  getEpisodes.mockResolvedValue({ episodes: [episode(4, '待添加节目')], hasMore: false });
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(4, '待添加节目')]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  fireEvent.click(screen.getByRole('button', { name: '添加节目' }));
  fireEvent.click(screen.getByRole('button', { name: /NIO 精选/ }));
  fireEvent.click(await screen.findByRole('button', { name: '添加 待添加节目 到稍后播放' }));
  expect(await screen.findByText('已在稍后播放')).toBeInTheDocument();
});
```

文件顶部使用 `vi.mock('./api', async importOriginal => ({ ...(await importOriginal()), getEpisodes: vi.fn() }))`，避免测试发起真实网络请求。

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/App.later-playback.test.jsx`

预期：FAIL，找不到第三个标签、添加按钮或选择页面。

- [ ] **Step 3: 实现 `QueueSheet` 的稍后播放视图**

在现有两个标签后添加：

```jsx
<button type="button" role="tab" aria-label="稍后播放" aria-selected={activeTab === 'later'} onClick={() => setActiveTab('later')}>
  稍后播放 <span aria-hidden="true">{laterEpisodes.length}</span>
</button>
```

`activeTab === 'later'` 时渲染稍后播放列表；顶部渲染“添加节目”按钮。按钮进入 `LaterPicker` 子视图，子视图通过 `getEpisodes(album.id, page)` 分页加载，保留现有的 loading、错误、重试和加载更多状态。专辑列表来自 `catalog.albums`，点击专辑后展示节目行，每行的添加按钮调用 `onAddLater(episode)`。

添加完成后更新列表数量和提示状态，继续保留选择页；返回按钮回到稍后播放列表。列表节目主体调用 `onPlayLater(episode)`，三点菜单调用移除、上移或下移回调。历史和当前播放队列的现有行为不变。

- [ ] **Step 4: 运行相关测试确认通过**

运行：`npx vitest run src/App.later-playback.test.jsx src/App.test.jsx`

预期：新增列表测试和现有队列弹层测试全部 PASS。

- [ ] **Step 5: 提交播放列表视图**

```bash
git add src/App.jsx src/App.later-playback.test.jsx
git commit -m "feat: add later playback queue tab"
```

## Task 4: 专辑详情添加入口

**Files:**
- Modify: `src/App.jsx`（`EpisodeRow`、`AlbumScreen` props）
- Modify: `src/App.later-playback.test.jsx`

- [ ] **Step 1: 写失败的专辑菜单测试**

```jsx
it('adds an album episode from its compact action menu', async () => {
  getEpisodes.mockResolvedValue({ episodes: [episode(5, '专辑节目')], hasMore: false });
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
  fireEvent.click(screen.getAllByRole('button', { name: /NIO 精选/ })[0]);
  fireEvent.click(await screen.findByRole('button', { name: '管理 专辑节目' }));
  fireEvent.click(screen.getByRole('button', { name: '稍后播放' }));

  expect(window.localStorage.getItem('nio_play_later_v1')).toContain('专辑节目');
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/App.later-playback.test.jsx`

预期：FAIL，专辑节目行没有管理按钮。

- [ ] **Step 3: 复用现有节目行 action 插槽**

保持 `EpisodeRow` 的 `action` 插槽，新增一个局部 action 菜单：

```jsx
<div className="episode-action">
  <button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} onClick={toggleMenu}>
    <MoreHorizontal size={15} aria-hidden="true" />
  </button>
  {open ? <div className="row-action-menu"><button type="button" onClick={handleAdd}><ListPlus size={16} />稍后播放</button></div> : null}
</div>
```

`AlbumScreen` 接收 `onAddLater` 和当前 `laterEpisodes`，添加成功、重复添加均使用统一提示。点击菜单时阻止节目主体的播放事件，首页推荐行不传 action，因此保持不变。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/App.later-playback.test.jsx src/App.album.test.jsx`

预期：专辑入口和既有专辑导航测试全部 PASS。

- [ ] **Step 5: 提交专辑入口**

```bash
git add src/App.jsx src/App.later-playback.test.jsx
git commit -m "feat: add later playback album action"
```

## Task 5: 移除、拖动排序和移动端样式

**Files:**
- Modify: `src/App.jsx`（稍后播放行手势、排序菜单和提示）
- Modify: `src/App.css`
- Modify: `src/scroll-render.test.js`
- Modify: `src/App.later-playback.test.jsx`

- [ ] **Step 1: 写失败的排序与无障碍测试**

覆盖菜单上移/下移、触控移除和拖动排序：

```jsx
import { vi } from 'vitest';

it('moves later items with keyboard-friendly menu actions', async () => {
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集'), episode(3, '第三集')]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  fireEvent.click(screen.getByRole('button', { name: '管理 第二集' }));
  fireEvent.click(screen.getByRole('button', { name: '上移' }));
  const rows = [...screen.getByRole('dialog', { name: '播放列表' }).querySelectorAll('.later-row')];
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringContaining('第二集'),
    expect.stringContaining('第一集'),
    expect.stringContaining('第三集'),
  ]);
});

it('reveals a remove action after a horizontal swipe', async () => {
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集')]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  const row = screen.getByText('第一集').closest('.queue-row');
  fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 100, pointerType: 'touch' });
  fireEvent.pointerMove(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });
  fireEvent.pointerUp(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });
  fireEvent.click(screen.getByRole('button', { name: '移除 第一集' }));
  expect(screen.queryByText('第一集')).not.toBeInTheDocument();
});

it('reorders later items after a long-press vertical drag', async () => {
  window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
  render(<App initialCatalog={catalog} />);
  fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
  fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
  fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
  vi.useFakeTimers();
  const row = screen.getByText('第二集').closest('.later-row');
  fireEvent.pointerDown(row, { pointerId: 2, clientX: 180, clientY: 160, pointerType: 'touch' });
  vi.advanceTimersByTime(250);
  fireEvent.pointerMove(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });
  fireEvent.pointerUp(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });
  vi.useRealTimers();

  const rows = [...screen.getByRole('dialog', { name: '播放列表' }).querySelectorAll('.later-row')];
  expect(rows[0]).toHaveTextContent('第二集');
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/App.later-playback.test.jsx`

预期：FAIL，排序命令和左滑按钮尚未存在。

- [ ] **Step 3: 实现手势和排序控制**

在稍后播放行上维护待处理、左滑和拖动三种手势状态：横向位移超过 12px 且大于纵向位移时进入左滑；长按约 250ms 后允许纵向拖动；手势结束时只提交一次移除或 `moveLaterEpisode`。垂直滚动未满足长按和拖动条件时不改变列表。

菜单同时提供“移除”“上移”“下移”；首项禁用“上移”，末项禁用“下移”。触控移除按钮和菜单操作都调用同一个 `removeFromLater` 回调，排序调用同一个 `moveLaterEpisode` 回调并立即持久化。

- [ ] **Step 4: 添加移动端样式和渲染回归断言**

在 `src/App.css` 增加 `.later-add-row`、`.later-picker`、`.later-swipe-action`、`.later-row.is-swiped`、`.later-row.is-dragging` 和三列 `.queue-tabs` 样式。三点图标使用 15px，外层 `.icon-button` 仍为 44px；在 320px 宽度下标签文字使用 `min-width: 0`、不换行和等宽网格，不能溢出。

在 `src/scroll-render.test.js` 增加以下静态约束：

```js
it('keeps later playback gestures on a bounded paint path', () => {
  expect(css).not.toMatch(/\.later-row[^}]*backdrop-filter\s*:/);
  expect(css).toMatch(/\.queue-tabs[^}]*grid-template-columns:\s*repeat\(3/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 5: 运行相关测试确认通过**

运行：`npx vitest run src/App.later-playback.test.jsx src/App.test.jsx src/scroll-render.test.js`

预期：所有队列、手势、动效和既有滚动渲染测试 PASS。

- [ ] **Step 6: 提交交互和样式**

```bash
git add src/App.jsx src/App.css src/App.later-playback.test.jsx src/scroll-render.test.js
git commit -m "feat: add later playback gestures and controls"
```

## Task 6: 完整验证、合并和 GitHub Pages 发布

**Files:**
- Modify only: `src/laterPlayback.js`, `src/App.jsx`, `src/App.css`, `src/App.later-playback.test.jsx`, or `src/scroll-render.test.js` if a concrete verification failure requires a correction.

- [ ] **Step 1: 运行完整验证**

```bash
npm test -- --run
npm run lint
npm run build
```

预期：Vitest、oxlint 和 Vite build 全部退出码为 0；`dist` 生成静态站点，未新增音频 Service Worker 缓存规则。

- [ ] **Step 2: 使用本地预览验证手机布局**

运行 `npm run dev -- --host 127.0.0.1`，在 320px、375px、430px 宽度检查：第三个标签、添加子页面、菜单、左滑、拖动、底部安全区、浅色/深色模式和减少动效。快速滚动页面确认标题和节目文字没有花屏或重叠。

- [ ] **Step 3: 检查变更范围并合并到主线**

```bash
git status --short
git diff main...HEAD --stat
git checkout main
git merge --ff-only codex/later-playback
git push origin main
```

预期：只包含稍后播放功能及其测试、样式和文档；主线推送成功。

- [ ] **Step 4: 发布 GitHub Pages**

```bash
npm run deploy
```

发布完成后打开 `https://icekale.github.io/nio-podcast-web/`，确认生产构建能读取目录、保存稍后播放并正确播放节目。

- [ ] **Step 5: 记录发布结果**

```bash
git status --short --branch
git log -6 --oneline
```

最终报告提交、测试、构建和 GitHub Pages 地址；若部署受网络或权限影响，明确报告实际阻塞点和已完成的本地验证。
