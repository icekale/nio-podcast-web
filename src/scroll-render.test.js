import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
const topBarRule = css.match(/\.top-bar\s*\{([^}]*)\}/)?.[1] || '';
const albumRowRule = css.match(/\.album-results li\s*\{([^}]*)\}/)?.[1] || '';

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

  it('keeps later playback gestures on a bounded paint path', () => {
    expect(css).not.toMatch(/\.later-row[^}]*backdrop-filter\s*:/);
    expect(css).toMatch(/\.queue-tabs[^}]*grid-template-columns:\s*repeat\(3/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
