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
    const fetchImpl = vi.fn(async (_url, options) => {
      const body = new URLSearchParams(options.body);
      expect(options.method).toBe('POST');
      expect(body.get('albumId')).toBe('5');
      expect(body.get('sorttype')).toBe('2');
      expect(body.get('pagenum')).toBe('1');
      expect(body.get('pageSize')).toBe('30');
      expect(body.get('pagesize')).toBeNull();
      expect(body.get('pageNum')).toBeNull();
      return responseFor({
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

  it('maps the dynamic daytime radio list and update identifiers', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('https://gateway-front-external.nio.com/moat/100914/v3/radio/list?pageSize=87');
      expect(url).toContain('pageSize=87');
      expect(options.method).toBe('GET');
      return {
        ok: true,
        json: async () => ({
          result: [{
            hasNextPage: 1,
            clockId: 1,
            albumId: 0,
            albumName: null,
            albumPic: null,
            albumDesc: null,
            audioId: 297,
            audioName: 'Be Okay My Station',
            audioPic: 'https://cdn.example/audio-cover.jpg',
            singer: 'NIO Radio',
            host: ['NIO Radio'],
            duration: 12000,
            updateTime: 1700000000000,
            aacPlayUrl192: 'http://cdn.example/daytime.aac',
            aacFileSize192: 297200,
            dcvId: null,
          }],
          other: { dcvId: { date: '2026-08-27', schemeId: 149 } },
        }),
      };
    });

    await expect(api.getDaytimeEpisodes(fetchImpl)).resolves.toEqual({
      episodes: [{
        id: 297,
        title: 'Be Okay My Station',
        albumId: 0,
        albumName: '',
        albumPic: 'https://cdn.example/audio-cover.jpg',
        albumDesc: '',
        host: 'NIO Radio',
        duration: 12000,
        onlineTime: 1700000000000,
        audioUrl: 'https://cdn.example/daytime.aac',
        fileSize: 297200,
      }],
      date: '2026-08-27',
      schemeId: 149,
      clockId: 1,
    });
  });

  it('keeps the previous daytime list when a later page is suspiciously short', async () => {
    vi.useFakeTimers();
    try {
      const longList = Array.from({ length: 40 }, (_, index) => ({ audioId: index + 1, audioName: `节目${index + 1}` }));
      const shortList = Array.from({ length: 19 }, (_, index) => ({ audioId: 100 + index, audioName: `短${index}` }));
      const fetchImpl = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: longList, other: { dcvId: { date: '2026-08-28', schemeId: 151 } } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ result: shortList, other: { dcvId: { date: '2026-08-28', schemeId: 151 } } }) });

      const first = await api.getDaytimeEpisodes(fetchImpl);
      expect(first.episodes).toHaveLength(40);

      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      const second = await api.getDaytimeEpisodes(fetchImpl);
      expect(second.episodes).toHaveLength(40);
      expect(second.episodes[0].id).toBe(1);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects malformed daytime responses', async () => {
    const fetchImpl = async () => responseFor({ dataList: [] });
    await expect(api.getDaytimeEpisodes(fetchImpl)).rejects.toBeInstanceOf(api.ApiError);
  });

  it('refreshes daytime data after the successful cache expires', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn()
        .mockResolvedValueOnce(responseFor([{ audioId: 1, audioName: '第一天', dcvId: { date: '2026-08-27', schemeId: 149 }, clockId: 1 }]))
        .mockResolvedValueOnce(responseFor([{ audioId: 2, audioName: '第二天', dcvId: { date: '2026-08-28', schemeId: 150 }, clockId: 1 }]));

      await expect(api.getDaytimeEpisodes(fetchImpl)).resolves.toMatchObject({ date: '2026-08-27', schemeId: 149 });
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      await expect(api.getDaytimeEpisodes(fetchImpl)).resolves.toMatchObject({ date: '2026-08-28', schemeId: 150 });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates concurrent daytime requests', async () => {
    let release;
    const fetchImpl = vi.fn(() => new Promise(resolve => {
      release = () => resolve(responseFor([{ audioId: 1, audioName: '日间节目' }]));
    }));

    const first = api.getDaytimeEpisodes(fetchImpl);
    const second = api.getDaytimeEpisodes(fetchImpl);
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { episodes: [{ id: 1, title: '日间节目', albumId: undefined, albumName: '', albumPic: '', albumDesc: '', host: '', duration: undefined, onlineTime: undefined, audioUrl: '', fileSize: undefined }], date: '', schemeId: undefined, clockId: undefined },
      { episodes: [{ id: 1, title: '日间节目', albumId: undefined, albumName: '', albumPic: '', albumDesc: '', host: '', duration: undefined, onlineTime: undefined, audioUrl: '', fileSize: undefined }], date: '', schemeId: undefined, clockId: undefined },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
