import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.js'), 'utf8');
const favicon = readFileSync(resolve(process.cwd(), 'public/favicon.svg'), 'utf8');
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function readPngSummary(path) {
  const data = readFileSync(resolve(process.cwd(), path));
  let offset = 8;
  let header = null;
  const imageData = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4) };
    if (type === 'IDAT') imageData.push(chunk);
    offset += length + 12;
  }
  const scanline = inflateSync(Buffer.concat(imageData));
  return { ...header, firstPixel: [...scanline.subarray(1, 5)] };
}

describe('PWA cache boundaries', () => {
  it('lets local storage own catalog fallback and bounds artwork runtime caching', () => {
    expect(viteConfig).toContain("globPatterns: ['**/*.{js,css,html,ico,png,svg}']");
    expect(viteConfig).toContain("url.pathname.endsWith('/data/albums.json')");
    expect(viteConfig).not.toContain("handler: 'NetworkFirst'");
    expect(viteConfig).not.toContain("cacheName: 'nio-catalog-v1'");
    expect(viteConfig).not.toContain("handler: 'CacheFirst'");
    expect(viteConfig).toContain("handler: 'StaleWhileRevalidate'");
    expect(viteConfig).toContain("cacheName: 'nio-artwork-v1'");
    expect(viteConfig).toContain('maxEntries: 700');
    expect(viteConfig).toContain('maxAgeSeconds: 30 * 24 * 60 * 60');
  });

  it('does not configure a service-worker audio runtime cache', () => {
    expect(viteConfig).not.toMatch(/runtimeCaching[\s\S]*audio/i);
  });
});

describe('NIO icon resources', () => {
  it('uses a self-contained 512px black-on-white NIO SVG', () => {
    expect(favicon).toContain('viewBox="0 0 512 512"');
    expect(favicon).toMatch(/<rect[^>]*width="512"[^>]*height="512"[^>]*rx="114"[^>]*fill="#FFFFFF"/);
    expect(favicon).toMatch(/<path[^>]*fill="#000000"/);
    expect(favicon).not.toContain('#00BEBE');
    expect(favicon).not.toContain('<image');
    expect(readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')).toContain('.desktop-nav-brand img { border-radius: 22.5%; }');
  });

  it('references the canonical SVG from the browser and PWA metadata', () => {
    expect(indexHtml).toContain('href="%BASE_URL%favicon.svg"');
    expect(viteConfig).toContain("{ src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }");
  });
});

describe('public app naming', () => {
  it('uses NIO Radio consistently across browser and PWA metadata', () => {
    expect(indexHtml).toContain('<title>NIO Radio</title>');
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="NIO Radio"');
    expect(viteConfig).toContain("name: 'NIO Radio'");
    expect(viteConfig).toContain("short_name: 'NIO Radio'");
  });

  it('keeps installed system bars aligned with the app surface', () => {
    expect(indexHtml).toContain("matchMedia('(prefers-color-scheme: dark)')");
    expect(indexHtml).toContain('document.write');
    expect(indexHtml).toContain('#101a27');
    expect(indexHtml).toContain('black-translucent');
    expect(indexHtml).not.toMatch(/<meta name="theme-color" content="#ffffff" \/>/);
    expect(viteConfig).toContain("background_color: '#ffffff'");
    expect(viteConfig).not.toContain("theme_color: '#ffffff'");
    expect(viteConfig).toContain('delete manifest.theme_color');
  });

  it('uses a system CJK stack without webfonts or SF Pro Text', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
    expect(css).toContain('--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif');
    expect(css).toContain('font-family: var(--font-sans)');
    expect(css).toContain('font-synthesis: none');
    expect(css).toContain('.episode-meta, .queue-copy span { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; margin-top: var(--space-2); color: var(--muted); font-size: 0.78rem; line-height: 1.25; font-variant-numeric: tabular-nums; }');
    expect(css).not.toContain('SF Pro Text');
    expect(css).not.toContain('fonts.googleapis.com');
    const promo = readFileSync(resolve(process.cwd(), 'scripts/capture-promo.mjs'), 'utf8');
    expect(promo).toContain('"PingFang SC"');
    expect(promo).toContain('"Noto Sans SC"');
    expect(promo).not.toContain('SF Pro Text');
  });

  it('keeps the primary hover label readable', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8'))
      .toContain('.primary-button:hover { background: var(--teal-dark); color: var(--surface); }');
  });

  it('resets iOS search chrome and tap highlight', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
    expect(css).toContain('input[type="search"] { -webkit-appearance: none; appearance: none; }');
    expect(css).toContain('-webkit-tap-highlight-color: transparent');
  });

  it('pads the desktop shell for iPad safe areas', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
    expect(css).toContain('padding: max(var(--space-5), env(safe-area-inset-top))');
  });

  it('ships iPhone startup images for light and dark', () => {
    expect(indexHtml).toContain('rel="apple-touch-startup-image"');
    expect(indexHtml).toContain('prefers-color-scheme: dark');
    expect(indexHtml).toContain('splash-1170x2532.png');
    expect(indexHtml).toContain('splash-1170x2532-dark.png');
  });
});

describe('custom domain deployment', () => {
  it('uses a root base so history routes can load assets', () => {
    expect(viteConfig).toContain("base: '/'");
    expect(viteConfig).toContain("id: '/'");
    expect(viteConfig).toContain("start_url: '/'");
    expect(viteConfig).toContain("scope: '/'");
    expect(readFileSync(resolve(process.cwd(), 'public/CNAME'), 'utf8').trim()).toBe('nio.k4le.top');
  });

  it('copies index.html to 404.html for GitHub Pages history fallback', () => {
    expect(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).toContain('cp dist/index.html dist/404.html');
    expect(readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8')).toContain('not_found_handling = "single-page-application"');
  });
});

describe('home-screen icon fallbacks', () => {
  it('ships black NIO logos on white PNG backgrounds', () => {
    for (const [path, size] of [['public/icon-180.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512]]) {
      expect(readPngSummary(path)).toEqual({ width: size, height: size, firstPixel: [255, 255, 255, 255] });
    }
  });
});
