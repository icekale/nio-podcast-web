import { useState, useEffect, useMemo, memo } from 'react';
import { SEED_ALBUMS, discoverAlbums, getCachedAlbums } from '../api';

const Home = memo(function Home({ onSelect }) {
  const [albums, setAlbums] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = getCachedAlbums();
    if (cached?.length > 0) {
      setAlbums(cached);
      discoverAlbums(data => { if (data.length > 0) setAlbums(data); });
      return;
    }
    const seed = SEED_ALBUMS.map(a => ({...a, pic:'', host:'', count:0}));
    setAlbums(seed); setLoading(true);
    discoverAlbums(data => { if (data.length > 0) setAlbums(data); setLoading(false); });
  }, []);

  const q = search.trim().toLowerCase();
  const filt = useMemo(
    () => q ? albums.filter(a => (a.name||'').toLowerCase().includes(q) || (a.desc||'').toLowerCase().includes(q)) : albums,
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
      <div className="search-section">
        <input type="search" className="search-input" placeholder="搜索专辑…"
          aria-label="搜索专辑" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <ul className="album-list">
        {filt.map(a => (
          <li key={a.id}>
            <button type="button" className="album-row" onClick={() => onSelect(a)} aria-label={`打开专辑 ${a.name}`}>
              {a.pic ? <img src={a.pic} alt="" className="album-cover" loading="lazy" decoding="async" />
                : <span className="album-cover album-cover-placeholder" aria-hidden="true">🎧</span>}
              <span className="album-body">
                <span className="album-name">{a.name}</span>
                {a.desc && <span className="album-desc">{a.desc}</span>}
                <span className="album-meta">{a.count > 0 ? `${a.count} 集` : ''}{a.host ? ` · ${a.host}` : ''}</span>
              </span>
              <span className="album-chevron" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
        {filt.length === 0 && !loading && <li className="album-empty">没有找到匹配的专辑</li>}
      </ul>
    </div>
  );
});

export default Home;
