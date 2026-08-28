import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const outDir = resolve('docs/promo');
const shotDir = resolve(outDir, '_shots');
mkdirSync(shotDir, { recursive: true });

const LOGO = readFileSync(resolve('public/favicon.svg'), 'utf8');

function dataUri(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

function shotUri(name) {
  return dataUri(resolve(shotDir, name));
}

const shell = `
    html, body { margin: 0; padding: 0; }
    body { background: #ffffff; color: #08162e; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif; font-synthesis: none; }
    .brand { display: flex; align-items: center; gap: 14px; font-weight: 650; }
    .brand svg { display: block; border-radius: 10px; }
    .kicker { color: #006f6d; font-weight: 700; letter-spacing: 0.08em; }
    h1 { margin: 0; font-weight: 650; line-height: 1.15; }
    .stage { position: relative; background: #eef3f5; border-radius: 28px; }
    .phone { position: absolute; top: 36px; left: 50%; height: calc(100% - 72px); aspect-ratio: 390 / 844; transform: translateX(-50%); box-sizing: border-box; padding: 9px; background: #0c1a2b; border-radius: 42px; box-shadow: 0 22px 50px rgba(8, 22, 46, 0.16); }
    .phone img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 33px; }
    .desktop { position: absolute; left: 40px; right: 40px; top: 50%; aspect-ratio: 16 / 10; transform: translateY(-50%); box-sizing: border-box; overflow: hidden; background: #0c1a2b; border-radius: 18px; box-shadow: 0 22px 50px rgba(8, 22, 46, 0.16); }
    .titlebar { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; background: #152536; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #3d4d5e; }
    .desktop img { display: block; width: 100%; height: calc(100% - 34px); object-fit: cover; object-position: top; }
    .steps { width: 86%; display: grid; gap: 28px; font-size: 36px; line-height: 1.4; }
    .url { color: #006f6d; font-weight: 650; word-break: break-all; }
`;

function cardHtml({ kicker, title, image, note, kind = 'phone' }) {
  const media = kind === 'steps'
    ? `<div class="steps">
        <p><strong>安卓</strong> 浏览器菜单 → 添加到主屏幕</p>
        <p><strong>iPhone</strong> 分享 → 添加到主屏幕</p>
        <p class="url">https://nio.k4le.top/</p>
      </div>`
    : kind === 'desktop'
      ? `<div class="desktop"><div class="titlebar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><img src="${image}" alt="" /></div>`
      : `<div class="phone"><img src="${image}" alt="" /></div>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    ${shell}
    body { width: 1080px; height: 1440px; }
    .page { box-sizing: border-box; height: 1440px; padding: 56px 64px 56px; display: flex; flex-direction: column; }
    .bar { height: 8px; background: #00bebe; margin: -56px -64px 40px; }
    .brand { font-size: 26px; }
    .brand svg { width: 44px; height: 44px; }
    .kicker { margin: 18px 0 8px; font-size: 20px; }
    h1 { margin: 0 0 22px; font-size: 48px; }
    .stage { flex: 1; width: 100%; }
    .note { margin: 18px 0 0; color: #5f6b7b; font-size: 22px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="bar"></div>
    <div class="brand">${LOGO}NIO Radio</div>
    <div class="kicker">${kicker}</div>
    <h1>${title}</h1>
    <div class="stage">${media}</div>
    ${note ? `<p class="note">${note}</p>` : ''}
  </div>
</body>
</html>`;
}

function coverHtml(image) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    ${shell}
    body { width: 1920px; height: 1080px; }
    .page { box-sizing: border-box; height: 1080px; padding: 72px 80px; display: grid; grid-template-columns: 1fr auto; gap: 72px; align-items: center; }
    .topbar { position: absolute; top: 0; left: 0; right: 0; height: 10px; background: #00bebe; }
    .brand { font-size: 28px; }
    .brand svg { width: 52px; height: 52px; }
    .kicker { margin: 36px 0 16px; font-size: 26px; }
    h1 { font-size: 72px; }
    .sub { margin: 28px 0 0; color: #5f6b7b; font-size: 28px; }
    .stage { width: 440px; height: 900px; background: transparent; }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <div class="page">
    <div>
      <div class="brand">${LOGO}NIO Radio</div>
      <div class="kicker">WEB PLAYER</div>
      <h1>蔚来播客，<br>打开就能听</h1>
      <p class="sub">手机和电脑都能用 · nio.k4le.top</p>
    </div>
    <div class="stage"><div class="phone"><img src="${image}" alt="" /></div></div>
  </div>
</body>
</html>`;
}

async function shotCard(page, html, path, size) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))));
  await page.screenshot({ path, clip: { x: 0, y: 0, width: size.width, height: size.height } });
}

async function shotViewport(page, path) {
  const vp = page.viewportSize();
  await page.screenshot({ path, clip: { x: 0, y: 0, width: vp.width, height: vp.height } });
}

async function ready(page) {
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img.artwork-media')) {
      img.loading = 'eager';
      img.src = img.currentSrc || img.src;
    }
  });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('img.artwork-media')].map(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))));
}

const chromeMobile = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch();
if (!process.argv.includes('--compose-only')) {
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: chromeMobile,
  });
  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  await mobile.addInitScript(() => localStorage.setItem('nio_ios_install_dismissed', '1'));
  await mobile.goto('https://nio.k4le.top/', { waitUntil: 'networkidle', timeout: 60000 });
  await mobile.getByRole('heading', { name: '今日推荐' }).waitFor({ timeout: 45000 });
  await ready(mobile);
  await shotViewport(mobile, resolve(shotDir, 'home.png'));

  await mobile.goto('https://nio.k4le.top/album/900001', { waitUntil: 'networkidle' });
  await mobile.getByText('小雨').first().waitFor({ timeout: 20000 });
  await ready(mobile);
  await shotViewport(mobile, resolve(shotDir, 'noise.png'));

  await mobile.goto('https://nio.k4le.top/', { waitUntil: 'networkidle' });
  await mobile.getByRole('heading', { name: '今日推荐' }).waitFor({ timeout: 45000 });
  await ready(mobile);
  await mobile.locator('.primary-button').first().click();
  await mobile.getByRole('button', { name: '打开播放列表' }).waitFor({ timeout: 15000 });
  await mobile.getByRole('button', { name: '打开播放列表' }).click();
  await mobile.getByRole('dialog', { name: '播放列表' }).waitFor();
  await mobile.locator('.queue-row').first().waitFor();
  await shotViewport(mobile, resolve(shotDir, 'queue.png'));
  await mobile.close();

  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  await desktop.addInitScript(() => localStorage.setItem('nio_ios_install_dismissed', '1'));
  await desktop.goto('https://nio.k4le.top/', { waitUntil: 'networkidle', timeout: 60000 });
  await desktop.getByRole('heading', { name: '今日推荐' }).waitFor({ timeout: 45000 });
  await ready(desktop);
  await shotViewport(desktop, resolve(shotDir, 'desktop.png'));
  await desktop.close();
}

const poster = await browser.newPage();
const home = shotUri('home.png');
await shotCard(poster, cardHtml({ kicker: 'WEB PLAYER', title: '蔚来播客，<br>打开就能听', image: home }), resolve(outDir, 'xiaohongshu-01.png'), { width: 1080, height: 1440 });
await shotCard(poster, cardHtml({ kicker: '每日目录', title: '每天自动更新', image: home, note: '通勤先听这一期' }), resolve(outDir, 'xiaohongshu-02.png'), { width: 1080, height: 1440 });
await shotCard(poster, cardHtml({ kicker: '本地进度', title: '进度留在<br>自己设备上', image: shotUri('queue.png'), note: '稍后播放也在这里' }), resolve(outDir, 'xiaohongshu-03.png'), { width: 1080, height: 1440 });
await shotCard(poster, cardHtml({ kicker: '白噪音', title: '雨声风声', image: shotUri('noise.png'), note: '车里或书桌都能垫着' }), resolve(outDir, 'xiaohongshu-04.png'), { width: 1080, height: 1440 });
await shotCard(poster, cardHtml({ kicker: '桌面', title: '手机和电脑<br>是同一个', image: shotUri('desktop.png'), kind: 'desktop' }), resolve(outDir, 'xiaohongshu-05.png'), { width: 1080, height: 1440 });
await shotCard(poster, cardHtml({ kicker: '开始用', title: '加到主屏幕', kind: 'steps' }), resolve(outDir, 'xiaohongshu-06.png'), { width: 1080, height: 1440 });
await shotCard(poster, coverHtml(home), resolve(outDir, 'bilibili-cover.png'), { width: 1920, height: 1080 });
await poster.close();
await browser.close();

writeFileSync(resolve(outDir, 'copy.md'), `# 发布文案

## 小红书

**标题：** 蔚来播客网页版，打开就能听

给官方播客做了个网页播放器，手机电脑都能用，不用装商店里的 App。

今天更新什么，打开就能看到。
听到一半关掉，进度还在自己设备上。
想留着的丢进稍后播放。
白噪音也能垫着通勤或书桌。

安卓：浏览器菜单 → 添加到主屏幕
iPhone：分享 → 添加到主屏幕

https://nio.k4le.top/

#蔚来 #NIO #播客 #车机 #白噪音

图按 \`xiaohongshu-01.png\` 到 \`06.png\` 顺序上传。

## B 站

**标题：** 蔚来播客，打开就能听｜NIO Radio 网页播放器

**封面：** \`bilibili-cover.png\`

手机和电脑都能用的 NIO 播客播放器。每日更新目录，进度和稍后播放存在本地，可以加到主屏幕。

打开：https://nio.k4le.top/
安卓在浏览器里安装；iPhone 用分享添加到主屏幕。

标签：蔚来、NIO、播客、PWA
`);
