// Nio Radio public API — no auth required
const BASE = 'https://gateway-front-external.nio.com/moat/100914/v2/audio/list';
const CACHE_KEY = 'nio_albums_cache';
const CACHE_TS_KEY = 'nio_albums_ts';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 8000;

// Seed album data — shown instantly on first visit
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

// ═══════════════ Cache ═══════════════
export function getCachedAlbums() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (raw && ts && Date.now() - Number(ts) < CACHE_TTL) {
      return JSON.parse(raw);
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

// ═══════════════ Discovery ═══════════════
let discoveryRunning = false;

export async function discoverAlbums(onProgress) {
  if (discoveryRunning) return []; // already running, caller will get data via cache/sets
  discoveryRunning = true;

  try {
    const found = [];
    const seen = new Set();

    const add = (ep, totalCount) => {
      if (!ep || seen.has(ep.albumId)) return;
      seen.add(ep.albumId);
      found.push({
        id: ep.albumId, name: ep.albumName, desc: ep.albumDesc || '',
        pic: ep.albumPic || '', count: totalCount,
        host: (ep.host || []).join(', ') || ep.singer || '',
      });
    };

    // Phase 1: seed albums — concurrent
    const results = await Promise.allSettled(
      ALL_SEED_IDS.map(id => fetchPage(id, 1, 1).then(r => ({ id, r })))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.r.totalCount > 0) {
        add(res.value.r.dataList?.[0], res.value.r.totalCount);
      }
    }

    const sorted = found.sort((a, b) => b.count - a.count);
    setCachedAlbums(sorted);
    onProgress?.(sorted);

    // Phase 2: probe remaining IDs — background only, don't block
    probeRemaining(found, seen, onProgress);

    return sorted;
  } finally {
    discoveryRunning = false;
  }
}

async function probeRemaining(found, seen, onProgress) {
  const BATCH = 20;
  for (let start = 1; start <= 2000; start += BATCH) {
    const batch = [];
    for (let id = start; id < start + BATCH && id <= 2000; id++) {
      if (!ALL_SEED_IDS.includes(id)) batch.push(id);
    }
    if (batch.length === 0) continue;

    const results = await Promise.allSettled(
      batch.map(id => fetchPage(id, 1, 1).then(r => ({ id, r })))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.r.totalCount > 0) {
        const ep = res.value.r.dataList?.[0];
        if (ep && !seen.has(ep.albumId)) {
          seen.add(ep.albumId);
          found.push({
            id: ep.albumId, name: ep.albumName, desc: ep.albumDesc || '',
            pic: ep.albumPic || '', count: res.value.r.totalCount,
            host: (ep.host || []).join(', ') || ep.singer || '',
          });
        }
      }
    }

    const sorted = [...found].sort((a, b) => b.count - a.count);
    setCachedAlbums(sorted);
    onProgress?.(sorted);
  }
}

// ═══════════════ API ═══════════════
async function fetchPage(albumId, pageNum, pageSize) {
  const body = new URLSearchParams({
    albumId: String(albumId), sorttype: '2',
    pagenum: String(pageNum), pagesize: String(pageSize),
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body, signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.result || { totalCount: 0, dataList: [] };
  } catch {
    return { totalCount: 0, dataList: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function getEpisodes(albumId, page = 1, pageSize = 30) {
  const result = await fetchPage(albumId, page, pageSize);
  return {
    episodes: (result.dataList || []).map(ep => ({
      id: ep.audioId, title: ep.audioName,
      albumId: ep.albumId, albumName: ep.albumName,
      albumPic: ep.albumPic, albumDesc: ep.albumDesc,
      host: (ep.host || []).join(', ') || ep.singer || '',
      duration: ep.duration, onlineTime: ep.onlineTime,
      audioUrl: ep.aacPlayUrl192 || ep.aacPlayUrl128 || ep.mp3PlayUrl64 || '',
      fileSize: ep.aacFileSize192,
    })),
    totalCount: result.totalCount,
    hasMore: result.haveNext === 1,
  };
}

export { SEED_ALBUMS, ALL_SEED_IDS };
