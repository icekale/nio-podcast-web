import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
const topBarRule = css.match(/\.top-bar\s*\{([^}]*)\}/)?.[1] || '';
const albumRowRule = css.match(/\.album-results li\s*\{([^}]*)\}/)?.[1] || '';
const laterSwipeRule = css.match(/\.later-swipe-action\s*\{([^}]*)\}/)?.[1] || '';

describe('mobile scroll rendering', () => {
  it('keeps album rows on the normal paint path during fast scrolling', () => {
    expect(albumRowRule).not.toMatch(/content-visibility\s*:/);
  });

  it('keeps the sticky title on an opaque compositing surface', () => {
    expect(topBarRule).not.toMatch(/backdrop-filter\s*:/);
    expect(topBarRule).toMatch(/background:\s*var\(--surface\)/);
  });

  it('defines bounded route and queue motion with reduced-motion coverage', () => {
    expect(css).toMatch(/@keyframes route-forward-in/);
    expect(css).toMatch(/@keyframes route-back-in/);
    expect(css).toMatch(/@keyframes queue-sheet-in/);
    expect(css).toMatch(/@keyframes queue-sheet-out/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/\.route-view[^}]*\bwill-change\s*:/);
  });

  it('uses the calmer route and queue motion cadence', () => {
    expect(css).toContain('.route-view[data-route-motion="forward"] { animation: route-forward-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }');
    expect(css).toContain('.route-view[data-route-motion="back"] { animation: route-back-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }');
    expect(css).toContain('animation: queue-backdrop-in 220ms ease-out both;');
    expect(css).toContain('animation: queue-sheet-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;');
    expect(css).toContain('.queue-sheet.is-closing { animation: queue-sheet-out 240ms cubic-bezier(0.4, 0, 0.2, 1) both; }');
    expect(css).toContain('.queue-overlay.is-closing .queue-backdrop { animation: queue-backdrop-out 180ms cubic-bezier(0.4, 0, 0.2, 1) both; }');
  });

  it('keeps later playback gestures on a bounded paint path', () => {
    expect(css).not.toMatch(/\.later-row[^}]*backdrop-filter\s*:/);
    expect(css).toMatch(/\.queue-tabs[^}]*grid-template-columns:\s*repeat\(3/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('keeps the remove action hidden until a row is swiped', () => {
    expect(laterSwipeRule).toMatch(/transform:\s*translateX\(100%\)/);
    expect(laterSwipeRule).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/\.later-row\.is-swiped \.later-swipe-action\s*\{[^}]*transform:\s*translateX\(0\)/);
  });

  it('allows the mobile shell to shrink for 200% text zoom', () => {
    expect(css).not.toMatch(/body\s*\{[^}]*min-width:\s*320px/);
    expect(css).toMatch(/@media\s*\(max-width:\s*359px\)[\s\S]*\.recommendation-panel[^}]*grid-template-columns:\s*1fr/);
  });

  it('keeps large album lists progressively rendered', () => {
    expect(css).toMatch(/\.album-results-more\s+button/);
  });

  it('defines the desktop shell, album grid, and queue drawer', () => {
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)/);
    expect(css).toMatch(/\.desktop-nav\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.app\s*\{[^}]*max-width:\s*1280px/);
    expect(css).toMatch(/\.desktop-nav\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.home-screen \.recommendation-art\s*\{[^}]*width:\s*4rem/);
    expect(css).toMatch(/\.album-results\.is-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(170px,\s*1fr\)\)/);
    expect(css).toMatch(/\.queue-sheet\s*\{[^}]*width:\s*380px/);
    expect(css).toMatch(/@keyframes queue-sheet-in\s*\{[^}]*translate3d\(100%,\s*0,\s*0\)/);
    expect(css).toMatch(/\.home-screen \.top-bar \.icon-button:first-child,\s*\.home-screen \.top-bar \.top-actions \.icon-button\s*\{[^}]*display:\s*none/);
  });
});
