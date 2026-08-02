// Nio Radio public API — no auth required
const BASE = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';
const CACHE_KEY = 'nio_albums_cache';
const CACHE_TS_KEY = 'nio_albums_ts';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const EP_CACHE_KEY = 'nio_episodes_cache_v1';
const EP_CACHE_TTL = 60 * 60 * 1000; // 1h
const EP_CACHE_MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 8000;

export function getCachedAlbums() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (raw && ts) {
      const age = Date.now() - Number(ts);
      if (age < CACHE_TTL) {
        return JSON.parse(raw);
      }
    }
  } catch {}
  return null;
}

function setCachedAlbums(albums) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(albums));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {}
}

/* ── Episode page cache ─────────────────────────── */
function episodeCacheKey(albumId, page, pageSize) {
  return `${albumId}:${page}:${pageSize}`;
}

function getCachedEpisodePage(albumId, page, pageSize) {
  try {
    const raw = localStorage.getItem(EP_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const hit = cache[episodeCacheKey(albumId, page, pageSize)];
    return hit && Date.now() - hit.ts < EP_CACHE_TTL ? hit.data : null;
  } catch {}
  return null;
}

function setCachedEpisodePage(albumId, page, pageSize, data) {
  try {
    const raw = localStorage.getItem(EP_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(cache);
    if (keys.length >= EP_CACHE_MAX_PAGES) {
      // Evict the oldest page so the cache cannot grow unbounded
      keys.sort((a, b) => cache[a].ts - cache[b].ts);
      delete cache[keys[0]];
    }
    cache[episodeCacheKey(albumId, page, pageSize)] = { data, ts: Date.now() };
    localStorage.setItem(EP_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// Pre-discovered album IDs (from our earlier probing)
const SEED_ALBUMS = [
  { id: 5, name: '资讯充电站·早间版', desc: '全天最有价值的资讯打包' },
  { id: 23, name: '资讯充电站·晚间版', desc: '晚间资讯回顾' },
  { id: 18, name: '塞萌不塞车', desc: '轻松有趣的汽车生活' },
  { id: 148, name: 'E次元财经报', desc: '财经资讯深度解读' },
  { id: 11, name: '乐行记', desc: '音乐与旅行的故事' },
  { id: 120, name: '蔚来直通车', desc: '蔚来官方资讯' },
  { id: 121, name: '英伦音乐前沿', desc: '英国音乐精选' },
  { id: 136, name: '北京城市频道', desc: '北京城市专属内容' },
  { id: 103, name: '长沙城市频道', desc: '长沙城市专属内容' },
  { id: 147, name: '忽左忽右', desc: '文化沙龙播客' },
  { id: 149, name: '好奇心雷达', desc: '探索有趣知识' },
  { id: 547, name: 'Weekend Dance', desc: '周末舞曲精选' },
  { id: 14, name: '你有音乐', desc: '音乐发现' },
  { id: 17, name: '蔚游记', desc: '旅行故事' },
  { id: 29, name: '曼时光', desc: '慢生活' },
  { id: 129, name: '蔚爱而歌', desc: '音乐精选' },
  { id: 131, name: '沈阳城市频道', desc: '本地方言内容' },
  { id: 540, name: '百事有感觉', desc: '生活感悟' },
  { id: 660, name: '搞钱女孩', desc: '理财成长' },
  { id: 662, name: '一人公司', desc: '创业故事' },
];

const ALL_SEED_IDS = SEED_ALBUMS.map(a => a.id);

let discoveryPromise = null;      // in-flight discovery run, shared by all callers
let discoveryProgress = null;     // latest progress callback

export function discoverAlbums(onProgress) {
  if (onProgress) discoveryProgress = onProgress;
  if (!discoveryPromise) {
    discoveryPromise = runDiscovery();
    discoveryPromise.finally(() => { discoveryPromise = null; });
  }
  return discoveryPromise;
}

async function runDiscovery() {
  const found = [];
  const seen = new Set();

  const addAlbum = (ep, totalCount) => {
    if (!ep || seen.has(ep.albumId)) return;
    seen.add(ep.albumId);
    found.push({
      id: ep.albumId,
      name: ep.albumName,
      desc: ep.albumDesc || '',
      pic: ep.albumPic || '',
      count: totalCount,
      host: (ep.host || []).join(', ') || ep.singer || '',
    });
  };

  // Phase 1: seed albums
  for (let i = 0; i < ALL_SEED_IDS.length; i++) {
    const id = ALL_SEED_IDS[i];
    try {
      const resp = await fetchEpisodePage(id, 1, 1);
      if (resp.totalCount > 0 && resp.dataList.length > 0) {
        addAlbum(resp.dataList[0], resp.totalCount);
      }
    } catch {}
    discoveryProgress?.(found.length, i + 1);
  }

  // Phase 2: probe remaining IDs in batches
  const BATCH = 10;
  for (let start = 1; start <= 2000; start += BATCH) {
    const batch = [];
    for (let id = start; id < start + BATCH && id <= 2000; id++) {
      if (!ALL_SEED_IDS.includes(id)) batch.push(id);
    }
    const results = await Promise.allSettled(
      batch.map(id => fetchEpisodePage(id, 1, 1).then(r => ({ id, r })))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.r.totalCount > 0) {
        addAlbum(res.value.r.dataList?.[0], res.value.r.totalCount);
      }
    }
    discoveryProgress?.(found.length, start + BATCH);
  }

  // Cache results for next visit
  const sorted = found.sort((a, b) => b.count - a.count);
  setCachedAlbums(sorted);
  return sorted;
}

async function fetchEpisodePage(albumId, pageNum, pageSize) {
  const body = new URLSearchParams({
    albumId: String(albumId),
    sorttype: '2',
    pagenum: String(pageNum),
    pagesize: String(pageSize),
  });
  // Abort hung requests so the UI never spins forever on a dead connection
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
    const data = await resp.json();
    return data.result || { totalCount: 0, dataList: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function getEpisodes(albumId, page = 1, pageSize = 30) {
  const cached = getCachedEpisodePage(albumId, page, pageSize);
  if (cached) return cached;
  const result = await fetchEpisodePage(albumId, page, pageSize);
  const data = normalizeEpisodes(result);
  setCachedEpisodePage(albumId, page, pageSize, data);
  return data;
}

function normalizeEpisodes(result) {
  return {
    episodes: (result.dataList || []).map(ep => ({
      id: ep.audioId,
      title: ep.audioName,
      albumId: ep.albumId,
      albumName: ep.albumName,
      albumPic: ep.albumPic,
      albumDesc: ep.albumDesc,
      host: (ep.host || []).join(', ') || ep.singer || '',
      duration: ep.duration,
      onlineTime: ep.onlineTime,
      audioUrl: ep.aacPlayUrl192 || ep.aacPlayUrl128 || ep.mp3PlayUrl64 || '',
      fileSize: ep.aacFileSize192,
    })),
    totalCount: result.totalCount,
    hasMore: result.haveNext === 1,
  };
}

export { SEED_ALBUMS, ALL_SEED_IDS };
