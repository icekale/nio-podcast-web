import { useEffect, useState } from 'react';

const ALBUM_PAGE_SIZE = 100;

export function useVisibleAlbums(albums) {
  const [visibleCount, setVisibleCount] = useState(ALBUM_PAGE_SIZE);
  useEffect(() => setVisibleCount(ALBUM_PAGE_SIZE), [albums]);
  return {
    visibleAlbums: albums.slice(0, visibleCount),
    hasMore: visibleCount < albums.length,
    loadMore: () => setVisibleCount(count => Math.min(count + ALBUM_PAGE_SIZE, albums.length)),
  };
}
