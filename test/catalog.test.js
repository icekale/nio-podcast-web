import { describe, expect, it, vi } from 'vitest';
import { loadCatalog, selectHomeEpisodes, sortAlbumsByLatest, sortAlbumsForDirectory, writeCatalogCache } from '../utils/catalog';

const episode = (id, onlineTime, title = `节目 ${id}`) => ({
  id,
  title,
  onlineTime,
  duration: 120000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

describe('catalog selectors', () => {
  it('sorts albums by the latest episode time without mutating input', () => {
    const albums = [
      { id: 1, latestEpisode: episode(11, 1) },
      { id: 2, latestEpisode: episode(22, 2) },
    ];
    expect(sortAlbumsByLatest(albums).map(album => album.id)).toEqual([2, 1]);
    expect(albums.map(album => album.id)).toEqual([1, 2]);
  });

  it('orders equal update times by album id', () => {
    const albums = [
      { id: 20, latestEpisode: episode(20, 2) },
      { id: 5, latestEpisode: episode(5, 2) },
      { id: 1, latestEpisode: episode(1, 3) },
    ];

    expect(sortAlbumsByLatest(albums).map(album => album.id)).toEqual([1, 5, 20]);
  });

  it('pins the briefing albums ahead of latest-updated albums for the directory', () => {
    const albums = [
      { id: 7, name: '普通专辑', latestEpisode: episode(71, 400) },
      { id: 23, name: '资讯充电站·晚间版', latestEpisode: episode(231, 100) },
      { id: 5, name: '资讯充电站·早间版', latestEpisode: episode(51, 200) },
      { id: 1, name: '旧专辑', latestEpisode: episode(11, 300) },
    ];

    expect(sortAlbumsForDirectory(albums).map(album => album.id)).toEqual([5, 23, 7, 1]);
  });

  it('selects up to twelve episodes published on the requested day', () => {
    const day = new Date('2026-08-02T10:00:00+08:00');
    const albums = Array.from({ length: 14 }, (_, index) => ({
      id: index,
      latestEpisode: episode(index, day.getTime() - index * 60000),
    }));
    const result = selectHomeEpisodes(albums, day);
    expect(result.heading).toBe('今日更新');
    expect(result.episodes).toHaveLength(12);
  });

  it('falls back to latest updates when today has no episodes', () => {
    const albums = [
      { id: 1, latestEpisode: episode(11, new Date('2026-07-31T10:00:00+08:00').getTime()) },
      { id: 2, latestEpisode: episode(22, new Date('2026-07-30T10:00:00+08:00').getTime()) },
    ];
    const result = selectHomeEpisodes(albums, new Date('2026-08-02T10:00:00+08:00'));
    expect(result.heading).toBe('最新更新');
    expect(result.episodes.map(item => item.id)).toEqual([11, 22]);
  });

  it('deduplicates the same latest episode mirrored by multiple albums', () => {
    const albums = [
      { id: 2, latestEpisode: episode(42, 3, '同一节目') },
      { id: 1, latestEpisode: episode(42, 2, '同一节目') },
      { id: 3, latestEpisode: episode(43, 1, '另一个节目') },
    ];

    const result = selectHomeEpisodes(albums, new Date(3));

    expect(result.episodes.map(item => item.id)).toEqual([42, 43]);
  });

  it('uses the browser cache policy for the static catalog', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('/nio-podcast-web/data/albums.json');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.cache).toBe('no-cache');
      return {
        ok: true,
        json: async () => ({ generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: episode(1, 1) }] }),
      };
    });

    await loadCatalog(fetchImpl, '/nio-podcast-web/');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reuses a fresh local catalog without another network request', async () => {
    const catalog = { generatedAt: Date.now(), albums: [{ id: 1, name: '缓存目录', latestEpisode: episode(1, 1) }] };
    writeCatalogCache(catalog);
    const fetchImpl = vi.fn();

    await expect(loadCatalog(fetchImpl, '/nio-podcast-web/')).resolves.toMatchObject({ catalog: expect.objectContaining({ generatedAt: catalog.generatedAt }), cached: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('times out a stalled catalog request', async () => {
    vi.useFakeTimers();
    window.localStorage.removeItem('nio_catalog_cache_v1');
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    }));

    const pending = loadCatalog(fetchImpl, '/nio-podcast-web/');
    const assertion = expect(pending).rejects.toThrow('目录加载超时');
    await vi.advanceTimersByTimeAsync(8001);

    await assertion;
    vi.useRealTimers();
  });
});
