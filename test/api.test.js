import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, clearEpisodeCache, getEpisodes, normalizeAudioUrl } from '../utils/api';

function responseFor(data) {
  return { statusCode: 200, data };
}

function requestOk(payload) {
  return async () => responseFor(payload);
}

describe('api', () => {
  beforeEach(() => clearEpisodeCache());

  it('normalizes http audio urls to https', () => {
    expect(normalizeAudioUrl('http://cdn.example/a.aac')).toBe('https://cdn.example/a.aac');
    expect(normalizeAudioUrl('https://cdn.example/a.aac')).toBe('https://cdn.example/a.aac');
    expect(normalizeAudioUrl('')).toBe('');
  });

  it('maps episode payloads and pagination flags', async () => {
    const payload = {
      result: {
        totalCount: 2,
        haveNext: 1,
        dataList: [{
          audioId: 1, audioName: '第一集', albumId: 5, albumName: '早间版',
          albumPic: 'http://cdn.example/p.jpg', host: ['A', 'B'], singer: 'S',
          duration: 253000, onlineTime: 1785513600000,
          aacPlayUrl192: 'http://cdn.example/1.aac', aacFileSize192: 123,
        }],
      },
    };
    const result = await getEpisodes(5, 1, 30, requestOk(payload));
    expect(result.episodes[0]).toMatchObject({
      id: 1, title: '第一集', albumId: 5, albumName: '早间版',
      host: 'A, B', audioUrl: 'https://cdn.example/1.aac',
    });
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(2);
  });

  it('throws typed errors for http and invalid payloads', async () => {
    await expect(getEpisodes(1, 1, 30, async () => ({ statusCode: 500, data: {} })))
      .rejects.toMatchObject({ name: 'ApiError', code: 'HTTP_ERROR' });
    await expect(getEpisodes(1, 1, 30, async () => ({ statusCode: 200, data: {} })))
      .rejects.toMatchObject({ name: 'ApiError', code: 'INVALID_RESPONSE' });
    await expect(getEpisodes(1, 1, 30, async () => { throw new Error('net'); }))
      .rejects.toMatchObject({ name: 'ApiError', code: 'NETWORK_ERROR' });
  });

  it('deduplicates concurrent identical requests', async () => {
    let calls = 0;
    let release;
    const pending = () => { calls += 1; return new Promise(resolve => { release = () => resolve(responseFor({ result: { dataList: [], totalCount: 0, haveNext: 0 } })); }); };
    const first = getEpisodes(5, 1, 30, pending);
    const second = getEpisodes(5, 1, 30, pending);
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it('reuses a successful result within ten minutes', async () => {
    let calls = 0;
    const ok = () => { calls += 1; return Promise.resolve(responseFor({ result: { dataList: [], totalCount: 0, haveNext: 0 } })); };
    await getEpisodes(5, 1, 30, ok);
    await getEpisodes(5, 1, 30, ok);
    expect(calls).toBe(1);
  });
});
