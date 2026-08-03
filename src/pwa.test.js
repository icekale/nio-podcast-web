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
    expect(viteConfig).toContain("handler: 'CacheFirst'");
    expect(viteConfig).toContain("cacheName: 'nio-artwork-v1'");
    expect(viteConfig).toContain('maxEntries: 150');
    expect(viteConfig).toContain('maxAgeSeconds: 30 * 24 * 60 * 60');
  });

  it('does not configure a service-worker audio runtime cache', () => {
    expect(viteConfig).not.toMatch(/runtimeCaching[\s\S]*audio/i);
  });
});

describe('NIO icon resources', () => {
  it('uses a self-contained 512px NIO SVG', () => {
    expect(favicon).toContain('viewBox="0 0 512 512"');
    expect(favicon).toMatch(/<rect[^>]*width="512"[^>]*height="512"[^>]*fill="#00BEBE"/);
    expect(favicon).toMatch(/<path[^>]*fill="#FFFFFF"/);
    expect(favicon).not.toContain('<image');
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

  it('keeps the installed app chrome aligned with the teal light interface', () => {
    expect(indexHtml).toContain('<meta name="theme-color" content="#00BEBE" />');
    expect(viteConfig).toContain("background_color: '#ffffff'");
    expect(viteConfig).toContain("theme_color: '#00BEBE'");
  });

  it('keeps the primary hover label readable', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8'))
      .toContain('.primary-button:hover { background: var(--teal-dark); color: var(--surface); }');
  });
});

describe('custom domain deployment', () => {
  it('uses a relative base and publishes the GitHub Pages domain marker', () => {
    expect(viteConfig).toContain("base: './'");
    expect(viteConfig).toContain("id: './'");
    expect(viteConfig).toContain("start_url: './'");
    expect(viteConfig).toContain("scope: './'");
    expect(readFileSync(resolve(process.cwd(), 'public/CNAME'), 'utf8').trim()).toBe('nio.k4le.top');
  });
});

describe('home-screen icon fallbacks', () => {
  it('ships NIO-colored PNGs for Chrome install prompts', () => {
    for (const [path, size] of [['public/icon-180.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512]]) {
      expect(readPngSummary(path)).toEqual({ width: size, height: size, firstPixel: [0, 190, 190, 255] });
    }
  });
});
