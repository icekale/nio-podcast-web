import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.js'), 'utf8');
const favicon = readFileSync(resolve(process.cwd(), 'public/favicon.svg'), 'utf8');
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('PWA cache boundaries', () => {
  it('precaches the static catalog and bounds artwork runtime caching', () => {
    expect(viteConfig).toContain("globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']");
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
});
