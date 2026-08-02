import { useState, useEffect, useRef, useCallback } from 'react';
import { SEED_ALBUMS, discoverAlbums, getEpisodes, getCachedAlbums } from './api';
import './App.css';

/* ══════════ Player ══════════ */
function Player({ episode, onClose }) {
  const aRef = useRef(null);
  const [play, setPlay] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = aRef.current;
    if (!a || !episode) return;
    a.src = episode.audioUrl;
    a.load();
    a.play().then(() => setPlay(true)).catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title, artist: episode.host || episode.albumName,
        album: episode.albumName,
        artwork: episode.albumPic ? [{ src: episode.albumPic, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
  }, [episode?.id]);

  const toggle = () => { const a=aRef.current; if(!a)return; play?a.pause():a.play(); setPlay(!play); };
  const fmt = s => { const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; };
  const pct = dur ? (pos/dur)*100 : 0;

  if (!episode) return null;

  return (
    <div className="player">
      <audio ref={aRef}
        onTimeUpdate={() => setPos(aRef.current?.currentTime||0)}
        onLoadedMetadata={() => setDur(aRef.current?.duration||0)}
        onPlay={() => setPlay(true)} onPause={() => setPlay(false)}
        onEnded={() => setPlay(false)} />
      <div className="player-row">
        {episode.albumPic && <img src={episode.albumPic} alt="" className="player-cover" />}
        <div className="player-info" onClick={onClose}>
          <div className="player-name">{episode.title}</div>
          <div className="player-album">{episode.albumName}</div>
        </div>
        <button className="player-play" onClick={toggle}>{play ? '⏸' : '▶'}</button>
      </div>
      <div className="player-bar-row">
        <span className="player-time">{fmt(pos)}</span>
        <input type="range" min="0" max="100" value={pct}
          onChange={e => { const a=aRef.current; if(a){ a.currentTime=(e.target.value/100)*dur; setPos(a.currentTime); } }}
          className="player-range" />
        <span className="player-time">{fmt(dur)}</span>
      </div>
    </div>
  );
}

/* ══════════ Episodes ══════════ */
function EpisodeList({ album, onBack, onPlay }) {
  const [eps, setEps] = useState([]);
  const [load, setLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);

  const fetch = useCallback(async (p) => {
    setLoad(true);
    try { const r=await getEpisodes(album.id,p); setEps(prev=>p===1?r.episodes:[...prev,...r.episodes]); setMore(r.hasMore); setPage(p); }
    catch(e){ console.error(e); }
    setLoad(false);
  }, [album.id]);

  useEffect(() => { fetch(1); }, [album.id]);

  const d = ms => { const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000); return `${m}:${s.toString().padStart(2,'0')}`; };
  const dt = ts => { const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()}`; };

  return (
    <div>
      <div className="ep-nav">
        <button className="ep-back" onClick={onBack}>←</button>
        <div className="ep-nav-info">
          <div className="ep-nav-name">{album.name}</div>
          <div className="ep-nav-count">{album.count} 集</div>
        </div>
      </div>
      <div className="ep-list">
        {eps.map((ep, i) => (
          <div key={ep.id} className="ep-row" onClick={() => onPlay(ep)}>
            <span className="ep-idx">{i+1}</span>
            <div className="ep-body">
              <div className="ep-body-title">{ep.title}</div>
              <div className="ep-body-meta">
                <span>{d(ep.duration)}</span>
                <span>{dt(ep.onlineTime)}</span>
              </div>
            </div>
            <button className="ep-play-btn" onClick={e=>{e.stopPropagation();onPlay(ep);}}>▶</button>
          </div>
        ))}
        {more && !load && <button className="load-more" onClick={()=>fetch(page+1)}>加载更多</button>}
        {load && <div className="spinner" />}
      </div>
    </div>
  );
}

/* ══════════ Home ══════════ */
function Home({ onSelect, onPlay }) {
  const [albums, setAlbums] = useState([]);
  const [search, setSearch] = useState('');
  const [discProg, setDiscProg] = useState(0);
  const [discTotal, setDiscTotal] = useState(0);

  useEffect(() => {
    const cached = getCachedAlbums();

    if (cached && cached.length > 0) {
      // Have cache — show instantly, refresh silently in background
      setAlbums(cached);
      discoverAlbums(() => {})
        .then(f => { if (f.length > 0) { setAlbums(f); } })
        .catch(() => {});
      return;
    }

    // No cache — show seed data while discovering with progress
    const seed = SEED_ALBUMS.map(a => ({...a, pic:'', host:'', count:0}));
    setAlbums(seed);
    setDiscTotal(2000);

    discoverAlbums((f, t) => { setDiscProg(f); setDiscTotal(t); })
      .then(f => { if (f.length > 0) setAlbums(f); })
      .catch(() => {});
  }, []);

  const filt = search ? albums.filter(a => a.name.includes(search) || a.desc.includes(search)) : albums;
  const withPic = filt.filter(a => a.pic);
  const noPic = filt.filter(a => !a.pic);

  return (
    <div>
      {/* Nav */}
      <div className="nav">
        <span className="nav-logo">Nio Podcast</span>
        <span className="nav-status">{discProg > 0 ? `${discProg} 个专辑` : ''}</span>
      </div>

      {/* Hero */}
      <div className="hero">
        <span className="hero-tag">NIO Radio</span>
        <h1>探索播客</h1>
        <p className="hero-desc">蔚来电台精选内容，随时随地收听</p>
      </div>

      {/* Discovery Progress */}
      {discProg < discTotal && discTotal > 0 && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{width:`${Math.min(100,(discProg/discTotal)*100)}%`}} />
          </div>
          <div className="progress-text">正在发现专辑… {discProg}/{discTotal}</div>
        </div>
      )}

      {/* Search */}
      <div className="search-section">
        <input className="search-input" placeholder="搜索专辑…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Albums with images — horizontal scroll */}
      {withPic.length > 0 && (
        <>
          <div className="section"><span className="section-label">精选</span></div>
          <div className="scroll-row">
            {withPic.map(a => (
              <div key={a.id} className="h-card" onClick={() => onSelect(a)}>
                <img src={a.pic} alt="" className="h-card-img" loading="lazy" />
                <div className="h-card-body">
                  <div className="h-card-title">{a.name}</div>
                  <div className="h-card-meta">{a.count > 0 ? `${a.count} 集` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Albums without images — vertical list */}
      {noPic.length > 0 && (
        <>
          <div className="section"><span className="section-label">全部专辑</span></div>
          <div className="v-list">
            {noPic.map(a => (
              <div key={a.id} className="v-card" onClick={() => onSelect(a)}>
                <div className="v-card-icon">🎧</div>
                <div className="v-card-body">
                  <div className="v-card-title">{a.name}</div>
                  {a.desc && <div className="v-card-desc">{a.desc}</div>}
                </div>
                <span className="v-card-arrow">›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════ App ══════════ */
export default function App() {
  const [v, setV] = useState('home');
  const [album, setAlbum] = useState(null);
  const [ep, setEp] = useState(null);
  const [pl, setPl] = useState(false);

  const play = e => { setEp(e); setPl(true); };

  return (
    <div className="app">
      {v==='home' && <Home onSelect={a=>{setAlbum(a);setV('eps');}} onPlay={play} />}
      {v==='eps' && album && <EpisodeList album={album} onBack={()=>setV('home')} onPlay={play} />}
      {pl && ep && <Player episode={ep} onClose={()=>setPl(false)} />}
    </div>
  );
}
