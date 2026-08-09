# Mini Player 进度条交互增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 端（≥1024px）MiniPlayer 顶部进度条增加静态进度着色、点击跳转与悬停时间气泡；移动端零改动。

**Architecture:** 在现有 `MiniPlayer.jsx` 的 `.mini-progress-row` 内新增气泡元素与指针事件状态；进度着色通过 range input 的 `--progress` CSS 变量驱动 track 渐变背景。纯前端、无新依赖。移动端通过 CSS `display:none` 隔离气泡。

**Tech Stack:** React 19 + Vite + Vitest（jsdom）+ CSS 变量

**设计文档:** `docs/superpowers/specs/2026-08-09-mini-player-progress-design.md`

---

### Task 1: 气泡时间计算纯函数（TDD）

**Files:**
- Create: `src/components/MiniPlayer.test.jsx`
- Modify: `src/components/MiniPlayer.jsx`（导出 `bubbleSecondsFromPointer`）

- [ ] **Step 1: 写失败测试**

创建 `src/components/MiniPlayer.test.jsx`：

```jsx
import { describe, expect, it } from 'vitest';
import { bubbleSecondsFromPointer } from './MiniPlayer';

describe('bubbleSecondsFromPointer', () => {
  it('maps pointer x within the track to seconds', () => {
    // track 从 x=100 到 x=500（宽 400），duration 200s；x=300 即 50% → 100s
    expect(bubbleSecondsFromPointer(300, 100, 400, 200)).toBe(100);
  });

  it('clamps positions left of the track to zero', () => {
    expect(bubbleSecondsFromPointer(50, 100, 400, 200)).toBe(0);
  });

  it('clamps positions right of the track to the duration', () => {
    expect(bubbleSecondsFromPointer(900, 100, 400, 200)).toBe(200);
  });

  it('returns zero for empty duration', () => {
    expect(bubbleSecondsFromPointer(300, 100, 400, 0)).toBe(0);
    expect(bubbleSecondsFromPointer(300, 100, 400, NaN)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `NODE_ENV=test npx vitest run src/components/MiniPlayer.test.jsx`
Expected: FAIL — `bubbleSecondsFromPointer is not a function`

- [ ] **Step 3: 实现函数**

在 `src/components/MiniPlayer.jsx` 顶部（import 之后）添加并导出：

```js
export function bubbleSecondsFromPointer(clientX, trackLeft, trackWidth, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const ratio = (clientX - trackLeft) / trackWidth;
  return Math.min(Math.max(Math.round(ratio * durationSeconds), 0), durationSeconds);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `NODE_ENV=test npx vitest run src/components/MiniPlayer.test.jsx`
Expected: PASS — 4 tests

- [ ] **Step 5: 提交**

```bash
git add src/components/MiniPlayer.test.jsx src/components/MiniPlayer.jsx
git commit -m "feat: bubble time calculation for mini player progress"
```

---

### Task 2: MiniPlayer 组件集成（气泡元素、指针事件、进度着色变量）

**Files:**
- Modify: `src/components/MiniPlayer.jsx`

- [ ] **Step 1: 改造组件**

将 `src/components/MiniPlayer.jsx` 的导入与组件体替换为：

```jsx
import { useCallback, useRef, useState } from 'react';
import { Heart, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Artwork } from './Artwork';
import { formatClock } from '../format';

export function bubbleSecondsFromPointer(clientX, trackLeft, trackWidth, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const ratio = (clientX - trackLeft) / trackWidth;
  return Math.min(Math.max(Math.round(ratio * durationSeconds), 0), durationSeconds);
}

export function MiniPlayer({ player, isPlaying, audioError, favoriteIds = [], onToggleFavorite, onToggle, onAdjacent, onRetry, onOpenQueue, queueButtonRef, onSeek, isClosing = false, onExited }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  const queueSize = player.queue?.length || 0;
  const favorited = favoriteIds.includes(Number(player.currentEpisode?.albumId));
  const currentAlbumId = player.currentEpisode?.albumId;
  const progressRef = useRef(null);
  const [bubbleSeconds, setBubbleSeconds] = useState(null);

  const positionSeconds = Math.min(player.positionSeconds, duration || 0);
  const progressPercent = duration > 0 ? (positionSeconds / duration) * 100 : 0;

  const updateBubbleFromPointer = useCallback(event => {
    const track = progressRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    setBubbleSeconds(bubbleSecondsFromPointer(event.clientX, rect.left, rect.width, duration));
  }, [duration]);

  const hideBubble = useCallback(() => setBubbleSeconds(null), []);

  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        {currentAlbumId != null && onToggleFavorite ? (
          <button type="button" className={`player-control mini-favorite${favorited ? ' is-favorite' : ''}`} aria-label={favorited ? `取消收藏 ${player.currentEpisode.albumName || ''}` : `收藏 ${player.currentEpisode.albumName || ''}`} aria-pressed={favorited} onClick={() => onToggleFavorite(currentAlbumId)}>
            <Heart size={19} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        ) : null}
        <div className="mini-transport">
          <button type="button" className="player-control mini-skip" aria-label="上一首" disabled={queueSize < 2} onClick={() => onAdjacent?.(-1)}><SkipBack size={20} /></button>
          <button type="button" className="player-control mini-toggle" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
          <button type="button" className="player-control mini-skip" aria-label="下一首" disabled={queueSize < 2} onClick={() => onAdjacent?.(1)}><SkipForward size={20} /></button>
        </div>
        <div
          ref={progressRef}
          className="mini-progress-row"
          onPointerMove={updateBubbleFromPointer}
          onPointerLeave={hideBubble}
        >
          <span>{formatClock(positionSeconds)}</span>
          <input
            aria-label="播放进度"
            type="range"
            min="0"
            max={duration || 0}
            step="1"
            value={positionSeconds}
            onChange={event => { onSeek(event); setBubbleSeconds(Number(event.target.value)); }}
            style={{ '--progress': `${progressPercent}%` }}
          />
          <span>{formatClock(duration)}</span>
          {bubbleSeconds != null ? (
            <span className="mini-progress-bubble" aria-hidden="true">{formatClock(bubbleSeconds)} / {formatClock(duration)}</span>
          ) : null}
        </div>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}
```

注意：`style={{ '--progress': ... }}` 需要 React 19 支持自定义属性（支持）。若 lint 报 unknown property，用 `style={{ '--progress': `${progressPercent}%` }}` 原样保留（React 允许 `--` 前缀）。

- [ ] **Step 2: 运行组件测试确认通过**

Run: `NODE_ENV=test npx vitest run src/components/MiniPlayer.test.jsx src/App.test.jsx`
Expected: PASS

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `npm test`
Expected: 185 passed（含既有 MiniPlayer 相关用例）

- [ ] **Step 4: 提交**

```bash
git add src/components/MiniPlayer.jsx
git commit -m "feat: progress bubble and pointer tracking in mini player"
```

---

### Task 3: CSS（进度着色、气泡样式、移动端隔离）

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 桌面端 track 渐变着色 + 气泡样式**

在桌面 media query（`@media (min-width: 1024px)`）内，将 `.mini-progress-row` 块整体替换为：

```css
  .mini-progress-row {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    order: 5;
    height: 0.25rem;
    margin: 0;
    padding: 0 var(--space-4);
    overflow: visible;
    opacity: 0.85;
    transition: height 160ms ease, opacity 160ms ease;
  }
  .mini-progress-row span { display: none; }
  .mini-progress-row input { height: 0.25rem; }
  .mini-progress-row input::-webkit-slider-runnable-track {
    height: 0.125rem;
    background: linear-gradient(to right, var(--teal) var(--progress, 0%), var(--line) var(--progress, 0%));
  }
  .mini-progress-row input::-webkit-slider-thumb {
    width: 0.75rem;
    height: 0.75rem;
    margin-top: -0.25rem;
    border-width: 0.1875rem;
  }
  .mini-progress-row input::-moz-range-track {
    height: 0.125rem;
    background: linear-gradient(to right, var(--teal) var(--progress, 0%), var(--line) var(--progress, 0%));
  }
  .mini-progress-row input::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-width: 0.1875rem; }
  .mini-progress-bubble {
    position: absolute;
    bottom: calc(100% + 0.375rem);
    left: 50%;
    transform: translateX(-50%);
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: var(--surface);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
  .mini-player:hover .mini-progress-row, .mini-progress-row:focus-within {
    height: 1.5rem;
    opacity: 1;
  }
```

关键变更说明：
- `overflow: hidden` → `visible`：气泡位于行外上方，不能被裁剪（行高只有 0.25rem/1.5rem，气泡在 `bottom: calc(100% + ...)` 处）
- track 改为 `linear-gradient` 用 `var(--progress)` 着色（已播放青绿 / 未播放浅灰）
- `.mini-progress-bubble` 深色小标签，`pointer-events: none` 不拦截鼠标

- [ ] **Step 2: 移动端隐藏气泡**

在桌面 media query 外（基础样式区，`.mini-progress-row` 基础定义附近）添加：

```css
.mini-progress-bubble { display: none; }
```

- [ ] **Step 3: 验证 CSS 断言测试**

Run: `NODE_ENV=test npx vitest run src/scroll-render.test.js`
Expected: PASS（现有断言 `position: absolute`、`mini-transport order: 4`、`queue-control order: 6` 均不受影响）

- [ ] **Step 4: 全量测试 + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add src/App.css
git commit -m "style: progress gradient and hover bubble for mini player"
```

---

### Task 4: 端到端验证与部署

**Files:** 无代码改动

- [ ] **Step 1: 本地截图验证桌面端**

```bash
npm run dev -- --port 5199 &
```

用 Playwright（项目内 `node shot-tmp.mjs`）验证：
1. 播放器出现后，未悬停：顶部细线显示青绿/浅灰渐变（`--progress` 生效）
2. hover 播放器：进度条展开、气泡显示 `目标时间 / 总时长`
3. 鼠标沿进度条移动：气泡时间变化
4. 点击细线：跳转生效
5. 拖动滑块：气泡跟随、松手跳转
6. 移动端视口（390px）：气泡不显示、底部进度条不变

- [ ] **Step 2: e2e 测试**

Run: `npx playwright test`
Expected: 5 passed

- [ ] **Step 3: 提交并推送**

```bash
git add -A
git commit -m "feat: mini player progress bubble interaction"
git pull --rebase origin main
git push origin HEAD:main
```

- [ ] **Step 4: 线上验证**

等待 deploy workflow 成功后（`gh run list --workflow=deploy.yml --limit 1`），访问 https://nio.k4le.top 用浏览器 DevTools 或截图确认进度条着色与气泡行为。

---

## Self-Review 记录

- **Spec 覆盖**：静态着色（Task 3 track 渐变）✓；点击跳转（Task 2 input 原生 range 点击即 seek，无需额外代码）✓；悬停气泡跟随鼠标（Task 2 onPointerMove + Task 3 气泡样式）✓；拖动跟随（Task 2 onChange setBubbleSeconds）✓；键盘聚焦展开（CSS `:focus-within` 保留）✓；移动端零改动（Task 3 气泡 display:none + 其余 CSS 在桌面 media query 内）✓；测试（Task 1 单测 + Task 4 验证）✓
- **占位符**：无
- **类型一致性**：`bubbleSecondsFromPointer(clientX, trackLeft, trackWidth, durationSeconds)` 在 Task 1 定义、Task 2 调用，签名一致；`positionSeconds`/`progressPercent` 命名在组件与 CSS 变量间一致
