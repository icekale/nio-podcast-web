export const CATALOG_CACHE_KEY = 'nio_catalog_cache_v1';
const CATALOG_FETCH_TIMEOUT_MS = 8000;

export function sortAlbumsByLatest(albums) {
  return [...albums].sort((a, b) => {
    const aTime = Number(a.latestEpisode?.onlineTime) || 0;
    const bTime = Number(b.latestEpisode?.onlineTime) || 0;
    return bTime - aTime;
  });
}

function sameLocalDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function selectHomeEpisodes(albums, now = new Date()) {
  const latest = sortAlbumsByLatest(albums)
    .map(album => album.latestEpisode)
    .filter(Boolean);
  const today = latest.filter(episode => sameLocalDay(episode.onlineTime, now)).slice(0, 12);
  return {
    heading: today.length ? '今日更新' : '最新更新',
    episodes: (today.length ? today : latest.slice(0, 12)),
  };
}

export function normalizeCatalog(payload) {
  if (!payload || !Array.isArray(payload.albums)) {
    throw new Error('目录格式无效');
  }
  const albums = payload.albums
    .filter(album => album && Number.isFinite(Number(album.id)) && album.latestEpisode?.id)
    .map(album => ({ ...album, id: Number(album.id) }));
  return { generatedAt: Number(payload.generatedAt) || 0, albums: sortAlbumsByLatest(albums) };
}

export function readCatalogCache(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(CATALOG_CACHE_KEY) || 'null');
    return parsed ? normalizeCatalog(parsed) : null;
  } catch {
    return null;
  }
}

export function writeCatalogCache(catalog, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    // Storage is optional and can be unavailable in private browsing.
  }
}

export async function loadCatalog(fetchImpl = globalThis.fetch, baseUrl = import.meta.env.BASE_URL) {
  const cached = readCatalogCache();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${baseUrl}data/albums.json`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = normalizeCatalog(await response.json());
    writeCatalogCache(catalog);
    return { catalog, stale: false };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('目录加载超时', { cause: error });
      if (cached) return { catalog: cached, stale: true, error: timeoutError };
      throw timeoutError;
    }
    if (cached) return { catalog: cached, stale: true, error };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
