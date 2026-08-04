import { beforeEach, describe, expect, it } from 'vitest';
import { FAVORITE_ALBUMS_STORAGE_KEY, readFavoriteAlbums, toggleFavoriteAlbum, writeFavoriteAlbums } from './favoriteAlbums';

describe('favorite albums storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to an empty list', () => {
    expect(readFavoriteAlbums()).toEqual([]);
  });

  it('reads persisted ids and drops invalid or duplicate entries', () => {
    window.localStorage.setItem(FAVORITE_ALBUMS_STORAGE_KEY, JSON.stringify([2, '2', 'x', null, 3]));
    expect(readFavoriteAlbums()).toEqual([2, 3]);
  });

  it('toggles an album to the front and back off', () => {
    expect(toggleFavoriteAlbum([], 5)).toEqual({ ids: [5], favorited: true });
    expect(toggleFavoriteAlbum([5, 3], 2)).toEqual({ ids: [2, 5, 3], favorited: true });
    expect(toggleFavoriteAlbum([2, 5, 3], 5)).toEqual({ ids: [2, 3], favorited: false });
    expect(toggleFavoriteAlbum([1], 'x')).toEqual({ ids: [1], favorited: false });
  });

  it('round-trips through local storage', () => {
    expect(writeFavoriteAlbums([3, 1])).toBe(true);
    expect(readFavoriteAlbums()).toEqual([3, 1]);
  });
});
