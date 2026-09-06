import { useCallback, useEffect, useRef, useState } from 'react';

const ALBUM_PAGE_SIZE = 100;

export function useLoadMoreOnView(enabled, onLoadMore, resetKey) {
  const sentinelRef = useRef(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore();
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, resetKey]);
  return sentinelRef;
}

export function useVisibleAlbums(albums, pageSize = ALBUM_PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => setVisibleCount(pageSize), [albums, pageSize]);
  const hasMore = visibleCount < albums.length;
  const loadMore = useCallback(() => {
    setVisibleCount(count => Math.min(count + pageSize, albums.length));
  }, [albums.length, pageSize]);
  const sentinelRef = useLoadMoreOnView(hasMore, loadMore, visibleCount);
  return {
    visibleAlbums: albums.slice(0, visibleCount),
    hasMore,
    loadMore,
    sentinelRef,
  };
}
