import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function pngSize(path) {
  const data = readFileSync(path);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe('social promo assets', () => {
  it('ships six Xiaohongshu 1080x1440 cards and a 1920x1080 Bilibili cover', () => {
    const cards = [1, 2, 3, 4, 5, 6].map(index => resolve(process.cwd(), `docs/promo/xiaohongshu-0${index}.png`));
    const cover = resolve(process.cwd(), 'docs/promo/bilibili-cover.png');
    for (const path of cards) {
      expect(existsSync(path), path).toBe(true);
      expect(pngSize(path)).toEqual({ width: 1080, height: 1440 });
    }
    expect(existsSync(cover)).toBe(true);
    expect(pngSize(cover)).toEqual({ width: 1920, height: 1080 });
    expect(readFileSync(resolve(process.cwd(), 'docs/promo/copy.md'), 'utf8')).toContain('https://nio.k4le.top/');
  });
});
