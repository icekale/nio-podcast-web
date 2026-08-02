import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { SEED_ALBUMS, discoverAlbums, getEpisodes, getCachedAlbums } from './api';
import './App.css';

/* ══════════ Shared helpers ══════════ */
// Episode durations arrive in milliseconds; the audio element reports seconds.
function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '--:--';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatClock(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ══════════ Player ══════════ */
const Player = memo(function Player({ episode, onClose }) {
  const aRef = useRef(null);
  const scrubbingRef = useRef(false);
  const [play, setPlay] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = aRef.current;
    if (!a || !episode) return;
    // Reset the bar whenever a new episode is loaded
    setPos(0);
    setDur(0);
    setPlay(false);
    a.src = episode.audioUrl;
    a.load();
    a.play().catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title, artist: episode.host || episode.albumName,
        album: episode.albumName,
        artwork: episode.albumPic ? [{ src: episode.albumPic, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
  }, [episode]);

  // Single source of truth is the <audio> element events — the UI just mirrors
  // onPlay/onPause, so it can never drift out of sync with actual playback.
  const toggle = () => {
    const a = aRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const seek = e => {
    const a = aRef.current;
    if (!a || !dur) return;
    scrubbingRef.current = true;
    const t = Math.min(Number(e.target.value), dur);
    a.currentTime = t;
    setPos(t);
  };

  if (!episode) return null;

  return (
    <div className="player">
      <audio ref={aRef}
        preload="metadata"
        onTimeUpdate={() => { if (!scrubbingRef.current) setPos(aRef.current?.currentTime||0); }}
        onLoadedMetadata={() => setDur(aRef.current?.duration||0)}
        onPlay={() => setPlay(true)} onPause={() => setPlay(false)}
        onEnded={() => setPlay(false)} />
      <div className="player-row">
        {episode.albumPic && <img src={episode.albumPic} alt="" className="player-cover" />}
        <button type="button" className="player-info" onClick={onClose} aria-label="收起播放器">
          <span className="player-name">{episode.title}</span>
          <span className="player-album">{episode.albumName}</span>
        </button>
        <button type="button" className="player-play" onClick={toggle}
          aria-label={play ? '暂停' : '播放'} aria-pressed={play}>
          {play ? '⏸' : '▶'}
        </button>
      </div>
      <div className="player-bar-row">
        <span className="player-time">{formatClock(pos)}</span>
        <input type="range" min="0" max={dur || 0} step="1" value={pos}
          onChange={seek}
          onPointerUp={() => { scrubbingRef.current = false; }}
          onKeyUp={() => { scrubbingRef.current = false; }}
          onBlur={() => { scrubbingRef.current = false; }}
          className="player-range" aria-label="播放进度" />
        <span className="player-time">{formatClock(dur)}</span>
      </div>
    </div>
  );
});

/* ══════════ Episodes ══════════ */
const EpisodeList = memo(function EpisodeList({ album, onBack, onPlay }) {
  const [eps, setEps] = useState([]);
  const [load, setLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [err, setErr] = useState(false);
  const headRef = useRef(null);
  // Each fetch bumps the sequence; responses from superseded requests are dropped.
  // This prevents stale pages from one album leaking into another when the user
  // switches albums quickly, and stops double-taps on "加载更多" duplicating rows.
  const seqRef = useRef(0);

  const fetch = useCallback(async (p) => {
    const seq = ++seqRef.current;
    setLoad(true);
    setErr(false);
    try {
      const r = await getEpisodes(album.id, p);
      if (seq !== seqRef.current) return;
      setEps(prev => p === 1 ? r.episodes : [...prev, ...r.episodes]);
      setMore(r.hasMore);
      setPage(p);
    } catch (e) {
      if (seq !== seqRef.current) return;
      console.error(e);
      setErr(true);
    } finally {
      if (seq === seqRef.current) setLoad(false);
    }
  }, [album.id]);

  useEffect(() => { fetch(1); }, [fetch]);

  // Announce the new view to screen readers / keyboard users on open
  useEffect(() => { headRef.current?.focus(); }, []);

  return (
    <section>
      <header className="ep-nav">
        <button type="button" className="ep-back" onClick={onBack} aria-label="返回专辑列表">←</button>
        <div className="ep-nav-info">
          <h1 ref={headRef} tabIndex={-1} className="ep-nav-name">{album.name}</h1>
          <div className="ep-nav-count">{album.count} 集</div>
        </div>
      </header>
      <ul className="ep-list">
        {eps.map((ep, i) => (
          <li key={ep.id} className="ep-row">
            <button type="button" className="ep-main" onClick={() => onPlay(ep)}>
              <span className="ep-idx">{i+1}</span>
              <span className="ep-body">
                <span className="ep-body-title">{ep.title}</span>
                <span className="ep-body-meta">
                  <span>{formatDuration(ep.duration)}</span>
                  <span>{formatDate(ep.onlineTime)}</span>
                </span>
              </span>
            </button>
            <button type="button" className="ep-play-btn" onClick={() => onPlay(ep)} aria-label={`播放 ${ep.title}`}>▶</button>
          </li>
        ))}
        {err && (
          <li className="ep-error" role="alert">
            <span>加载失败</span>
            <button type="button" className="ep-retry" onClick={() => fetch(page)}>重试</button>
          </li>
        )}
        {more && !load && (
          <li><button type="button" className="load-more" onClick={()=>fetch(page+1)}>加载更多</button></li>
        )}
        {load && <li className="spinner" role="status" aria-label="加载中" />}
      </ul>
    </section>
  );
});

/* ══════════ Home ══════════ */
const Home = memo(function Home({ onSelect }) {
  const [albums, setAlbums] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = getCachedAlbums();

    if (cached && cached.length > 0) {
      // Cache hit — show instantly, silently refresh in background
      setAlbums(cached);
      discoverAlbums(data => { if (data.length > 0) setAlbums(data); });
      return;
    }

    // No cache — show seed instantly while Phase 1 runs
    const seed = SEED_ALBUMS.map(a => ({...a, pic:'', host:'', count:0}));
    setAlbums(seed);
    setLoading(true);

    discoverAlbums(data => {
      if (data.length > 0) setAlbums(data);
      setLoading(false);
    });
  }, []);

  const q = search.trim().toLowerCase();
  const filt = useMemo(
    () => q
      ? albums.filter(a => (a.name || '').toLowerCase().includes(q) || (a.desc || '').toLowerCase().includes(q))
      : albums,
    [albums, q]
  );

  return (
    <div>
      <header className="nav">
        <span className="nav-logo">Nio Podcast</span>
        <span className="nav-status" role="status">{loading ? '发现中…' : `${albums.length} 个专辑`}</span>
      </header>

      <section className="hero">
        <span className="hero-tag">NIO Radio</span>
        <h1>探索播客</h1>
        <p className="hero-desc">蔚来电台精选内容，随时随地收听</p>
      </section>

      {/* Search */}
      <div className="search-section">
        <input type="search" className="search-input" placeholder="搜索专辑…"
          aria-label="搜索专辑" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Unified vertical album list */}
      <ul className="album-list">
        {filt.map(a => (
          <li key={a.id}>
            <button type="button" className="album-row" onClick={() => onSelect(a)} aria-label={`打开专辑 ${a.name}`}>
              {a.pic ? (
                <img src={a.pic} alt="" className="album-cover" loading="lazy" decoding="async" />
              ) : (
                <span className="album-cover album-cover-placeholder" aria-hidden="true">🎧</span>
              )}
              <span className="album-body">
                <span className="album-name">{a.name}</span>
                {a.desc ? <span className="album-desc">{a.desc}</span> : null}
                <span className="album-meta">
                  {a.count > 0 ? `${a.count} 集` : ''}
                  {a.host ? ` · ${a.host}` : ''}
                </span>
              </span>
              <span className="album-chevron" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
        {filt.length === 0 && !loading && (
          <li className="album-empty">没有找到匹配的专辑</li>
        )}
      </ul>
    </div>
  );
});

/* ══════════ App ══════════ */
export default function App() {
  const [v, setV] = useState('home');
  const [album, setAlbum] = useState(null);
  const [ep, setEp] = useState(null);
  const [pl, setPl] = useState(false);

  const play = useCallback(e => { setEp(e); setPl(true); }, []);
  const selectAlbum = useCallback(a => { setAlbum(a); setV('eps'); }, []);
  const goHome = useCallback(() => setV('home'), []);
  const closePlayer = useCallback(() => setPl(false), []);

  // Start each view at the top instead of inheriting stale scroll position
  useEffect(() => { window.scrollTo(0, 0); }, [v]);

  return (
    <main className="app">
      {v==='home' && <Home onSelect={selectAlbum} />}
      {v==='eps' && album && <EpisodeList album={album} onBack={goHome} onPlay={play} />}
      {pl && ep && <Player episode={ep} onClose={closePlayer} />}
    </main>
  );
}
