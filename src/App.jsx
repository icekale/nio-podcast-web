import { useState, useEffect, useRef, useCallback } from 'react';
import { SEED_ALBUMS, discoverAlbums, getEpisodes } from './api';
import './App.css';

/* ═══════════════ Audio Player ═══════════════ */
function Player({ episode, onClose }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !episode) return;
    a.src = episode.audioUrl;
    a.load();
    a.play().then(() => setPlaying(true)).catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title,
        artist: episode.host || episode.albumName,
        album: episode.albumName,
        artwork: episode.albumPic ? [{ src: episode.albumPic, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => a.play());
      navigator.mediaSession.setActionHandler('pause', () => a.pause());
    }
  }, [episode?.id]);

  const toggle = () => { const a=audioRef.current; if(!a)return; playing?a.pause():a.play(); setPlaying(!playing); };

  const fmt = s => { const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; };
  const pct = dur ? (pos/dur)*100 : 0;

  if (!episode) return null;

  return (
    <div className="player-bar">
      <audio ref={audioRef}
        onTimeUpdate={() => setPos(audioRef.current?.currentTime||0)}
        onLoadedMetadata={() => setDur(audioRef.current?.duration||0)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="player-main">
        {episode.albumPic && <img src={episode.albumPic} alt="" className="player-cover" />}
        <div className="player-info" onClick={onClose}>
          <div className="player-title">{episode.title}</div>
          <div className="player-sub">{episode.albumName}</div>
        </div>
        <button className="player-ctrl" onClick={toggle}>{playing ? '⏸' : '▶'}</button>
      </div>
      <div className="player-progress-row">
        <span className="player-time">{fmt(pos)}</span>
        <input type="range" min="0" max="100" value={pct}
          onChange={e => { const a=audioRef.current; if(a){ a.currentTime=(e.target.value/100)*dur; setPos(a.currentTime); } }}
          className="player-slider" style={{'--progress': `${pct}%`}} />
        <span className="player-time">{fmt(dur)}</span>
      </div>
    </div>
  );
}

/* ═══════════════ Episode List ═══════════════ */
function EpisodeList({ album, onBack, onPlay }) {
  const [eps, setEps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const r = await getEpisodes(album.id, p);
      setEps(prev => p===1 ? r.episodes : [...prev, ...r.episodes]);
      setMore(r.hasMore);
      setPage(p);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [album.id]);

  useEffect(() => { load(1); }, [album.id]);

  const fmtD = ms => { const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000); return `${m}:${s.toString().padStart(2,'0')}`; };
  const fmtDate = ts => { const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()}`; };

  return (
    <div className="page">
      <div className="ep-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="ep-header-info">
          <div className="ep-header-name">{album.name}</div>
          <div className="ep-header-count">{album.count} 集</div>
        </div>
      </div>
      <div className="ep-list">
        {eps.map((ep, i) => (
          <div key={ep.id} className="ep-item" onClick={() => onPlay(ep)}>
            <div className="ep-num">{i + 1}</div>
            <div className="ep-item-content">
              <div className="ep-item-title">{ep.title}</div>
              <div className="ep-item-meta">
                <span>{fmtD(ep.duration)}</span>
                <span>{fmtDate(ep.onlineTime)}</span>
              </div>
            </div>
            <button className="ep-item-play" onClick={e => { e.stopPropagation(); onPlay(ep); }}>▶</button>
          </div>
        ))}
        {more && !loading && <button className="load-more-btn" onClick={() => load(page+1)}>加载更多</button>}
        {loading && <div className="spinner" />}
      </div>
    </div>
  );
}

/* ═══════════════ Album List (Home) ═══════════════ */
function AlbumList({ onSelect, onPlay }) {
  const [albums, setAlbums] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('loading');
  const [discProgress, setDiscProgress] = useState(0);
  const [discTotal, setDiscTotal] = useState(0);

  useEffect(() => {
    const seed = SEED_ALBUMS.map(a => ({ ...a, pic: '', host: '', count: 0 }));
    setAlbums(seed);
    setDiscTotal(2000);

    discoverAlbums((found, total) => {
      setDiscProgress(found);
      setDiscTotal(total);
    }).then(found => {
      if (found.length > 0) setAlbums(found);
      setStatus('ready');
    }).catch(() => setStatus('ready'));
  }, []);

  const filtered = search
    ? albums.filter(a => a.name.includes(search) || a.desc.includes(search))
    : albums;

  const withPic = filtered.filter(a => a.pic);
  const noPic = filtered.filter(a => !a.pic);

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">NIO Radio</div>
        <h1>探索播客</h1>
        <p className="hero-sub">蔚来电台精选内容，随时随地收听</p>
        {status === 'loading' && discTotal > 0 && (
          <div className="discovery-bar" style={{marginTop: 16}}>
            <div className="discovery-progress">
              <div className="discovery-progress-fill"
                style={{width: `${Math.min(100, (discProgress/discTotal)*100)}%`}} />
            </div>
            <div style={{fontSize:12, color:'var(--text-tertiary)', marginTop:6}}>
              发现 {discProgress} 个专辑
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="search-wrap">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="搜索专辑..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Albums with images — hero cards */}
      {withPic.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">精选专辑</span>
          </div>
          <div className="album-grid">
            {withPic.map(a => (
              <div key={a.id} className="album-card" onClick={() => onSelect(a)}>
                <div className="album-cover-wrap">
                  <img src={a.pic} alt="" loading="lazy" />
                  <div className="album-cover-overlay" />
                  <div className="album-cover-content">
                    <div className="album-cover-title">{a.name}</div>
                    <div className="album-cover-meta">
                      {a.count > 0 && <>{a.count} 集</>}
                      {a.count > 0 && a.host && <span className="dot" />}
                      {a.host && <span>{a.host}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Albums without images — text cards */}
      {noPic.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">更多专辑</span>
            <span className="section-count">{noPic.length} 个</span>
          </div>
          <div className="album-grid">
            {noPic.map(a => (
              <div key={a.id} className="album-card" onClick={() => onSelect(a)}>
                <div className="album-text-card">
                  <div className="album-text-icon">🎧</div>
                  <div className="album-text-info">
                    <div className="album-text-name">{a.name}</div>
                    {a.desc && <div className="album-text-desc">{a.desc}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════ App ═══════════════ */
export default function App() {
  const [view, setView] = useState('home');
  const [album, setAlbum] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const play = (ep) => { setEpisode(ep); setPlayerOpen(true); };

  return (
    <div className="app">
      {view === 'home' && (
        <AlbumList
          onSelect={a => { setAlbum(a); setView('episodes'); }}
          onPlay={play}
        />
      )}
      {view === 'episodes' && album && (
        <EpisodeList album={album} onBack={() => setView('home')} onPlay={play} />
      )}
      {playerOpen && episode && (
        <Player episode={episode} onClose={() => setPlayerOpen(false)} />
      )}
    </div>
  );
}
