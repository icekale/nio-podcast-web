import { useEffect, useState } from 'react';

const ALBUM_PAGE_SIZE = 100;

export function useVisibleAlbums(albums, pageSize = ALBUM_PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => setVisibleCount(pageSize), [albums, pageSize]);
  return {
    visibleAlbums: albums.slice(0, visibleCount),
    hasMore: visibleCount < albums.length,
    loadMore: () => setVisibleCount(count => Math.min(count + pageSize, albums.length)),
  };
}
