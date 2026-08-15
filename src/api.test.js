import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_WHITE_NOISE_ALBUM_ID } from './customAlbums';

const responseFor = result => ({
  ok: true,
  json: async () => ({ result }),
});

let api;
beforeEach(async () => {
  vi.resetModules();
  api = await import('./api');
});

describe('audio API boundary', () => {
  it('normalizes CDN audio URLs to HTTPS', () => {
    expect(api.normalizeAudioUrl('http://cdn.example/audio.aac')).toBe('https://cdn.example/audio.aac');
    expect(api.normalizeAudioUrl('')).toBe('');
  });

  it('maps episode fields and pagination from the public API', async () => {
    const fetchImpl = async () => responseFor({
      totalCount: 31,
      haveNext: 1,
      dataList: [{
        audioId: 9,
        audioName: '测试节目',
        albumId: 5,
        albumName: '测试专辑',
        albumPic: 'https://cdn.example/cover.jpg',
        host: ['NIO Radio'],
        duration: 125000,
        onlineTime: 1700000000000,
        aacPlayUrl192: 'http://cdn.example/audio.aac',
      }],
    });

    await expect(api.getEpisodes(5, 1, 30, fetchImpl)).resolves.toEqual({
      episodes: [{
        id: 9,
        title: '测试节目',
        albumId: 5,
        albumName: '测试专辑',
        albumPic: 'https://cdn.example/cover.jpg',
        albumDesc: '',
        host: 'NIO Radio',
        duration: 125000,
        onlineTime: 1700000000000,
        audioUrl: 'https://cdn.example/audio.aac',
        fileSize: undefined,
      }],
      totalCount: 31,
      hasMore: true,
    });
  });

  it('accepts a string host from the upstream API', async () => {
    const fetchImpl = async () => responseFor({
      dataList: [{ audioId: 10, audioName: '字符串主播', host: 'NIO Radio', duration: 60000 }],
      totalCount: 1,
      haveNext: 0,
    });

    await expect(api.getEpisodes(6, 1, 30, fetchImpl)).resolves.toMatchObject({
      episodes: [{ id: 10, host: 'NIO Radio' }],
    });
  });

  it('returns custom episodes without calling the NIO API', async () => {
    const fetchImpl = vi.fn();

    const result = await api.getEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 1, 30, fetchImpl);

    expect(result.episodes).toHaveLength(30);
    expect(result.episodes[0].title).toBe('小雨');
    expect(result.totalCount).toBe(113);
    expect(result.hasMore).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces HTTP failures as typed errors', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    await expect(api.getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  });

  it('surfaces malformed responses instead of returning an empty success', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ nope: true }) });
    await expect(api.getEpisodes(5, 1, 30, fetchImpl)).rejects.toBeInstanceOf(api.ApiError);
  });

  it('deduplicates concurrent identical episode requests', async () => {
    let calls = 0;
    let release;
    const fetchImpl = () => {
      calls += 1;
      return new Promise(resolve => {
        release = () => resolve(responseFor({ dataList: [], totalCount: 0, haveNext: 0 }));
      });
    };

    const first = api.getEpisodes(5, 1, 30, fetchImpl);
    const second = api.getEpisodes(5, 1, 30, fetchImpl);
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { episodes: [], totalCount: 0, hasMore: false },
      { episodes: [], totalCount: 0, hasMore: false },
    ]);
    expect(calls).toBe(1);
  });

  it('uses a successful result for ten minutes and refetches after expiry', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetchImpl = async () => {
        calls += 1;
        return responseFor({ dataList: [], totalCount: 0, haveNext: 0 });
      };

      await api.getEpisodes(5, 1, 30, fetchImpl);
      await api.getEpisodes(5, 1, 30, fetchImpl);
      expect(calls).toBe(1);

      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      await api.getEpisodes(5, 1, 30, fetchImpl);
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cache rejected requests', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return { ok: false, status: 503 };
    };

    await expect(api.getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    await expect(api.getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    expect(calls).toBe(2);
  });

  it('evicts the oldest episode page after the cache limit', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return responseFor({ dataList: [], totalCount: 0, haveNext: 0 });
    };

    for (let page = 1; page <= 100; page += 1) await api.getEpisodes(5, page, 30, fetchImpl);
    await api.getEpisodes(5, 101, 30, fetchImpl);
    await api.getEpisodes(5, 1, 30, fetchImpl);

    expect(calls).toBe(102);
  });
});
