import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVisibleAlbums } from './useVisibleAlbums';

describe('useVisibleAlbums', () => {
  it('pages by the given size', () => {
    const albums = Array.from({ length: 25 }, (_, index) => index);
    const { result } = renderHook(() => useVisibleAlbums(albums, 20));
    expect(result.current.visibleAlbums).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(result.current.visibleAlbums).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
  });

  it('defaults to 100 items', () => {
    const albums = Array.from({ length: 101 }, (_, index) => index);
    const { result } = renderHook(() => useVisibleAlbums(albums));
    expect(result.current.visibleAlbums).toHaveLength(100);
    expect(result.current.hasMore).toBe(true);
  });
});
