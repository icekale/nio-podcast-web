import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListMusic,
  ListPlus,
  List,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getEpisodes } from './api';
import { loadCatalog, normalizeCatalog, selectHomeEpisodes } from './catalog';
import { parseHash, withQueueHash, closeQueueHash } from './router';
import {
  PLAYER_STORAGE_KEY,
  advanceQueue,
  canResume,
  createPlayerState,
  enqueueEpisodes,
  insertNext,
  recordHistory,
  removeFromQueue,
  restorePlayerState,
  selectEpisode,
  serializePlayerState,
} from './playerState';
import './App.css';

function formatDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) return '--:--';
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const rest = totalSeconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function Artwork({ src, alt = '', className = '' }) {
  if (src) return <img className={`artwork ${className}`} src={src} alt={alt} loading="lazy" decoding="async" />;
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}

function EpisodeRow({ episode, onPlay, active = false, progress = 0, action }) {
  return (
    <li className={`episode-row${active ? ' is-active' : ''}`}>
      <button type="button" className="episode-main" onClick={() => onPlay(episode)}>
        <Artwork src={episode.albumPic} alt="" className="episode-art" />
        <span className="episode-copy">
          <span className="episode-title">{episode.title}</span>
          <span className="episode-meta">
            <span>{episode.albumName || 'NIO Radio'}</span>
            <span className="meta-divider" aria-hidden="true">|</span>
            <Clock3 size={14} aria-hidden="true" />
            <span>{formatDuration(episode.duration)}</span>
            {episode.onlineTime ? <><span className="meta-divider" aria-hidden="true">|</span><span>{formatDate(episode.onlineTime)}</span></> : null}
            {progress > 0 ? <span className="episode-progress-label">已听{Math.round(progress)}%</span> : null}
          </span>
        </span>
      </button>
      {action ? <div className="episode-action">{action}</div> : null}
    </li>
  );
}

function HomeScreen({ catalog, player, stale, onRetry, onPlay, onPlayAll, onSearch, onOpenAlbums }) {
  const [scrolled, setScrolled] = useState(false);
  const selection = useMemo(() => selectHomeEpisodes(catalog.albums, new Date()), [catalog.albums]);
  const recommendation = selection.episodes[0];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 180);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const progressFor = episode => {
    if (player.currentEpisode?.id === episode.id && player.durationSeconds > 0) {
      return (player.positionSeconds / player.durationSeconds) * 100;
    }
    return 0;
  };

  return (
    <div className="screen home-screen">
      <header className={`top-bar${scrolled ? ' top-bar-scrolled' : ''}`}>
        <button type="button" className="icon-button" aria-label="全部专辑" onClick={onOpenAlbums}><List size={24} /></button>
        <span className="top-title">{scrolled ? '今日推荐' : 'NIO Radio'}</span>
        <div className="top-actions">
          {scrolled && player.currentEpisode ? <button type="button" className="continue-button" onClick={() => onPlay(player.currentEpisode)}>▶ 继续播放</button> : null}
          <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
        </div>
      </header>

      {!scrolled ? (
        <section className="recommendation-panel" aria-labelledby="recommendation-title">
          <div className="recommendation-copy">
            <span className="section-kicker">TODAY</span>
            <h1 id="recommendation-title">今日推荐</h1>
            {recommendation ? (
              <>
                <h2>{recommendation.title}</h2>
                <p>{recommendation.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(recommendation.duration)}</p>
              </>
            ) : <p>今天还没有新的节目</p>}
          </div>
          <Artwork src={recommendation?.albumPic} alt="" className="recommendation-art" />
          <button type="button" className="primary-button" onClick={() => onPlayAll(selection.episodes)} disabled={!selection.episodes.length}>
            <Play size={18} fill="currentColor" aria-hidden="true" /> 全部播放
          </button>
        </section>
      ) : null}

      <section className="updates-section" aria-labelledby="updates-title">
        <div className="section-heading-row">
          <h2 id="updates-title">{selection.heading}</h2>
          <span className="section-count">{selection.episodes.length}</span>
        </div>
        {selection.episodes.length ? (
          <ul className="episode-list">
            {selection.episodes.map(episode => (
              <EpisodeRow key={episode.id} episode={episode} onPlay={item => onPlay(item, selection.episodes)} active={player.currentEpisode?.id === episode.id} progress={progressFor(episode)} />
            ))}
          </ul>
        ) : <div className="empty-state">暂无可播放的节目</div>}
      </section>
      {stale ? <div className="notice-bar" role="status">显示的是上次缓存的目录 <button type="button" onClick={onRetry}>刷新目录</button></div> : null}
    </div>
  );
}

export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender }) {
  onRender?.();
  return (
    <ul className="album-results">
      {albums.map(album => (
        <li key={album.id}>
          <button type="button" className="album-result" onClick={() => onOpenAlbum(album.id)}>
            <Artwork src={album.imageUrl} alt="" className="album-art" />
            <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
});

const SearchScreen = memo(function SearchScreen({ catalog, searchQuery = '', onBack, onQueryChange, onOpenAlbum }) {
  const query = searchQuery;
  const inputRef = useRef(null);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return catalog.albums;
    return catalog.albums.filter(album => `${album.name} ${album.description} ${album.host}`.toLowerCase().includes(value));
  }, [catalog.albums, query]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="screen search-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="search-field-wrap"><Search size={18} aria-hidden="true" /><input ref={inputRef} type="search" value={query} onChange={event => onQueryChange(event.target.value)} aria-label="搜索专辑" placeholder="搜索专辑" /></div>
        {query ? <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => onQueryChange('')}><X size={20} /></button> : <span className="icon-button-spacer" />}
      </header>
      <section className="search-results" aria-live="polite">
        <div className="section-heading-row"><h1>全部专辑</h1><span className="section-count">{filtered.length}</span></div>
        <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} />
        {!filtered.length ? <div className="empty-state">没有找到匹配的专辑</div> : null}
      </section>
    </div>
  );
});

const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum }) {
  return (
    <div className="screen albums-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">全部专辑</span>
        <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
      </header>
      <section className="search-results" aria-labelledby="albums-title">
        <div className="section-heading-row"><h1 id="albums-title">全部专辑</h1><span className="section-count">{catalog.albums.length}</span></div>
        <AlbumResults albums={catalog.albums} onOpenAlbum={onOpenAlbum} />
        {!catalog.albums.length ? <div className="empty-state">暂无可用专辑</div> : null}
      </section>
    </div>
  );
});

const AlbumScreen = memo(function AlbumScreen({ album, onBack, onPlay }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
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
      setHasMore(result.hasMore);
    } catch (reason) {
      if (sequence !== requestSeq.current) return;
      setError(reason);
    } finally {
      if (sequence === requestSeq.current) setLoading(false);
    }
  }, [album.id]);

  useEffect(() => {
    setEpisodes([]);
    loadPage(1);
  }, [loadPage]);

  return (
    <div className="screen album-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回专辑列表" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="album-header-copy"><h1>{album.name}</h1><span>{album.episodeCount || album.count || 0} 集</span></div>
        <span className="icon-button-spacer" />
      </header>
      <section className="album-content" aria-labelledby="album-episodes-title">
        <div className="album-intro"><Artwork src={album.imageUrl} alt="" className="album-hero-art" /><div><h2 id="album-episodes-title">节目列表</h2><p>{album.description || 'NIO Radio 精选内容'}</p></div></div>
        {error ? <div className="inline-error" role="alert"><CircleAlert size={18} /><span>节目加载失败，请检查网络后重试</span><button type="button" onClick={() => loadPage(page)}><RotateCcw size={16} />重新加载</button></div> : null}
        {loading && !episodes.length ? <div className="loading-state" role="status">正在加载节目…</div> : null}
        {episodes.length ? <ul className="episode-list album-episode-list">{episodes.map(episode => <EpisodeRow key={episode.id} episode={episode} onPlay={item => onPlay(item, episodes)} />)}</ul> : null}
        {!loading && !error && !episodes.length ? <div className="empty-state">这个专辑还没有节目</div> : null}
        {hasMore && !loading ? <button type="button" className="secondary-button load-more-button" onClick={() => loadPage(page + 1)}>加载更多</button> : null}
        {loading && episodes.length ? <div className="loading-more" role="status">正在加载下一页…</div> : null}
      </section>
    </div>
  );
});

function MiniPlayer({ player, isPlaying, audioError, onToggle, onRetry, onOpenQueue, queueButtonRef, onSeek }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  return (
    <section className="mini-player" aria-label="当前播放">
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        <button type="button" className="player-control" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      <div className="mini-progress-row"><span>{formatClock(player.positionSeconds)}</span><input aria-label="播放进度" type="range" min="0" max={duration || 0} step="1" value={Math.min(player.positionSeconds, duration || 0)} onChange={onSeek} /><span>{formatClock(duration)}</span></div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}

function QueueSheet({ player, activeTab, setActiveTab, onClose, onPlay, onPlayNext, onRemove }) {
  const closeRef = useRef(null);
  const startY = useRef(null);
  const [actionsFor, setActionsFor] = useState(null);
  const items = activeTab === 'queue' ? player.queue : player.history;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  return (
    <div className="queue-overlay">
      <button type="button" className="queue-backdrop" aria-label="关闭播放列表" onClick={onClose} />
      <section className="queue-sheet" role="dialog" aria-modal="true" aria-labelledby="queue-title" onPointerDown={event => { startY.current = event.clientY; }} onPointerUp={event => { if (startY.current !== null && event.clientY - startY.current > 80) onClose(); startY.current = null; }}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header"><h2 id="queue-title">播放列表</h2><button ref={closeRef} type="button" className="icon-button" aria-label="收起播放列表" onClick={onClose}><X size={21} /></button></div>
        <div className="queue-tabs" role="tablist" aria-label="播放内容">
          <button type="button" role="tab" aria-label="播放列表" aria-selected={activeTab === 'queue'} className={activeTab === 'queue' ? 'is-selected' : ''} onClick={() => setActiveTab('queue')}>播放列表 <span aria-hidden="true">{player.queue.length}</span></button>
          <button type="button" role="tab" aria-label="最近听过" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-selected' : ''} onClick={() => setActiveTab('history')}>最近听过 <span aria-hidden="true">{player.history.length}</span></button>
        </div>
        <div className="queue-scroll">
          {items.length ? <ul className="queue-list">{items.map((episode, index) => {
            const active = activeTab === 'queue' && player.currentEpisode?.id === episode.id;
            return <li key={`${episode.id}-${index}`} className={`queue-row${active ? ' is-current' : ''}`}>
              <button type="button" className="queue-row-main" onClick={() => onPlay(episode)}><Artwork src={episode.albumPic} alt="" className="queue-art" /><span className="queue-copy"><strong>{episode.title}</strong><span>{episode.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(episode.duration)}</span></span>{active ? <span className="queue-playing" aria-label="正在播放"><Music2 size={18} /></span> : null}</button>
              {activeTab === 'queue' ? <div className="queue-actions"><button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} onClick={() => setActionsFor(actionsFor === episode.id ? null : episode.id)}><MoreHorizontal size={20} /></button>{actionsFor === episode.id ? <div className="row-action-menu"><button type="button" onClick={() => { onPlayNext(episode); setActionsFor(null); }}><ListPlus size={16} />下一首播放</button><button type="button" onClick={() => { onRemove(episode.id); setActionsFor(null); }}><Trash2 size={16} />移出列表</button></div> : null}</div> : null}
            </li>;
          })}</ul> : <div className="queue-empty"><Music2 size={28} /><p>{activeTab === 'queue' ? '播放列表是空的' : '还没有听过的节目'}</p><span>选择一个节目后，它会出现在这里</span></div>}
        </div>
      </section>
    </div>
  );
}

function readStoredPlayer() {
  try { return restorePlayerState(window.localStorage.getItem(PLAYER_STORAGE_KEY)); } catch { return createPlayerState(); }
}

export default function App({ initialCatalog = null }) {
  const [route, setRoute] = useState(() => parseHash());
  const [catalogState, setCatalogState] = useState(() => {
    if (!initialCatalog) return { catalog: null, loading: true, error: null, stale: false };
    return { catalog: normalizeCatalog(initialCatalog), loading: false, error: null, stale: false };
  });
  const [player, setPlayer] = useState(readStoredPlayer);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [queueTab, setQueueTab] = useState('queue');
  const audioRef = useRef(null);
  const playerRef = useRef(player);
  const queueButtonRef = useRef(null);
  const lastSavedAt = useRef(0);
  const scrollPositions = useRef(new Map());
  playerRef.current = player;

  useEffect(() => {
    if (initialCatalog) return undefined;
    let active = true;
    loadCatalog().then(result => { if (active) setCatalogState({ catalog: result.catalog, loading: false, error: null, stale: result.stale }); }).catch(error => { if (active) setCatalogState({ catalog: null, loading: false, error, stale: false }); });
    return () => { active = false; };
  }, [initialCatalog]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    if (!window.history.state?.nioApp) {
      window.history.replaceState({ ...(window.history.state || {}), nioApp: true, nioDepth: 0 }, '', window.location.href);
    }
    const handleRouteChange = () => setRoute(parseHash());
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    if (!window.location.hash) window.history.replaceState({ nioApp: true, nioDepth: 0 }, '', '#/');
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    const key = closeQueueHash(window.location.hash || '#/');
    const position = scrollPositions.current.get(key) || 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = position;
    document.documentElement.scrollTop = position;
    document.body.scrollTop = position;
  }, [route.screen]);

  const savePlayer = useCallback((next, force = false) => {
    const now = Date.now();
    if (!force && now - lastSavedAt.current < 5000) return;
    try { window.localStorage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(next)); lastSavedAt.current = now; } catch { /* optional persistence */ }
  }, []);

  useEffect(() => { savePlayer(player); }, [player, savePlayer]);
  useEffect(() => {
    const save = () => savePlayer(player, true);
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [player, savePlayer]);

  useEffect(() => {
    const audio = audioRef.current;
    const { currentEpisode: episode, positionSeconds, durationSeconds } = playerRef.current;
    if (!audio || !episode?.audioUrl) return;
    audio.src = episode.audioUrl;
    audio.load();
    if (canResume(positionSeconds, durationSeconds)) {
      try { audio.currentTime = positionSeconds; } catch { /* metadata may not be ready */ }
    }
    const result = audio.play();
    result?.catch(() => setIsPlaying(false));
  }, [player.currentEpisode?.id]);

  const saveScrollPosition = useCallback((hash = window.location.hash || '#/') => {
    const position = Math.max(
      window.scrollY || 0,
      document.scrollingElement?.scrollTop || 0,
      document.documentElement.scrollTop || 0,
      document.body.scrollTop || 0,
    );
    scrollPositions.current.set(closeQueueHash(hash), position);
  }, []);
  const go = useCallback((hash, { replace = false } = {}) => {
    if (!replace) saveScrollPosition();
    const currentDepth = Number(window.history.state?.nioDepth) || 0;
    const state = { ...(window.history.state || {}), nioApp: true, nioDepth: replace ? currentDepth : currentDepth + 1 };
    if (replace) window.history.replaceState(state, '', hash);
    else window.history.pushState(state, '', hash);
    setRoute(parseHash(hash));
  }, [saveScrollPosition]);
  const openQueue = useCallback(() => go(withQueueHash(window.location.hash || '#/', true)), [go]);
  const closeQueue = useCallback(() => go(closeQueueHash(window.location.hash || '#/'), { replace: true }), [go]);
  const goBack = useCallback(() => {
    const depth = Number(window.history.state?.nioDepth) || 0;
    if (route.queueOpen) {
      if (depth > 0) window.history.back();
      else closeQueue();
      return;
    }
    if (depth > 0) {
      window.history.back();
      return;
    }
    if (route.screen === 'search') go('#/', { replace: true });
    else if (route.screen === 'album') go('#/albums', { replace: true });
    else if (route.screen !== 'home') go('#/', { replace: true });
  }, [closeQueue, go, route]);
  const openAlbums = useCallback(() => go('#/albums'), [go]);
  const updateSearchQuery = useCallback(query => {
    const raw = String(window.location.hash || '#/search').replace(/^#/, '') || '/search';
    const [path, queryString = ''] = raw.split('?');
    const params = new URLSearchParams(queryString);
    if (query) params.set('q', query);
    else params.delete('q');
    const serialized = params.toString();
    const hash = `#${path}${serialized ? `?${serialized}` : ''}`;
    const state = { ...(window.history.state || {}), nioApp: true, nioDepth: Number(window.history.state?.nioDepth) || 0 };
    window.history.replaceState(state, '', hash);
    setRoute(parseHash(hash));
  }, []);
  const retryCatalog = useCallback(() => { setCatalogState(previous => ({ ...previous, loading: true, error: null })); loadCatalog().then(result => setCatalogState({ catalog: result.catalog, loading: false, error: null, stale: result.stale })).catch(error => setCatalogState(previous => ({ ...previous, loading: false, error }))); }, []);

  const startPlayback = useCallback((episode, visibleQueue = null) => {
    setAudioError(null);
    setPlayer(previous => {
      let next = previous;
      if (visibleQueue?.length) next = enqueueEpisodes(next, visibleQueue);
      next = selectEpisode(next, episode, next.queue);
      return { ...next, history: recordHistory(previous.history, episode), isPlaying: true };
    });
    setIsPlaying(true);
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !player.currentEpisode) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setPlayer(previous => ({ ...previous, isPlaying: false }));
      savePlayer({ ...player, isPlaying: false }, true);
    } else {
      const result = audio.play();
      result?.catch(() => setAudioError('音频暂时无法播放，请稍后重试'));
      setIsPlaying(true);
      setPlayer(previous => ({ ...previous, isPlaying: true }));
    }
  }, [isPlaying, player, savePlayer]);

  const handleEnded = useCallback(() => {
    setPlayer(previous => {
      const next = advanceQueue(previous);
      if (next.currentEpisode && next.currentEpisode.id !== previous.currentEpisode?.id) return { ...next, history: recordHistory(previous.history, next.currentEpisode), isPlaying: true };
      return next;
    });
    setIsPlaying(false);
  }, []);

  const openSearch = useCallback(() => go('#/search'), [go]);
  const openAlbum = useCallback(id => go(`#/album/${id}`), [go]);
  const playAll = useCallback(episodes => startPlayback(episodes[0], episodes), [startPlayback]);
  const updatePosition = event => setPlayer(previous => ({ ...previous, positionSeconds: Number(event.currentTarget.value) }));
  const currentAlbum = catalogState.catalog?.albums.find(album => album.id === route.albumId);

  if (catalogState.loading) return <main className="app"><div className="full-state"><div className="loading-dot" /><p>正在准备 NIO Radio…</p></div></main>;
  if (catalogState.error && !catalogState.catalog) return <main className="app"><div className="full-state"><CircleAlert size={28} /><h1>目录暂时无法加载</h1><p>请检查网络后重试，已经缓存的节目仍可继续播放。</p><button type="button" className="primary-button" onClick={retryCatalog}><RotateCcw size={17} />重新加载</button></div></main>;
  if (!catalogState.catalog) return null;

  return (
    <main className="app">
      <div className="app-content">
        {route.screen === 'home' ? <HomeScreen catalog={catalogState.catalog} player={player} stale={catalogState.stale} onRetry={retryCatalog} onPlay={startPlayback} onPlayAll={playAll} onSearch={openSearch} onOpenAlbums={openAlbums} /> : null}
        {route.screen === 'albums' ? <AlbumsScreen catalog={catalogState.catalog} onBack={goBack} onSearch={openSearch} onOpenAlbum={openAlbum} /> : null}
        {route.screen === 'search' ? <SearchScreen catalog={catalogState.catalog} searchQuery={route.searchQuery} onBack={goBack} onQueryChange={updateSearchQuery} onOpenAlbum={openAlbum} /> : null}
        {route.screen === 'album' && currentAlbum ? <AlbumScreen album={currentAlbum} onBack={goBack} onPlay={startPlayback} /> : null}
        {route.screen === 'album' && !currentAlbum ? <div className="full-state"><h1>专辑不存在</h1><button type="button" className="secondary-button" onClick={() => go('#/')}>返回首页</button></div> : null}
      </div>
      <audio ref={audioRef} preload="metadata" onLoadedMetadata={event => { const duration = event.currentTarget?.duration || 0; setPlayer(previous => ({ ...previous, durationSeconds: duration || previous.durationSeconds })); }} onTimeUpdate={event => { const position = event.currentTarget?.currentTime || 0; setPlayer(previous => ({ ...previous, positionSeconds: position })); }} onPlay={() => { setIsPlaying(true); setAudioError(null); }} onPause={() => setIsPlaying(false)} onError={() => { setAudioError('音频加载失败，请检查网络后重试'); setIsPlaying(false); }} onEnded={handleEnded} />
      {player.currentEpisode ? <MiniPlayer player={player} isPlaying={isPlaying} audioError={audioError} onToggle={togglePlayback} onRetry={() => { setAudioError(null); audioRef.current?.load(); audioRef.current?.play().catch(() => setAudioError('音频暂时无法播放，请稍后重试')); }} onOpenQueue={openQueue} queueButtonRef={queueButtonRef} onSeek={updatePosition} /> : null}
      {route.queueOpen ? <QueueSheet player={player} activeTab={queueTab} setActiveTab={setQueueTab} onClose={closeQueue} onPlay={episode => startPlayback(episode, player.queue)} onPlayNext={episode => setPlayer(previous => insertNext(previous, episode))} onRemove={id => setPlayer(previous => removeFromQueue(previous, id))} /> : null}
    </main>
  );
}
