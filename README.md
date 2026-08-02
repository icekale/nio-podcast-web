# NIO Radio

NIO Radio 是面向手机浏览器的 NIO 播客 PWA。应用通过 GitHub Pages 发布，目录数据由 GitHub Actions 定时更新，播放进度、历史记录和“稍后播放”保存在访问者自己的浏览器中。

## 本地开发

```bash
npm ci
npm run dev
```

提交前运行完整检查：

```bash
npm test
npm run lint
npm run build
```

`npm run preview` 可以在生产构建后启动本地预览，检查 PWA 资源和相对路径。

## 目录更新

目录生成器默认执行全量扫描：

```bash
npm run catalog
```

已有目录时，增量模式只刷新现有专辑：

```bash
NIO_CATALOG_MODE=incremental npm run catalog
```

全量模式用于发现新专辑：

```bash
NIO_CATALOG_MODE=full npm run catalog
```

全量扫描会保留请求失败的旧专辑；明确返回不存在的专辑才会删除。若结果比已有目录减少超过 10%，生成器会失败且不会写入 `public/data/albums.json`。目录写入使用临时文件和原子替换。

GitHub Actions 使用北京时间（`Asia/Shanghai`）：工作日 07:30 执行全量扫描，其余工作日时段执行增量扫描；周末在 12:00 和 18:00 执行增量扫描。工作流通过 `workflow_dispatch` 支持手动选择 `incremental` 或 `full`。

## GitHub Pages 发布

生产域名为 [nio.k4le.top](https://nio.k4le.top/)。`public/CNAME` 和相对资源路径保证自定义域名可用；旧地址 [icekale.github.io/nio-podcast-web](https://icekale.github.io/nio-podcast-web/) 由 GitHub Pages 管理重定向。

目录工作流只有在目录发生变化时才会发布。它会依次执行测试、lint、PWA 构建和 Pages 发布，全部成功后才提交 `public/data/albums.json` 到 `main`。部署失败时不要手动提交残缺目录，直接重新运行失败的工作流即可。

## 缓存策略

- 目录使用 Service Worker `NetworkFirst`，网络超时或离线时回退到最近一次缓存。
- 目录同时保存在 `localStorage`，页面回到前台后最多每 15 分钟刷新一次。
- 专辑封面使用有数量上限和 30 天有效期的 `CacheFirst` 缓存。
- 音频不进入 Service Worker 缓存，避免占用设备空间和缓存过期音频。
- 播放器状态使用 `nio_player_state_v2`，稍后播放使用 `nio_play_later_v1`。

## 故障恢复

1. 在 Actions 页面打开失败的 `Update NIO Radio catalog` 工作流，确认失败步骤和日志。
2. 网络或上游接口短暂异常时，重新运行相同模式；全量扫描保护会阻止残缺结果发布。
3. Pages 发布失败时，先修复工作流或 Pages 配置，再重新运行工作流；不要绕过测试直接推送目录。
4. 发布后检查自定义域名、旧地址、`manifest.webmanifest` 和 `data/albums.json` 是否返回成功响应。
