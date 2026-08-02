import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { requestAlbum, scanCatalog, writeCatalogAtomically } from './catalog-generator.js';

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
    expect(result.map(album => album.id)).toEqual([5, 4, 3, 2, 1]);
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
