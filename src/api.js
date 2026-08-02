const BASE = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';
const FETCH_TIMEOUT_MS = 8000;
const CACHE_KEY = 'nio_catalog_cache_v1';

export class ApiError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeAudioUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

function mapEpisode(ep) {
  return {
    id: ep.audioId,
    title: ep.audioName || '未命名节目',
    albumId: ep.albumId,
    albumName: ep.albumName || '',
    albumPic: ep.albumPic || '',
    albumDesc: ep.albumDesc || '',
    host: (ep.host || []).join(', ') || ep.singer || '',
    duration: ep.duration,
    onlineTime: ep.onlineTime,
    audioUrl: normalizeAudioUrl(ep.aacPlayUrl192 || ep.aacPlayUrl128 || ep.mp3PlayUrl64 || ''),
    fileSize: ep.aacFileSize192,
  };
}

export async function getEpisodes(albumId, page = 1, pageSize = 30, fetchImpl = globalThis.fetch) {
  if (globalThis.navigator?.onLine === false) {
    throw new ApiError('OFFLINE', '当前处于离线状态');
  }
  if (typeof fetchImpl !== 'function') {
    throw new ApiError('NETWORK_ERROR', '无法连接音频服务');
  }

  const body = new URLSearchParams({
    albumId: String(albumId),
    sorttype: '2',
    pagenum: String(page),
    pagesize: String(pageSize),
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetchImpl(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: ctrl.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ApiError('TIMEOUT', '请求超时', error);
      }
      throw new ApiError('NETWORK_ERROR', '无法连接音频服务', error);
    }

    if (!response?.ok) {
      throw new ApiError('HTTP_ERROR', `音频服务返回 ${response?.status || '未知'} 状态`, response?.status);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ApiError('INVALID_RESPONSE', '音频服务返回了无法读取的数据', error);
    }

    const result = payload?.result;
    if (!result || !Array.isArray(result.dataList)) {
      throw new ApiError('INVALID_RESPONSE', '音频服务返回了无法读取的数据');
    }

    return {
      episodes: result.dataList.map(mapEpisode),
      totalCount: Number(result.totalCount) || 0,
      hasMore: result.haveNext === 1 || result.haveNext === true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getCachedAlbums(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.albums) ? parsed.albums : null;
  } catch {
    return null;
  }
}

export function setCachedAlbums(albums, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ albums, savedAt: Date.now() }));
  } catch {
    // Storage is an enhancement; playback still works without it.
  }
}

export async function discoverAlbums(onProgress, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`${import.meta.env.BASE_URL}data/albums.json`, { cache: 'no-store' });
    if (!response.ok) throw new ApiError('HTTP_ERROR', '目录加载失败');
    const payload = await response.json();
    const albums = Array.isArray(payload?.albums) ? payload.albums : [];
    if (!albums.length) throw new ApiError('INVALID_RESPONSE', '目录为空');
    setCachedAlbums(albums);
    onProgress?.(albums);
    return albums;
  } catch (error) {
    const cached = getCachedAlbums();
    if (cached?.length) {
      onProgress?.(cached);
      return cached;
    }
    throw error instanceof ApiError ? error : new ApiError('NETWORK_ERROR', '目录加载失败', error);
  }
}

export const SEED_ALBUMS = [];
export const ALL_SEED_IDS = [];
