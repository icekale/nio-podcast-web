import { describe, expect, it, vi } from 'vitest';
import { loadCatalog, selectHomeEpisodes, sortAlbumsByLatest } from './catalog';

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
