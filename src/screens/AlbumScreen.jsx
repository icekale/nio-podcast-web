import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, RotateCcw } from 'lucide-react';
import { getEpisodes } from '../api';
import { Artwork } from '../components/Artwork';
import { EpisodeRow, LaterEpisodeAction } from '../components/EpisodeRow';

const MAX_DEEP_LINK_AUTO_PAGES = 10;

export const AlbumScreen = memo(function AlbumScreen({ album, episodeId, onBack, onPlay, onAddLater }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [retryPage, setRetryPage] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const requestSeq = useRef(0);

  const loadPage = useCallback(async pageNumber => {
    const sequence = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getEpisodes(album.id, pageNumber);
      if (sequence !== requestSeq.current) return;
      setEpisodes(previous => pageNumber === 1 ? result.episodes : [...previous, ...result.episodes]);
      setPage(pageNumber);
      setRetryPage(null);
      setHasMore(result.hasMore);
    } catch (reason) {
      if (sequence !== requestSeq.current) return;
      setError(reason);
      setRetryPage(pageNumber);
    } finally {
      if (sequence === requestSeq.current) setLoading(false);
    }
  }, [album.id]);

  useEffect(() => {
    setEpisodes([]);
    loadPage(1);
  }, [loadPage]);

  // ponytail: bound automatic deep-link lookup to 10 pages; older links can continue manually.
  useEffect(() => {
    if (!episodeId || !episodes.length) return undefined;
    const target = episodes.some(episode => String(episode.id) === String(episodeId));
    if (!target) {
      if (hasMore && !loading && !error && page < MAX_DEEP_LINK_AUTO_PAGES) loadPage(page + 1);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const row = document.querySelector(`.episode-row[data-episode-id="${episodeId}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.classList.add('is-target');
      window.setTimeout(() => row?.classList.remove('is-target'), 1600);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [episodeId, episodes, error, hasMore, loadPage, loading, page]);

  return (
    <div className="screen album-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回专辑列表" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="album-header-copy"><h1>{album.name}</h1><span>{album.episodeCount || album.count || 0} 集</span></div>
        <span className="icon-button-spacer" />
      </header>
      <section className="album-content" aria-labelledby="album-episodes-title">
        <div className="album-intro"><Artwork src={album.imageUrl} alt="" className="album-hero-art" /><div><h2 id="album-episodes-title">节目列表</h2><p>{album.description || 'NIO Radio 精选内容'}</p></div></div>
        {error ? <div className="inline-error" role="alert"><CircleAlert size={18} /><span>节目加载失败，请检查网络后重试</span><button type="button" onClick={() => loadPage(retryPage ?? page)}><RotateCcw size={16} />重新加载</button></div> : null}
        {loading && !episodes.length ? <div className="loading-state" role="status">正在加载节目…</div> : null}
        {episodes.length ? <ul className="episode-list album-episode-list">{episodes.map(episode => <EpisodeRow key={episode.id} episode={episode} onPlay={item => onPlay(item, episodes)} action={<LaterEpisodeAction episode={episode} onAdd={onAddLater} />} />)}</ul> : null}
        {!loading && !error && !episodes.length ? <div className="empty-state">这个专辑还没有节目</div> : null}
        {hasMore && !loading ? <button type="button" className="secondary-button load-more-button" onClick={() => loadPage(page + 1)}>加载更多</button> : null}
        {loading && episodes.length ? <div className="loading-more" role="status">正在加载下一页…</div> : null}
      </section>
    </div>
  );
});

