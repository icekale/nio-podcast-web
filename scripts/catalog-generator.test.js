import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertCatalogScanHasSuccess,
  reconcileFullScan,
  requestAlbum,
  sameCatalogContent,
  scanCatalog,
  sortGeneratedAlbums,
  updateKnownAlbums,
  writeCatalogAtomically,
} from './catalog-generator.js';

describe('catalog generator', () => {
  it('treats an explicit empty upstream result as a missing album', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ result: null }) });
    await expect(requestAlbum(124, fetchImpl)).resolves.toBeNull();
  });

  it('honors the concurrency limit and sorts albums by latest episode', async () => {
    let active = 0;
    let peak = 0;
    const result = await scanCatalog([1, 2, 3, 4, 5], async id => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, id % 2 ? 4 : 1));
      active -= 1;
      return {
        id,
        albumName: `专辑 ${id}`,
        albumDesc: '',
        albumPic: '',
        host: '',
        totalCount: id,
        latestEpisode: { id: id * 10, onlineTime: id },
      };
    }, 2);

    expect(peak).toBeLessThanOrEqual(2);
    expect(result.albums.map(album => album.id)).toEqual([5, 4, 3, 2, 1]);
    expect(result.failedIds).toEqual([]);
    expect(result.missingIds).toEqual([]);
  });

  it('keeps successful albums when one request fails', async () => {
    const result = await scanCatalog([1, 2, 3], async id => {
      if (id === 2) throw new Error('temporary failure');
      return { id, latestEpisode: { id: id * 10, onlineTime: id } };
    }, 2);

    expect(result.albums.map(album => album.id)).toEqual([3, 1]);
    expect(result.failedIds).toEqual([2]);
    expect(result.missingIds).toEqual([]);
  });

  it('reports successful, failed, and explicitly missing album ids separately', async () => {
    const result = await scanCatalog([1, 2, 3], async id => {
      if (id === 2) throw new Error('temporary failure');
      if (id === 3) return null;
      return { id, latestEpisode: { id: 10, onlineTime: id } };
    }, 2);

    expect(result).toEqual({
      albums: [{ id: 1, latestEpisode: { id: 10, onlineTime: 1 } }],
      failedIds: [2],
      missingIds: [3],
    });
  });

  it('passes an abort signal through requestAlbum to fetch', async () => {
    let receivedSignal;
    const signal = new AbortController().signal;
    const fetchImpl = async (_url, options) => {
      receivedSignal = options.signal;
      return { ok: true, json: async () => ({ result: null }) };
    };

    await requestAlbum(124, fetchImpl, signal);

    expect(receivedSignal).toBe(signal);
  });

  it('aborts a timed out request before recording the failed id', async () => {
    let receivedSignal;
    const request = (_id, signal) => new Promise((resolve, reject) => {
      receivedSignal = signal;
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });

    const result = await scanCatalog([1], request, 1, 5);

    expect(result).toMatchObject({ albums: [], failedIds: [1], missingIds: [] });
    expect(receivedSignal.aborted).toBe(true);
  });

  it('merges refreshed known albums while preserving failed requests', async () => {
    const previous = [
      { id: 1, name: '旧专辑', latestEpisode: { id: 11, onlineTime: 1 } },
      { id: 2, name: '保留专辑', latestEpisode: { id: 22, onlineTime: 2 } },
    ];
    const requestAlbum = async id => {
      if (id === 2) throw new Error('temporary failure');
      return { id: 1, name: '新专辑', latestEpisode: { id: 12, onlineTime: 3 } };
    };

    await expect(updateKnownAlbums(previous, requestAlbum, 2)).resolves.toEqual([
      { id: 1, name: '新专辑', latestEpisode: { id: 12, onlineTime: 3 } },
      { id: 2, name: '保留专辑', latestEpisode: { id: 22, onlineTime: 2 } },
    ]);
  });

  it('does not treat an empty known-album response as deletion', async () => {
    const previous = [{ id: 1, name: '旧专辑', latestEpisode: { id: 11, onlineTime: 1 } }];
    await expect(updateKnownAlbums(previous, async () => null)).resolves.toEqual(previous);
  });

  it('rejects a scan where every requested album failed', () => {
    expect(() => assertCatalogScanHasSuccess(
      [{ id: 1, latestEpisode: { id: 11, onlineTime: 1 } }],
      { albums: [], failedIds: [1], missingIds: [] },
    )).toThrow('no successful albums');
  });

  it('reconciles a full scan by preserving failures and removing explicit missing albums', () => {
    const previous = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      latestEpisode: { id: index + 11, onlineTime: index + 1 },
    }));
    const result = reconcileFullScan(previous, {
      albums: [{ id: 1, latestEpisode: { id: 12, onlineTime: 4 } }],
      failedIds: [2, 4, 5, 6, 7, 8, 9, 10],
      missingIds: [3],
    });

    expect(result.albums.map(album => album.id)).toEqual([10, 9, 8, 7, 6, 5, 1, 4, 2]);
    expect(result.stats).toEqual({ discovered: 1, preserved: 8, missing: 1, failed: 8 });
  });

  it('rejects a full scan that removes more than ten percent of the previous catalog', () => {
    const previous = Array.from({ length: 10 }, (_, index) => ({ id: index + 1 }));
    expect(() => reconcileFullScan(previous, {
      albums: [{ id: 1, latestEpisode: { id: 10, onlineTime: 1 } }],
      failedIds: [],
      missingIds: Array.from({ length: 9 }, (_, index) => index + 2),
    })).toThrow('more than 10%');
  });

  it('compares catalog content without generatedAt', () => {
    expect(sameCatalogContent(
      { generatedAt: 1, albums: [{ id: 1 }] },
      { generatedAt: 2, albums: [{ id: 1 }] },
    )).toBe(true);
    expect(sameCatalogContent(
      { generatedAt: 1, albums: [{ id: 1 }] },
      { generatedAt: 2, albums: [{ id: 2 }] },
    )).toBe(false);
  });

  it('uses album id as a stable tie-breaker for equal publish times', () => {
    expect(sortGeneratedAlbums([
      { id: 3, latestEpisode: { onlineTime: 10 } },
      { id: 1, latestEpisode: { onlineTime: 10 } },
    ]).map(album => album.id)).toEqual([1, 3]);
  });

  it('keeps the existing file when the final rename fails', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'nio-catalog-'));
    const target = join(folder, 'albums.json');
    await writeFile(target, 'previous catalog', 'utf8');

    await expect(writeCatalogAtomically(target, { generatedAt: 1, albums: [] }, async () => {
      throw new Error('rename failed');
    })).rejects.toThrow('rename failed');

    await expect(readFile(target, 'utf8')).resolves.toBe('previous catalog');
  });
});
