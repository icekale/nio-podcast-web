# NIO SVG 网页图标设计

## 目标

将用户提供的 NIO 标志作为网页 favicon 和 PWA 图标，保留原图的青绿色方形背景与白色标志，并使用纯 SVG 路径重绘，避免网页图标依赖位图。

## 视觉规格

- 画布：512 × 512，保持正方形比例。
- 背景：整块青绿色 `#00BEBE`，不使用圆角，以匹配用户提供的原图。
- 标志：白色几何路径，居中并保持原图上下两部分的留白关系。
- SVG 不嵌入 PNG，不使用外部资源，保证 favicon、manifest 和 GitHub Pages 均可直接加载。

## 集成范围

- 替换 `public/favicon.svg`，供浏览器标签页使用。
- PWA manifest 增加 SVG 图标声明，同时保留现有 PNG 图标作为旧版 iOS 兼容回退。
- Apple touch icon 继续使用现有 PNG，避免 iOS 对 SVG 主屏图标支持不一致。
- 增加资源测试，检查 favicon 的背景色、SVG 路径和 manifest 引用。

## 验收标准

1. favicon SVG 只依赖内嵌 `<rect>` 和 `<path>`，不包含 `<image>` 或外链资源。
2. 本地构建成功，`dist/favicon.svg` 和 manifest 可访问。
3. 浏览器预览中标签页图标与用户提供的原图保持一致。
4. PWA 图标列表同时覆盖 SVG 与现有 PNG，桌面/Android 使用 SVG，旧版 iOS 仍有 PNG 回退。
