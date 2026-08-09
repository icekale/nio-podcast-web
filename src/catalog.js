export const CATALOG_CACHE_KEY = 'nio_catalog_cache_v1';
const CATALOG_FETCH_TIMEOUT_MS = 8000;
const CATALOG_CACHE_FRESH_MS = 5 * 60 * 1000;
const CATALOG_CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function sortAlbumsByLatest(albums) {
  return [...albums].sort((a, b) => {
    const aTime = Number(a.latestEpisode?.onlineTime) || 0;
    const bTime = Number(b.latestEpisode?.onlineTime) || 0;
    const timeDifference = bTime - aTime;
    if (timeDifference) return timeDifference;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

const PINNED_ALBUM_IDS = [5, 23];
// 用户要求提高排序权重：芝士分子 (35)、N问 (584)
const BOOSTED_ALBUM_IDS = [35, 584];
const CITY_CHANNEL_PATTERN = /城市资讯|城市频道|天气预报/;

// 车机端场景分类（与 scripts/album-categories.js 保持一致）
export const SCENE_CATEGORY_ORDER = ['commute', 'kids', 'relax', 'longhaul', 'city', 'car'];
export const SCENE_CATEGORY_LABELS = {
  commute: '通勤场景|资讯速递',
  kids: '宝贝同行|哄娃陪伴',
  relax: '舒缓驾驶|乐伴旅途',
  longhaul: '长途驾驶|知识充电',
  city: '城市漫游|本地指南',
  car: '玩转爱车|提车必听',
};

export function groupAlbumsByCategory(albums, favoriteIds = []) {
  const groups = SCENE_CATEGORY_ORDER.map(id => ({ id, label: SCENE_CATEGORY_LABELS[id], albums: [] }));
  const rest = [];
  for (const album of albums) {
    const group = groups.find(g => g.id === album.category);
    if (group) group.albums.push(album);
    else rest.push(album);
  }
  for (const group of groups) group.albums = sortAlbumsForDirectory(group.albums, favoriteIds);
  return { groups, rest: sortAlbumsForDirectory(rest, favoriteIds) };
}

export function isCityChannelAlbum(album) {
  return CITY_CHANNEL_PATTERN.test(album?.name || '');
}

export function sortAlbumsForDirectory(albums, favoriteIds = []) {
  const pinnedIds = new Set(PINNED_ALBUM_IDS.map(Number));
  const boostedIds = new Set(BOOSTED_ALBUM_IDS.map(Number));
  const favoriteOrder = new Map(
    favoriteIds.map(Number).filter(Number.isFinite).map((id, index) => [id, index]),
  );
  const favorites = [];
  const pinned = [];
  const boosted = [];
  const rest = [];
  const city = [];
  for (const album of albums) {
    const id = Number(album.id);
    if (favoriteOrder.has(id)) favorites.push(album);
    else if (pinnedIds.has(id)) pinned.push(album);
    else if (boostedIds.has(id)) boosted.push(album);
    else if (isCityChannelAlbum(album)) city.push(album);
    else rest.push(album);
  }
  favorites.sort((a, b) => favoriteOrder.get(Number(a.id)) - favoriteOrder.get(Number(b.id)));
  const pinnedOrder = new Map(PINNED_ALBUM_IDS.map((id, index) => [id, index]));
  pinned.sort((a, b) => pinnedOrder.get(Number(a.id)) - pinnedOrder.get(Number(b.id)));
  const boostedOrder = new Map(BOOSTED_ALBUM_IDS.map((id, index) => [id, index]));
  boosted.sort((a, b) => boostedOrder.get(Number(a.id)) - boostedOrder.get(Number(b.id)));
  return [...favorites, ...pinned, ...boosted, ...sortAlbumsByLatest(rest), ...sortAlbumsByLatest(city)];
}

export function getBeijingDayKey(timestamp = Date.now()) {
  const shifted = new Date(Number(timestamp) + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
}

function sameBeijingDay(left, right) {
  return getBeijingDayKey(left) === getBeijingDayKey(right);
}

export function selectHomeEpisodes(albums, now = new Date()) {
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
  const today = latest.filter(episode => sameBeijingDay(episode.onlineTime, now)).slice(0, 12);
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

export function readCachedCatalog() {
  const cached = readCatalogCache();
  if (!cached || Date.now() - cached.generatedAt > CATALOG_CACHE_MAX_AGE_MS) return null;
  return cached;
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
