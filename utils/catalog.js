const CATALOG_CACHE_KEY = 'nio_catalog_cache_v1';
const CATALOG_FETCH_TIMEOUT_MS = 8000;
const CATALOG_CACHE_FRESH_MS = 5 * 60 * 1000;

function sortAlbumsByLatest(albums) {
  return [...albums].sort((a, b) => {
    const aTime = Number(a.latestEpisode?.onlineTime) || 0;
    const bTime = Number(b.latestEpisode?.onlineTime) || 0;
    const timeDifference = bTime - aTime;
    if (timeDifference) return timeDifference;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

const PINNED_ALBUM_IDS = [5, 23];

function sortAlbumsForDirectory(albums) {
  const pinnedIds = new Set(PINNED_ALBUM_IDS.map(Number));
  const pinned = [];
  const rest = [];
  for (const album of albums) {
    if (pinnedIds.has(Number(album.id))) {
      pinned.push(album);
    } else {
      rest.push(album);
    }
  }
  const pinnedOrder = new Map(PINNED_ALBUM_IDS.map((id, index) => [id, index]));
  pinned.sort((a, b) => pinnedOrder.get(Number(a.id)) - pinnedOrder.get(Number(b.id)));
  return [...pinned, ...sortAlbumsByLatest(rest)];
}

function sameLocalDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function selectHomeEpisodes(albums, now = new Date()) {
  const seenEpisodeIds = new Set();
  const latest = sortAlbumsByLatest(albums)
    .map(album => album.latestEpisode)
    .filter(episode => {
      if (!episode || episode.id == null) return false;
      const id = String(episode.id);
      if (seenEpisodeIds.has(id)) return false;
      seenEpisodeIds.add(id);
      return true;
    });
  const today = latest.filter(episode => sameLocalDay(episode.onlineTime, now)).slice(0, 12);
  return {
    heading: today.length ? '今日更新' : '最新更新',
    episodes: (today.length ? today : latest.slice(0, 12)),
  };
}

function normalizeCatalog(payload) {
  if (!payload || !Array.isArray(payload.albums)) {
    throw new Error('目录格式无效');
  }
  const albums = payload.albums
    .filter(album => album && Number.isFinite(Number(album.id)) && album.latestEpisode?.id)
    .map(album => ({ ...album, id: Number(album.id) }));
  return { generatedAt: Number(payload.generatedAt) || 0, albums: sortAlbumsByLatest(albums) };
}

function readCatalogCache(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(CATALOG_CACHE_KEY) || 'null');
    return parsed ? normalizeCatalog(parsed) : null;
  } catch {
    return null;
  }
}

function writeCatalogCache(catalog, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    // Storage is optional and can be unavailable in private browsing.
  }
}

async function loadCatalog(fetchImpl = globalThis.fetch, baseUrl = import.meta.env.BASE_URL) {
  const cached = readCatalogCache();
  if (cached && Date.now() - cached.generatedAt < CATALOG_CACHE_FRESH_MS) {
    return { catalog: cached, stale: false, cached: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${baseUrl}data/albums.json`, { cache: 'no-cache', signal: controller.signal });
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

module.exports = {
  CATALOG_CACHE_KEY,
  sortAlbumsByLatest,
  sortAlbumsForDirectory,
  selectHomeEpisodes,
  normalizeCatalog,
  readCatalogCache,
  writeCatalogCache,
  loadCatalog,
};
