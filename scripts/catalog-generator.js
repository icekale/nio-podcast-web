import { rename, unlink, writeFile } from 'node:fs/promises';
import { normalizeAudioUrl } from '../src/api.js';

const API_URL = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';

function mapEpisode(ep) {
  const host = Array.isArray(ep.host)
    ? ep.host.join(', ')
    : typeof ep.host === 'string'
      ? ep.host
      : '';
  return {
    id: ep.audioId,
    title: ep.audioName || '未命名节目',
    albumId: ep.albumId,
    albumName: ep.albumName || '',
    albumPic: ep.albumPic || '',
    albumDesc: ep.albumDesc || '',
    host: host || ep.singer || '',
    duration: ep.duration,
    onlineTime: ep.onlineTime,
    audioUrl: normalizeAudioUrl(ep.aacPlayUrl192 || ep.aacPlayUrl128 || ep.mp3PlayUrl64 || ''),
    fileSize: ep.aacFileSize192,
  };
}

export function sortGeneratedAlbums(albums) {
  return [...albums].sort((a, b) => {
    const timeDifference = Number(b.latestEpisode?.onlineTime || 0) - Number(a.latestEpisode?.onlineTime || 0);
    if (timeDifference) return timeDifference;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

export function sameCatalogContent(previous, next) {
  return JSON.stringify(previous?.albums || []) === JSON.stringify(next?.albums || []);
}

export function assertCatalogScanHasSuccess(previousAlbums, scanResult) {
  const previous = Array.isArray(previousAlbums) ? previousAlbums : [];
  const albums = Array.isArray(scanResult?.albums) ? scanResult.albums : [];
  const failedIds = Array.isArray(scanResult?.failedIds) ? scanResult.failedIds : [];
  if (previous.length && !albums.length && failedIds.length) {
    throw new Error('Catalog scan returned no successful albums; refusing to publish stale catalog');
  }
}

export async function scanCatalog(ids, requestAlbum, concurrency = 12, requestTimeoutMs = 15000) {
  const found = [];
  const failedIds = [];
  const missingIds = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const controller = new AbortController();
      let timer;
      let timedOut = false;
      const request = Promise.resolve().then(() => requestAlbum(id, controller.signal));
      try {
        const result = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
          ? await Promise.race([
            request,
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
                reject(new Error(`Album ${id}: request timed out`));
              }, requestTimeoutMs);
            }),
          ])
          : await request;
        if (result === null) {
          missingIds.push(id);
        } else if (result?.latestEpisode?.id) {
          found.push(result);
        } else {
          throw new Error(`Album ${id}: invalid request result`);
        }
      } catch (error) {
        failedIds.push(id);
        console.warn(`Skipping album ${id}: ${error.message}`);
      } finally {
        clearTimeout(timer);
        if (timedOut) await request.catch(() => {});
      }
    }
  };
  const workerLimit = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;
  const workerCount = Math.min(workerLimit, ids.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return {
    albums: sortGeneratedAlbums(found),
    failedIds: failedIds.sort((a, b) => Number(a) - Number(b)),
    missingIds: missingIds.sort((a, b) => Number(a) - Number(b)),
  };
}

export function mergeKnownAlbums(previousAlbums, scanResult) {
  const previous = Array.isArray(previousAlbums) ? previousAlbums : [];
  const refreshedById = new Map((scanResult?.albums || []).map(album => [Number(album.id), album]));
  return sortGeneratedAlbums(previous.map(album => refreshedById.get(Number(album.id)) || album));
}

export async function updateKnownAlbums(previousAlbums, requestAlbum, concurrency = 12) {
  const previous = Array.isArray(previousAlbums) ? previousAlbums : [];
  const scanResult = await scanCatalog(previous.map(album => album.id), requestAlbum, concurrency);
  return mergeKnownAlbums(previous, scanResult);
}

export async function requestAlbum(id, fetchImpl = globalThis.fetch, signal) {
  const body = new URLSearchParams({ albumId: String(id), sorttype: '2', pagenum: '1', pagesize: '1' });
  const response = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Album ${id}: HTTP ${response.status}`);
  const result = (await response.json())?.result;
  if (result === null) return null;
  if (!result || !Array.isArray(result.dataList)) throw new Error(`Album ${id}: invalid response`);
  const first = result.dataList[0];
  if (!first) return null;
  const latestEpisode = mapEpisode(first);
  return {
    id: Number(first.albumId || id),
    name: first.albumName || `专辑 ${id}`,
    description: first.albumDesc || '',
    imageUrl: first.albumPic || '',
    host: latestEpisode.host,
    episodeCount: Number(result.totalCount) || 0,
    latestEpisode,
  };
}

export async function buildCatalog(ids, fetchImpl = globalThis.fetch, concurrency = 12) {
  const scanResult = await scanCatalog(ids, (id, signal) => requestAlbum(id, fetchImpl, signal), concurrency);
  return { generatedAt: Date.now(), ...scanResult };
}

export function reconcileFullScan(previousAlbums, scanResult) {
  const previous = Array.isArray(previousAlbums) ? previousAlbums : [];
  const discovered = Array.isArray(scanResult?.albums) ? scanResult.albums : [];
  const failedIds = new Set((scanResult?.failedIds || []).map(Number));
  const discoveredById = new Map(discovered.map(album => [Number(album.id), album]));
  const albums = [...discovered];
  const preserved = [];
  for (const album of previous) {
    const id = Number(album.id);
    if (!discoveredById.has(id) && failedIds.has(id)) {
      albums.push(album);
      preserved.push(album);
    }
  }
  const sortedAlbums = sortGeneratedAlbums(albums);
  if (previous.length && sortedAlbums.length < previous.length * 0.9) {
    throw new Error(`Full scan would remove more than 10% of existing albums (${previous.length} -> ${sortedAlbums.length})`);
  }
  return {
    albums: sortedAlbums,
    stats: {
      discovered: discovered.length,
      preserved: preserved.length,
      missing: (scanResult?.missingIds || []).length,
      failed: (scanResult?.failedIds || []).length,
    },
  };
}

export async function writeCatalogAtomically(target, catalog, renameImpl = rename) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  try {
    await renameImpl(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
