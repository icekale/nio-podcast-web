# NIO Radio 微信小程序版设计

**日期：** 2026-08-04

## 摘要

将现有的 NIO Radio 播客网页版（React + Vite + GitHub Pages，仓库 `/Users/kale/.openclaw/workspace/nio-podcast-web`）移植为原生微信小程序，面向手机微信用户。复刻基准是网页版的移动端体验（320–430px 宽度），视觉、交互行为与错误文案保持一致；桌面布局与 PWA 安装能力不属于小程序范围。

首版验收目标是“微信开发者工具可运行 + 真机预览可用”，不包含正式提审、域名备案或上线配置。上线期预留云函数代理接口，首版不实现。

## 目标

- 完整复刻移动端功能：首页、全部专辑、搜索、专辑详情、迷你播放器、播放列表/最近听过/稍后播放弹层。
- 播放行为与网页版一致：点击播放即建立可见列表队列、播完自动推进、队尾停止、进度与历史持久化、恢复播放规则一致。
- 数据与缓存策略一致：目录 5 分钟新鲜度、节目列表 10 分钟内存缓存与并发去重、错误码与文案一致。
- 视觉一致：浅色/深色两套色板数值与网页版一致；安全区、44px 触达、动效节奏复刻。
- 开发者工具与真机预览可用：预览期目录从 `https://nio.k4le.top/data/albums.json` 刷新，节目接口直连蔚来公开接口。
- 为正式上线预留切换点：数据层抽象为“直连蔚来接口”与“云函数代理”两种模式。

## 非目标

- 桌面布局（≥700px 居中面、≥1024px 侧边栏）、PWA 安装按钮、Service Worker。
- 账号体系、云端同步、跨设备播放状态。
- 离线音频下载；音频始终需要网络。
- 评论、社交、订阅推荐、用户画像。
- 正式发布：域名配置、备案、提审、类目资质、线上运维。
- 后台目录生成：继续复用网页版仓库的 GitHub Actions 产物，小程序侧只消费。

## 复刻基准与已知平台差异

“完全一样”定义为：移动端视觉、布局、文案、交互行为与网页版一致；因平台能力差异，以下内容按小程序规范等价实现：

| 网页版 | 小程序版 |
|---|---|
| hash 路由 + history 深度 | 原生页面栈（4 个页面）+ 自定义导航栏 |
| `localStorage` | `wx.setStorageSync` / `wx.getStorageSync`，键与结构完全一致 |
| HTML `<audio>` | `BackgroundAudioManager`（切后台继续播放） |
| `prefers-color-scheme` | `app.json` 开启 `darkmode` + `theme.json` 变量，自动跟随系统 |
| `color-mix()` / `backdrop-filter` | 全部换成实色 |
| rem 令牌、430px 移动面 | rpx 令牌，天然手机宽度；≤359px 紧凑规则保留 |
| lucide-react SVG 图标 | 本地图标资产（iconfont 或双主题 PNG） |
| 键盘 / Esc / 焦点圈闭 | 触屏交互 + 返回键优先级；不移植键盘语义 |
| `prefers-reduced-motion` | 微信无该信号；动效保持克制且非关键内容 |
| PWA / 安装应用 | 不适用，不移植 |

## 架构

原生小程序（WXML / WXSS / JS，CommonJS），项目根目录 `/Users/kale/Documents/nio radio`。

### 页面

- `pages/home/index`：今日推荐 + 今日更新/最新更新。
- `pages/albums/index`：全部专辑（置顶 + 最新排序 + 分页）。
- `pages/search/index`：搜索（本地过滤 + 防抖）。
- `pages/album/index`：专辑详情（节目列表分页 + 稍后播放入口）。

所有页面使用自定义导航栏（`navigationStyle: "custom"`），以控制“队列弹层打开时返回键先关闭弹层，再退出页面”的优先级。

### 组件

- `components/custom-nav`：状态栏高度 + 自定义顶栏（首页滚动态、专辑/搜索/详情返回）。
- `components/episode-row`：节目行（封面、标题、专辑·时长·日期、已听百分比、管理菜单）。
- `components/album-row`：专辑行（封面、名称、最新节目/描述、分页加载更多）。
- `components/mini-player`：迷你播放器（封面、标题、进度滑杆、播放/暂停、队列入口、错误重试）。
- `components/queue-sheet`：队列弹层（播放列表 / 最近听过 / 稍后播放三 Tab、添加节目选择器、左滑删除、拖拽排序、行菜单）。
- `components/artwork`：封面图（加载失败显示占位图标）。
- `components/state-view`：加载 / 空 / 错误状态的统一视图。

### 服务与工具

- `services/player-store.js`：播放器单例（包装 `BackgroundAudioManager`）+ 订阅式状态；页面按需 `setData`，进度更新不触发整页重渲染。
- `services/catalog-store.js`：目录加载、5 分钟新鲜度、单飞刷新、缓存回退。
- `services/episode-cache.js`：节目列表 10 分钟内存缓存 + 并发去重。
- `utils/api.js`：移植自 `src/api.js`。
- `utils/catalog.js`：移植自 `src/catalog.js`。
- `utils/playerState.js`：移植自 `src/playerState.js`。
- `utils/laterPlayback.js`：移植自 `src/laterPlayback.js`。
- `utils/format.js`：`formatDuration` / `formatClock` / `formatDate`。
- `utils/storage.js`：`wx` 存储封装（可注入内存实现以便单测）。

工具层保持与网页版同名同结构的纯函数，便于直接复用现有 130 项测试。

## 数据层

### 目录（albums）

- 内置 `data/albums.json`（当前 565 张专辑、约 532KB，复制自网页版仓库生成产物），保证首屏离线可用。
- 启动后与网页版一致按 5 分钟新鲜度窗口刷新：预览期从 `https://nio.k4le.top/data/albums.json` 拉取（需开发者工具勾选“不校验请求域名、TLS 版本及 HTTPS 证书”，真机预览开启调试模式）；上线期切换为云函数地址。
- 刷新失败回退本地缓存，显示“显示的是上次缓存的目录 / 刷新目录”；手动刷新显示“正在刷新目录…”。
- 本地缓存键 `nio_catalog_cache_v1`，结构与网页版一致。
- 排序与选择逻辑移植：`sortAlbumsByLatest`（同时间按专辑 id 升序）、全部专辑页 `sortAlbumsForDirectory`（置顶 id 5、23 固定顺序）、`selectHomeEpisodes`（按 episode id 去重，当日 ≤12 条，否则最新 12 条）。

### 节目列表（episodes）

- 接口：`POST https://gateway-front-external.nio.com/moat/100914/v2/audio/list`，`application/x-www-form-urlencoded`，参数 `albumId`、`sorttype=2`、`pagenum`、`pagesize`。
- 超时 8 秒；错误码保持 `OFFLINE` / `TIMEOUT` / `HTTP_ERROR` / `INVALID_RESPONSE` / `NETWORK_ERROR`，文案与网页版一致。
- `mapEpisode` 字段映射与 HTTPS 归一化原样移植（`aacPlayUrl192 || aacPlayUrl128 || mp3PlayUrl64`）。
- 专辑详情分页每页 30 条；内存缓存 10 分钟、最多 100 条、并发同键去重。

### 播放状态与稍后播放

- 存储键与结构完全一致：`nio_player_state_v2`、`nio_play_later_v1`。
- `playerState`：队列、队列索引、进度、历史（去重、上限 100）、当前节目必须在队列中的恢复校验、`canResume`（>10 秒且剩余 ≥30 秒）、播完单次推进、队尾停止。
- `laterPlayback`：添加（去重）、移除、移动；播完自动从稍后播放移除（与网页版 `handleEnded` 行为一致）。

## 播放器

- 使用全局唯一的 `BackgroundAudioManager`；`app.json` 配置 `requiredBackgroundModes: ["audio"]`，支持切后台继续播放。
- 事件映射：`onTimeUpdate` 更新进度（5 秒节流持久化）、`onEnded` 推进队列、`onError` 显示播放器内错误与重试、封面与标题同步到锁屏。
- 播放行为与网页版一致：点击节目以可见列表为队列；同一节目再次点击从头播放；进度滑杆 seek；无音频地址时显示“该节目没有可播放音频，请稍后重试”。
- 页面与播放器解耦：页面订阅状态并只更新自身所需字段；队列弹层只接收队列/历史/稍后播放数组，不因进度变化重渲染（对应网页版 review 修复项）。
- 后台播放的锁屏控制由系统提供；后台不能通过 API 操作播放状态，回到前台时以 `BackgroundAudioManager` 状态校正 UI。

## 页面与交互

### 首页

- 顶部自定义导航栏：左侧“全部专辑”，中间标题（未滚动 `NIO Radio`，滚动后 `今日推荐`），右侧“搜索”；滚动后且有当前节目时显示“继续播放”（≤359px 宽度隐藏，与网页版一致）。
- 今日推荐面板：TODAY、标题、节目标题（最多 3 行）、专辑·时长、封面、“全部播放”按钮。
- 今日更新/最新更新列表：标题 + 数量（数量更新时轻微 pop 动画）、节目行（已听百分比显示于当前节目）。
- 缓存/刷新失败提示条：三种状态与文案与网页版一致。

### 全部专辑与搜索

- 全部专辑：置顶“资讯充电站·早间版/晚间版”，其余按最新一期排序；每批 100 条，“加载更多专辑”；计数为完整数量。
- 搜索：进入自动聚焦；120ms 防抖过滤名称/简介/主持人；无结果空态；返回后保留输入（页面栈天然保留，与网页版 q 参数效果一致）。

### 专辑详情

- 顶栏专辑名 + “N 集”；专辑简介区（封面、节目列表、描述）。
- 节目列表每页 30 条，“加载更多”；失败时内联错误 + “重新加载”（重试失败页，不清空已加载内容）。
- 每行 ⋯ 菜单：“稍后播放”，成功提示三种文案与网页版一致。

### 迷你播放器与队列弹层

- 迷你播放器固定底部，占满内容区需预留底部空间（与网页版 8rem 等价的 rpx 值）；包含封面、标题、专辑名、已播/总时长、进度滑杆、播放/暂停、队列按钮。
- 队列弹层为页内 overlay（非独立页面）：遮罩淡入 220ms、弹层上滑 320ms 缓出、关闭 240ms；行入场 stagger（每行 30ms 延迟，限前 8 行）。
- 三 Tab：播放列表 / 最近听过 / 稍后播放，Tab 计数与选中下划线一致。
- 播放列表行菜单：下一首播放 / 移出列表；当前行高亮。
- 稍后播放：添加节目（专辑选择器 → 节目列表，整行可点 + “+”按钮）；左滑显示“移除”；长按 250ms 拖拽上/下排序（阈值 32px）；行菜单上移/下移/移除。
- 关闭方式：遮罩、右上角 X、下滑超过 80px、系统返回（先关弹层再退页）。

## 主题与适配

- `app.json` 开启 `darkmode: true`；`theme.json` 定义浅/深两套变量，WXSS 通过 `var()` 使用，自动跟随系统。
- 变量名与色值与网页版一致：`--surface`（`#ffffff` / `#101a27`）、`--surface-soft`（`#f5f8f9` / `#182433`）、`--aqua`（`#e7f7f7` / `#133239`）、`--teal`（`#00b9b5` / `#2bd0c6`）、`--teal-dark`（`#006f6d` / `#8af5eb`）、`--ink`（`#08162e` / `#f0f6fa`）、`--muted`（`#5f6b7b` / `#b8c4ce`）、`--muted-strong`（`#4b586b` / `#d3dde5`）、`--line`（`#e8edf0` / `#2b3949`）、`--danger`（`#b53939` / `#ff9292`）。
- rpx 换算基准：750rpx 设计稿，1rem = 32rpx（375px 屏）。间距、圆角、图标尺寸、触达尺寸按此换算；交互目标 ≥88rpx（≈44px）。
- 底部与刘海安全区使用 `env(safe-area-inset-*)`。
- 系统字体栈沿用网页版（`-apple-system`、`PingFang SC` 等）。
- 动画仅用于弹层开合、行入场、计数 pop、路由进退场（小程序页面切换动效由微信原生提供，不额外实现）。

## 错误处理与文案

以下文案与网页版逐字一致：

- 正在准备 NIO Radio…
- 目录暂时无法加载 / 请检查网络后重试，已缓存的节目仍可继续播放。/ 重新加载
- 显示的是上次缓存的目录 / 刷新目录；正在刷新目录… / 刷新中；目录刷新失败，继续使用缓存内容
- 正在加载节目… / 正在加载下一页…
- 节目加载失败，请检查网络后重试 / 重新加载
- 这个专辑还没有节目 / 暂无可用专辑 / 暂无可播放的节目 / 没有找到匹配的专辑
- 播放列表是空的 / 还没有听过的节目 / 稍后播放是空的 / 选择一个节目后，它会出现在这里
- 音频加载失败，请检查网络后重试 / 音频暂时无法播放，请稍后重试 / 该节目没有可播放音频，请稍后重试 / 重试
- 已添加到稍后播放 / 已在稍后播放 / 已添加到稍后播放，但无法保存，刷新后可能丢失
- 专辑不存在 / 返回首页

原始异常信息不展示给用户。

## 网络与域名（开发/预览与上线）

- 预览期：开发者工具勾选“开发环境不校验请求域名、TLS 版本及 HTTPS 证书”；真机预览开启调试模式后同样跳过校验，可直连蔚来接口与 `nio.k4le.top`。
- 音频播放（`BackgroundAudioManager`）与图片加载不受合法域名限制，只需 HTTPS 证书有效。
- 上线期：`wx.request` 只能访问已配置且归属校验通过的域名；`gateway-front-external.nio.com` 无法加入白名单，需通过微信云开发云函数转发（目录与节目列表都走云函数；音频仍由客户端直连蔚来 CDN）。
- 数据层预留 `services/api-config.js`：`mode: 'direct' | 'cloud'`、`catalogBase`、`episodeBase`，切换时页面与播放层不动。

## 测试与验收

### 单元测试（Vitest，在 nio radio 仓库）

- 移植并运行网页版现有用例：`api`（错误码、字段映射、缓存与去重）、`catalog`（排序、置顶、今日更新、归一化）、`playerState`（队列、历史、恢复、推进）、`laterPlayback`（增删移）。
- 工具层保持 CommonJS，兼容微信开发者工具与 Vitest。

### 真机验收清单

- 首页：推荐面板、今日更新数量与内容、滚动顶栏切换、继续播放、全部播放。
- 专辑：置顶顺序、分页加载更多、计数。
- 搜索：过滤、清空、返回保留输入。
- 专辑详情：分页、加载更多、内联错误重试、稍后播放添加。
- 播放：点击播放建队列、播完自动推进、队尾停止、seek、同一节目重播、恢复播放。
- 队列弹层：三 Tab、行菜单、下一首播放/移出、关闭方式。
- 稍后播放：添加、左滑删除、长按排序、播放后自动移除。
- 后台播放：切后台继续播放、锁屏封面/标题、返回前台状态一致。
- 主题：浅色/深色跟随系统，色板与网页版一致。
- 错误与断网：目录失败整页重试、节目失败内联重试、音频失败重试、各空状态。

## 上线预留（后续阶段）

- 微信云开发云函数：转发蔚来节目接口（返回与原接口相同的 payload 结构），目录定时刷新并缓存；小程序以 `wx.cloud.callFunction` 调用。
- 云函数仅处理轻量 JSON 请求；音频流量由客户端直连蔚来 CDN，不经过云函数。
- `requiredBackgroundModes` 在开发版/体验版直接生效，正式版需审核通过后生效。
- 正式提审注意事项：小程序类目、内容合规、音频版权归属、隐私协议（本应用不采集用户数据，仅本地存储播放状态）等，记录但不纳入首版实现。

## 参考资料

- 网页版仓库：`/Users/kale/.openclaw/workspace/nio-podcast-web`（`main` @ 0b446dd，测试 130 项通过）。
- 移植基准文件：`src/App.jsx`（1153 行）、`src/App.css`（488 行）、`src/api.js`、`src/catalog.js`、`src/playerState.js`、`src/laterPlayback.js`、`public/data/albums.json`。
- 网页版既有规范：`docs/superpowers/specs/2026-08-02-nio-podcast-mobile-redesign-design.md`、`2026-08-03-catalog-client-freshness-design.md`、`2026-08-03-pinned-album-directory-design.md`。
- 网页版仓库内有一份未提交的 `docs/superpowers/plans/2026-08-03-review-fixes.md`（目录扫描容错与 CI 顺序相关），与小程序移植无关，应在网页版仓库另行跟进或归档。
