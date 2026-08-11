import { getCustomEpisodes } from './customAlbums.js';

const BASE = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';
const FETCH_TIMEOUT_MS = 8000;
const EPISODE_CACHE_TTL_MS = 10 * 60 * 1000;
const EPISODE_CACHE_MAX_ENTRIES = 100;
const episodeCache = new Map();
const episodeRequests = new Map();

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

export function clearEpisodeCache() {
  episodeCache.clear();
  episodeRequests.clear();
}

async function requestEpisodes(albumId, page, pageSize, fetchImpl) {
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

export async function getEpisodes(albumId, page = 1, pageSize = 30, fetchImpl = globalThis.fetch) {
  const custom = getCustomEpisodes(albumId, page, pageSize);
  if (custom) return custom;
  const key = `${albumId}:${page}:${pageSize}`;
  const cached = episodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) episodeCache.delete(key);

  const inFlight = episodeRequests.get(key);
  if (inFlight) return inFlight;

  const request = requestEpisodes(albumId, page, pageSize, fetchImpl)
    .then(result => {
      episodeCache.set(key, { value: result, expiresAt: Date.now() + EPISODE_CACHE_TTL_MS });
      while (episodeCache.size > EPISODE_CACHE_MAX_ENTRIES) {
        episodeCache.delete(episodeCache.keys().next().value);
      }
      return result;
    })
    .finally(() => episodeRequests.delete(key));
  episodeRequests.set(key, request);
  return request;
}
