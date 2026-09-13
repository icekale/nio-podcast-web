import { beforeEach, describe, expect, it } from 'vitest';
import { ALBUM_SEEN_STORAGE_KEY, readAlbumsSeenAt, writeAlbumsSeenAt } from './albumSeen';

describe('album seen watermark', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to zero so nothing counts as an update yet', () => {
    expect(readAlbumsSeenAt()).toBe(0);
  });

  it('round-trips a timestamp', () => {
    writeAlbumsSeenAt(1735660800000);
    expect(window.localStorage.getItem(ALBUM_SEEN_STORAGE_KEY)).toBe('1735660800000');
    expect(readAlbumsSeenAt()).toBe(1735660800000);
  });

  it('treats garbage and negative values as never visited', () => {
    window.localStorage.setItem(ALBUM_SEEN_STORAGE_KEY, 'not-a-number');
    expect(readAlbumsSeenAt()).toBe(0);
    window.localStorage.setItem(ALBUM_SEEN_STORAGE_KEY, '-5');
    expect(readAlbumsSeenAt()).toBe(0);
  });

  it('survives unavailable storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readAlbumsSeenAt(broken)).toBe(0);
    expect(writeAlbumsSeenAt(1, broken)).toBe(false);
  });
});
