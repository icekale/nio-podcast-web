import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, clearEpisodeCache, getEpisodes, normalizeAudioUrl } from './api';

const responseFor = result => ({
  ok: true,
  json: async () => ({ result }),
});

describe('audio API boundary', () => {
  beforeEach(() => clearEpisodeCache());

  it('normalizes CDN audio URLs to HTTPS', () => {
    expect(normalizeAudioUrl('http://cdn.example/audio.aac')).toBe('https://cdn.example/audio.aac');
    expect(normalizeAudioUrl('')).toBe('');
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

    await expect(getEpisodes(5, 1, 30, fetchImpl)).resolves.toEqual({
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

  it('surfaces HTTP failures as typed errors', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  });

  it('surfaces malformed responses instead of returning an empty success', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ nope: true }) });
    await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toBeInstanceOf(ApiError);
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

    const first = getEpisodes(5, 1, 30, fetchImpl);
    const second = getEpisodes(5, 1, 30, fetchImpl);
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

      await getEpisodes(5, 1, 30, fetchImpl);
      await getEpisodes(5, 1, 30, fetchImpl);
      expect(calls).toBe(1);

      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      await getEpisodes(5, 1, 30, fetchImpl);
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

    await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    await expect(getEpisodes(5, 1, 30, fetchImpl)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    expect(calls).toBe(2);
  });
});
