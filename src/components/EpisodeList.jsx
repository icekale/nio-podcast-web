import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getEpisodes } from '../api';
import { formatDuration, formatDate } from '../utils';

const EpisodeList = memo(function EpisodeList({ album, onBack, onPlay }) {
  const [eps, setEps] = useState([]);
  const [load, setLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [err, setErr] = useState(false);
  const headRef = useRef(null);
  const seqRef = useRef(0);

  const fetch = useCallback(async (p) => {
    const seq = ++seqRef.current;
    setLoad(true); setErr(false);
    try {
      const r = await getEpisodes(album.id, p);
      if (seq !== seqRef.current) return;
      setEps(prev => p === 1 ? r.episodes : [...prev, ...r.episodes]);
      setMore(r.hasMore); setPage(p);
    } catch (e) {
      if (seq !== seqRef.current) return;
      console.error(e); setErr(true);
    } finally {
      if (seq === seqRef.current) setLoad(false);
    }
  }, [album.id]);

  useEffect(() => { fetch(1); }, [fetch]);
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
          <li><button type="button" className="load-more" onClick={() => fetch(page+1)}>加载更多</button></li>
        )}
        {load && <li className="spinner" role="status" aria-label="加载中" />}
      </ul>
    </section>
  );
});

export default EpisodeList;
