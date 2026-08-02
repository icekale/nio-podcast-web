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

async function withTimeout(task, timeoutMs, id) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return task;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Album ${id}: request timed out`)), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function scanCatalog(ids, requestAlbum, concurrency = 12, requestTimeoutMs = 15000) {
  const found = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const album = await withTimeout(Promise.resolve().then(() => requestAlbum(id)), requestTimeoutMs, id);
        if (album?.latestEpisode?.id) found.push(album);
      } catch (error) {
        console.warn(`Skipping album ${id}: ${error.message}`);
      }
    }
  };
  const workerCount = Math.min(Math.max(1, concurrency), ids.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return sortGeneratedAlbums(found);
}

export async function updateKnownAlbums(previousAlbums, requestAlbum, concurrency = 12) {
  const previous = Array.isArray(previousAlbums) ? previousAlbums : [];
  const refreshed = await scanCatalog(previous.map(album => album.id), requestAlbum, concurrency);
  const refreshedById = new Map(refreshed.map(album => [Number(album.id), album]));
  return sortGeneratedAlbums(previous.map(album => refreshedById.get(Number(album.id)) || album));
}

export async function requestAlbum(id, fetchImpl = globalThis.fetch) {
  const body = new URLSearchParams({ albumId: String(id), sorttype: '2', pagenum: '1', pagesize: '1' });
  const response = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
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
  const albums = await scanCatalog(ids, id => requestAlbum(id, fetchImpl), concurrency);
  return { generatedAt: Date.now(), albums };
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
