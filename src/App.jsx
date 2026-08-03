import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
import {
  addLaterEpisode,
  moveLaterEpisode,
  readLaterEpisodes,
  removeLaterEpisode,
  writeLaterEpisodes,
} from './laterPlayback';
import './App.css';

const CATALOG_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

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

function screenRouteKey(route) {
  return `${route.screen}:${route.albumId ?? ''}`;
}

function sameRoute(previous, next) {
  return previous.screen === next.screen
    && previous.albumId === next.albumId
    && previous.searchQuery === next.searchQuery
    && previous.queueOpen === next.queueOpen;
}

function routeMotionFor(previous, next) {
  if (previous.screen === 'home' && next.screen === 'albums') return 'forward';
  if (previous.screen !== 'home' && next.screen === 'home') return 'back';
  if (previous.screen !== 'album' && next.screen === 'album') return 'forward';
  if (previous.screen === 'album' && next.screen !== 'album') return 'back';
  return 'none';
}

function Artwork({ src, alt = '', className = '' }) {
  if (src) return <img className={`artwork ${className}`} src={src} alt={alt} loading="lazy" decoding="async" />;
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}

const EpisodeRow = memo(function EpisodeRow({ episode, onPlay, active = false, progress = 0, action, mainLabel }) {
  return (
    <li className={`episode-row${active ? ' is-active' : ''}`}>
      <button type="button" className="episode-main" aria-label={mainLabel} onClick={() => onPlay(episode)}>
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
});

function LaterEpisodeAction({ episode, onAdd }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const menuId = `episode-menu-${episode.id}`;

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => flushSync(() => setNotice('')), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!open) return undefined;
    const closeMenu = event => {
      if (!event.target?.closest?.('.episode-action')) setOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleAdd = () => {
    const result = onAdd(episode);
    setNotice(!result.added
      ? '已在稍后播放'
      : result.persisted
        ? '已添加到稍后播放'
        : '已添加到稍后播放，但无法保存，刷新后可能丢失');
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} aria-expanded={open} aria-haspopup="menu" aria-controls={menuId} onClick={() => setOpen(previous => !previous)}><MoreHorizontal size={15} aria-hidden="true" /></button>
      {open ? <div id={menuId} className="row-action-menu" role="menu"><button type="button" role="menuitem" aria-label="稍后播放" onClick={handleAdd}><ListPlus size={16} />稍后播放</button></div> : null}
      {notice ? <span className="episode-action-notice" role="status" aria-live="polite">{notice}</span> : null}
    </>
  );
}

function HomeScreen({ catalog, player, stale, refreshing = false, catalogError = null, onRetry, onPlay, onPlayAll, onSearch, onOpenAlbums }) {
  const [scrolled, setScrolled] = useState(false);
  const selection = useMemo(() => selectHomeEpisodes(catalog.albums, new Date()), [catalog.albums]);
  const recommendation = selection.episodes[0];

  useEffect(() => {
    const handleScroll = () => {
      const next = window.scrollY > 180;
      setScrolled(previous => previous === next ? previous : next);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePlay = useCallback(item => onPlay(item, selection.episodes), [onPlay, selection.episodes]);
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

      <section className="updates-section" aria-labelledby="updates-title">
        <div className="section-heading-row">
          <h2 id="updates-title">{selection.heading}</h2>
          <span className="section-count">{selection.episodes.length}</span>
        </div>
        {selection.episodes.length ? (
          <ul className="episode-list">
            {selection.episodes.map(episode => (
              <EpisodeRow key={episode.id} episode={episode} onPlay={handlePlay} active={player.currentEpisode?.id === episode.id} progress={progressFor(episode)} />
            ))}
          </ul>
        ) : <div className="empty-state">暂无可播放的节目</div>}
      </section>
      {(stale || refreshing || catalogError) ? <div className="notice-bar" role={catalogError ? 'alert' : 'status'}>{refreshing ? '正在刷新目录…' : catalogError ? '目录刷新失败，继续使用缓存内容' : '显示的是上次缓存的目录'} <button type="button" onClick={onRetry}>{refreshing ? '刷新中' : '刷新目录'}</button></div> : null}
    </div>
  );
}

const ALBUM_PAGE_SIZE = 100;

function useVisibleAlbums(albums) {
  const [visibleCount, setVisibleCount] = useState(ALBUM_PAGE_SIZE);
  useEffect(() => setVisibleCount(ALBUM_PAGE_SIZE), [albums]);
  return {
    visibleAlbums: albums.slice(0, visibleCount),
    hasMore: visibleCount < albums.length,
    loadMore: () => setVisibleCount(count => Math.min(count + ALBUM_PAGE_SIZE, albums.length)),
  };
}

export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender }) {
  onRender?.();
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  return (
    <ul className="album-results">
      {visibleAlbums.map(album => (
        <li key={album.id}>
          <button type="button" className="album-result" onClick={() => onOpenAlbum(album.id)}>
            <Artwork src={album.imageUrl} alt="" className="album-art" />
            <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </li>
      ))}
      {hasMore ? <li className="album-results-more"><button type="button" onClick={loadMore}>加载更多专辑</button></li> : null}
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

const AlbumScreen = memo(function AlbumScreen({ album, onBack, onPlay, onAddLater }) {
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

function LaterPicker({ catalog, onBack, onAdd }) {
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestSeq = useRef(0);
  const selectedAlbum = catalog?.albums.find(album => album.id === selectedAlbumId);

  const loadPage = useCallback(async (albumId, pageNumber) => {
    const sequence = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getEpisodes(albumId, pageNumber);
      if (sequence !== requestSeq.current) return;
      setEpisodes(previous => pageNumber === 1 ? result.episodes : [...previous, ...result.episodes]);
      setPage(pageNumber);
      setHasMore(result.hasMore);
    } catch (reason) {
      if (sequence === requestSeq.current) setError(reason);
    } finally {
      if (sequence === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAlbumId == null) return undefined;
    setEpisodes([]);
    setPage(1);
    setHasMore(false);
    loadPage(selectedAlbumId, 1);
    return undefined;
  }, [loadPage, selectedAlbumId]);

  if (!catalog) {
    return (
      <div className="later-picker">
        <div className="later-picker-header"><button type="button" className="icon-button" aria-label="返回稍后播放" onClick={onBack}><ArrowLeft size={21} /></button><h3>添加节目</h3><span className="icon-button-spacer" /></div>
        <div className="loading-state" role="status">正在准备节目目录…</div>
      </div>
    );
  }

  if (!selectedAlbum) {
    return (
      <div className="later-picker">
        <div className="later-picker-header"><button type="button" className="icon-button" aria-label="返回稍后播放" onClick={onBack}><ArrowLeft size={21} /></button><h3>添加节目</h3><span className="icon-button-spacer" /></div>
        <p className="later-picker-intro">选择专辑后添加单期节目</p>
        <AlbumPickerList albums={catalog.albums} onSelect={setSelectedAlbumId} />
      </div>
    );
  }

  return (
    <div className="later-picker">
      <div className="later-picker-header"><button type="button" className="icon-button" aria-label="返回稍后播放" onClick={onBack}><ArrowLeft size={21} /></button><h3>{selectedAlbum.name}</h3><span className="icon-button-spacer" /></div>
      {error ? <div className="inline-error" role="alert"><CircleAlert size={18} /><span>节目加载失败，请重试</span><button type="button" onClick={() => loadPage(selectedAlbum.id, page)}><RotateCcw size={16} />重试</button></div> : null}
      {loading && !episodes.length ? <div className="loading-state" role="status">正在加载节目…</div> : null}
      {episodes.length ? <ul className="episode-list later-picker-list">{episodes.map(episode => <EpisodeRow key={episode.id} episode={episode} mainLabel={episode.title} action={<button type="button" className="icon-button" aria-label={`添加 ${episode.title} 到稍后播放`} onClick={() => onAdd(episode)}><ListPlus size={17} /></button>} onPlay={onAdd} />)}</ul> : null}
      {!loading && !error && !episodes.length ? <div className="empty-state">这个专辑还没有节目</div> : null}
      {hasMore && !loading ? <button type="button" className="secondary-button load-more-button" onClick={() => loadPage(selectedAlbum.id, page + 1)}>加载更多</button> : null}
      {loading && episodes.length ? <div className="loading-more" role="status">正在加载下一页…</div> : null}
    </div>
  );
}

function AlbumPickerList({ albums, onSelect }) {
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  return (
    <ul className="album-results later-album-picker-list">
      {visibleAlbums.map(album => (
        <li key={album.id}>
          <button type="button" className="album-result" aria-label={`选择专辑 ${album.name}`} onClick={() => onSelect(album.id)}>
            <Artwork src={album.imageUrl} alt="" className="album-art" />
            <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </li>
      ))}
      {hasMore ? <li className="album-results-more"><button type="button" onClick={loadMore}>加载更多专辑</button></li> : null}
    </ul>
  );
}

function LaterQueueRow({ episode, index, count, onPlay, onRemove, onMove, menuOpen, onToggleMenu }) {
  const [swiped, setSwiped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gestureRef = useRef(null);
  const longPressRef = useRef(null);
  const suppressClickRef = useRef(false);

  const clearLongPress = () => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const handlePointerDown = event => {
    if (event.target.closest('.later-actions, .later-swipe-action')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gestureRef.current = { startX: event.clientX, startY: event.clientY, mode: 'pending' };
    if (event.pointerType !== 'mouse') {
      longPressRef.current = window.setTimeout(() => {
        if (gestureRef.current?.mode === 'pending') {
          gestureRef.current.mode = 'drag';
          setDragging(true);
        }
      }, 250);
    }
  };

  const handlePointerMove = event => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (gesture.mode === 'pending') {
      if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) return;
      clearLongPress();
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -12) {
        gesture.mode = 'swipe';
        setSwiped(true);
        event.preventDefault();
      } else {
        gesture.mode = 'cancelled';
      }
    } else if (gesture.mode === 'swipe') {
      setSwiped(deltaX < -12);
      event.preventDefault();
    } else if (gesture.mode === 'drag') {
      event.preventDefault();
    }
  };

  const handlePointerUp = event => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    clearLongPress();
    const deltaY = event.clientY - gesture.startY;
    if (gesture.mode === 'drag') {
      setDragging(false);
      if (deltaY < -32 && index > 0) onMove(index, index - 1);
      if (deltaY > 32 && index < count - 1) onMove(index, index + 1);
      suppressClickRef.current = true;
    } else if (gesture.mode === 'swipe') {
      suppressClickRef.current = true;
    }
    gestureRef.current = null;
  };

  const handleMainClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (swiped) {
      setSwiped(false);
      return;
    }
    onPlay();
  };

  return (
    <li className={`queue-row later-row${swiped ? ' is-swiped' : ''}${dragging ? ' is-dragging' : ''}${menuOpen ? ' is-menu-open' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { clearLongPress(); gestureRef.current = null; setDragging(false); }}>
      <button type="button" className="later-swipe-action" tabIndex={swiped ? 0 : -1} aria-hidden={!swiped} aria-label={`移除 ${episode.title}`} onClick={() => { setSwiped(false); onRemove(episode.id); }}>移除</button>
      <button type="button" className="queue-row-main" aria-label={episode.title} onClick={handleMainClick}><Artwork src={episode.albumPic} alt="" className="queue-art" /><span className="queue-copy"><strong>{episode.title}</strong><span>{episode.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(episode.duration)}</span></span></button>
      <div className="later-actions"><button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={`later-menu-${episode.id}`} onClick={() => onToggleMenu(!menuOpen)}><MoreHorizontal size={15} aria-hidden="true" /></button>{menuOpen ? <div id={`later-menu-${episode.id}`} className="row-action-menu" role="menu"><button type="button" role="menuitem" disabled={index === 0} onClick={() => { onMove(index, index - 1); onToggleMenu(false); }}><ChevronUp size={15} />上移</button><button type="button" role="menuitem" disabled={index === count - 1} onClick={() => { onMove(index, index + 1); onToggleMenu(false); }}><ChevronDown size={15} />下移</button><button type="button" role="menuitem" onClick={() => { onRemove(episode.id); onToggleMenu(false); }}><Trash2 size={16} />移除</button></div> : null}</div>
    </li>
  );
}

const QueueSheet = memo(function QueueSheet({ queue, history, currentEpisodeId, laterEpisodes, activeTab, setActiveTab, isClosing, onExited, onClose, onPlay, onPlayLater, onPlayNext, onRemove, catalog, onAddLater, onRemoveLater, onMoveLater }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const startY = useRef(null);
  const [actionsFor, setActionsFor] = useState(null);
  const [laterActionsFor, setLaterActionsFor] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);
  const tabRefs = useRef(new Map());
  const items = activeTab === 'queue' ? queue : activeTab === 'history' ? history : laterEpisodes;
  const menuStateRef = useRef({ actionsFor: null, laterActionsFor: null, pickerOpen: false });
  menuStateRef.current = { actionsFor, laterActionsFor, pickerOpen };

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        const { actionsFor: openQueueMenu, laterActionsFor: openLaterMenu, pickerOpen: isPickerOpen } = menuStateRef.current;
        if (openQueueMenu !== null || openLaterMenu !== null) {
          setActionsFor(null);
          setLaterActionsFor(null);
          event.preventDefault();
          return;
        }
        if (isPickerOpen) {
          setPickerOpen(false);
          event.preventDefault();
          return;
        }
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  useEffect(() => {
    if (!isClosing) return undefined;
    const timer = window.setTimeout(onExited, 250);
    return () => window.clearTimeout(timer);
  }, [isClosing, onExited]);

  const handleAnimationEnd = event => {
    if (isClosing && event.target === event.currentTarget && event.animationName === 'queue-sheet-out') onExited();
  };

  const selectTab = tab => {
    setActiveTab(tab);
    setPickerOpen(false);
    setNotice('');
    setActionsFor(null);
    setLaterActionsFor(null);
  };

  const handleTabKeyDown = event => {
    const tabs = ['queue', 'history', 'later'];
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectTab(nextTab);
    window.requestAnimationFrame(() => tabRefs.current.get(nextTab)?.focus());
  };

  const handleAddLater = episode => {
    const result = onAddLater(episode);
    setNotice(!result.added
      ? '已在稍后播放'
      : result.persisted
        ? '已添加到稍后播放'
        : '已添加到稍后播放，但无法保存，刷新后可能丢失');
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2400);
  };

  return (
    <div className={`queue-overlay${isClosing ? ' is-closing' : ''}`}>
      <button type="button" className="queue-backdrop" aria-label="关闭播放列表" onClick={onClose} />
      <section ref={dialogRef} className={`queue-sheet${isClosing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="queue-title" onAnimationEnd={handleAnimationEnd} onPointerDown={event => { startY.current = event.target.closest('.queue-scroll') ? null : event.clientY; }} onPointerUp={event => { if (startY.current !== null && event.clientY - startY.current > 80) onClose(); startY.current = null; }} onPointerCancel={() => { startY.current = null; }}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header"><h2 id="queue-title">播放列表</h2><button ref={closeRef} type="button" className="icon-button" aria-label="收起播放列表" onClick={onClose}><X size={21} /></button></div>
        <div className="queue-tabs" role="tablist" aria-label="播放内容">
          <button ref={element => tabRefs.current.set('queue', element)} id="queue-tab" tabIndex={activeTab === 'queue' ? 0 : -1} type="button" role="tab" aria-controls="queue-panel" aria-label="播放列表" aria-selected={activeTab === 'queue'} className={activeTab === 'queue' ? 'is-selected' : ''} onKeyDown={handleTabKeyDown} onClick={() => selectTab('queue')}>播放列表 <span aria-hidden="true">{queue.length}</span></button>
          <button ref={element => tabRefs.current.set('history', element)} id="history-tab" tabIndex={activeTab === 'history' ? 0 : -1} type="button" role="tab" aria-controls="queue-panel" aria-label="最近听过" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-selected' : ''} onKeyDown={handleTabKeyDown} onClick={() => selectTab('history')}>最近听过 <span aria-hidden="true">{history.length}</span></button>
          <button ref={element => tabRefs.current.set('later', element)} id="later-tab" tabIndex={activeTab === 'later' ? 0 : -1} type="button" role="tab" aria-controls="queue-panel" aria-label="稍后播放" aria-selected={activeTab === 'later'} className={activeTab === 'later' ? 'is-selected' : ''} onKeyDown={handleTabKeyDown} onClick={() => selectTab('later')}>稍后播放 <span aria-hidden="true">{laterEpisodes.length}</span></button>
        </div>
        {activeTab === 'later' && !pickerOpen ? <div className="later-add-row"><span>保存的节目</span><button type="button" className="secondary-button" aria-label="添加节目" disabled={!catalog} onClick={() => { if (catalog) setPickerOpen(true); }}><ListPlus size={16} />添加节目</button></div> : null}
        {notice ? <div className="later-notice" role="status" aria-live="polite">{notice}</div> : null}
        <div id="queue-panel" className="queue-scroll" role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
          {pickerOpen ? <LaterPicker catalog={catalog} onBack={() => setPickerOpen(false)} onAdd={handleAddLater} /> : items.length ? <ul className="queue-list">{items.map((episode, index) => {
            if (activeTab === 'later') return <LaterQueueRow key={`${episode.id}-${index}`} episode={episode} index={index} count={items.length} onPlay={() => onPlayLater(episode)} onRemove={onRemoveLater} onMove={onMoveLater} menuOpen={laterActionsFor === episode.id} onToggleMenu={open => setLaterActionsFor(open ? episode.id : null)} />;
            const active = activeTab === 'queue' && currentEpisodeId === episode.id;
            return <li key={`${episode.id}-${index}`} className={`queue-row${active ? ' is-current' : ''}${actionsFor === episode.id ? ' is-menu-open' : ''}`}>
              <button type="button" className="queue-row-main" aria-label={activeTab === 'later' ? episode.title : undefined} onClick={() => (activeTab === 'later' ? onPlayLater(episode) : onPlay(episode))}><Artwork src={episode.albumPic} alt="" className="queue-art" /><span className="queue-copy"><strong>{episode.title}</strong><span>{episode.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(episode.duration)}</span></span>{active ? <span className="queue-playing" aria-label="正在播放"><Music2 size={18} /></span> : null}</button>
              {activeTab === 'queue' ? <div className="queue-actions"><button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} aria-expanded={actionsFor === episode.id} aria-haspopup="menu" aria-controls={`queue-menu-${episode.id}`} onClick={() => setActionsFor(actionsFor === episode.id ? null : episode.id)}><MoreHorizontal size={20} /></button>{actionsFor === episode.id ? <div id={`queue-menu-${episode.id}`} className="row-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onPlayNext(episode); setActionsFor(null); }}><ListPlus size={16} />下一首播放</button><button type="button" role="menuitem" onClick={() => { onRemove(episode.id); setActionsFor(null); }}><Trash2 size={16} />移出列表</button></div> : null}</div> : null}
            </li>;
          })}</ul> : <div className="queue-empty"><Music2 size={28} /><p>{activeTab === 'queue' ? '播放列表是空的' : activeTab === 'history' ? '还没有听过的节目' : '稍后播放是空的'}</p><span>选择一个节目后，它会出现在这里</span></div>}
        </div>
      </section>
    </div>
  );
});

function readStoredPlayer() {
  try { return restorePlayerState(window.localStorage.getItem(PLAYER_STORAGE_KEY)); } catch { return createPlayerState(); }
}

export default function App({ initialCatalog = null }) {
  const [route, setRoute] = useState(() => parseHash());
  const [routeMotion, setRouteMotion] = useState('none');
  const [queuePresent, setQueuePresent] = useState(() => route.queueOpen);
  const [queueClosing, setQueueClosing] = useState(false);
  const [catalogState, setCatalogState] = useState(() => {
    if (!initialCatalog) return { catalog: null, loading: true, error: null, stale: false };
    return { catalog: normalizeCatalog(initialCatalog), loading: false, error: null, stale: false };
  });
  const [player, setPlayer] = useState(readStoredPlayer);
  const [laterEpisodes, setLaterEpisodes] = useState(readLaterEpisodes);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [queueTab, setQueueTab] = useState('queue');
  const audioRef = useRef(null);
  const playerRef = useRef(player);
  const laterEpisodesRef = useRef(laterEpisodes);
  const queueButtonRef = useRef(null);
  const lastSavedAt = useRef(0);
  const scrollPositions = useRef(new Map());
  const routeRef = useRef(route);
  const queueFocusRef = useRef(null);
  const lastCatalogRefreshAt = useRef(0);
  const catalogRefreshPromise = useRef(null);
  playerRef.current = player;
  laterEpisodesRef.current = laterEpisodes;

  const applyRoute = useCallback(nextRoute => {
    const previousRoute = routeRef.current;
    if (sameRoute(previousRoute, nextRoute)) return;
    setRouteMotion(screenRouteKey(previousRoute) === screenRouteKey(nextRoute)
      ? 'none'
      : routeMotionFor(previousRoute, nextRoute));
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  const handleQueueExited = useCallback(() => {
    setQueuePresent(false);
    setQueueClosing(false);
  }, []);

  const refreshCatalog = useCallback(({ showLoading = false, force = false } = {}) => {
    if (catalogRefreshPromise.current) return catalogRefreshPromise.current;
    if (!force && Date.now() - lastCatalogRefreshAt.current < CATALOG_REFRESH_COOLDOWN_MS) return Promise.resolve(null);
    if (showLoading) setCatalogState(previous => ({ ...previous, loading: true, error: null }));
    lastCatalogRefreshAt.current = Date.now();
    const request = loadCatalog()
      .then(result => {
        setCatalogState({ catalog: result.catalog, loading: false, error: null, stale: result.stale });
        return result;
      })
      .catch(error => {
        setCatalogState(previous => ({ ...previous, loading: false, error, stale: Boolean(previous.catalog) }));
        return null;
      })
      .finally(() => {
        if (catalogRefreshPromise.current === request) catalogRefreshPromise.current = null;
      });
    catalogRefreshPromise.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (initialCatalog) return undefined;
    refreshCatalog({ force: true });
    return undefined;
  }, [initialCatalog, refreshCatalog]);

  useEffect(() => {
    if (initialCatalog) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCatalog();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, CATALOG_REFRESH_COOLDOWN_MS);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [initialCatalog, refreshCatalog]);

  useEffect(() => {
    if (initialCatalog || !['home', 'albums'].includes(route.screen)) return undefined;
    refreshCatalog();
    return undefined;
  }, [initialCatalog, refreshCatalog, route.screen]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    if (!window.history.state?.nioApp) {
      window.history.replaceState({ ...(window.history.state || {}), nioApp: true, nioDepth: 0 }, '', window.location.href);
    }
    const handleRouteChange = () => applyRoute(parseHash());
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    if (!window.location.hash) window.history.replaceState({ nioApp: true, nioDepth: 0 }, '', '#/');
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [applyRoute]);

  useLayoutEffect(() => {
    const key = closeQueueHash(window.location.hash || '#/');
    const position = scrollPositions.current.get(key) || 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = position;
    document.documentElement.scrollTop = position;
    document.body.scrollTop = position;
  }, [route.screen]);

  useEffect(() => {
    if (route.queueOpen) {
      setQueuePresent(true);
      setQueueClosing(false);
    } else if (queuePresent) {
      setQueueClosing(true);
    }
  }, [queuePresent, route.queueOpen]);

  useLayoutEffect(() => {
    if (queuePresent || !queueFocusRef.current) return;
    const trigger = queueFocusRef.current;
    queueFocusRef.current = null;
    trigger.focus?.({ preventScroll: true });
  }, [queuePresent]);

  const savePlayer = useCallback((next, force = false) => {
    const now = Date.now();
    if (!force && now - lastSavedAt.current < 5000) return;
    try { window.localStorage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(next)); lastSavedAt.current = now; } catch { /* optional persistence */ }
  }, []);

  const addToLater = useCallback(episode => {
    const result = addLaterEpisode(laterEpisodesRef.current, episode);
    if (!result.added) return { added: false, persisted: true };
    laterEpisodesRef.current = result.items;
    setLaterEpisodes(result.items);
    return { added: true, persisted: writeLaterEpisodes(result.items) };
  }, []);

  const removeFromLater = useCallback(id => {
    setLaterEpisodes(previous => {
      const next = removeLaterEpisode(previous, id);
      if (next.length !== previous.length) writeLaterEpisodes(next);
      laterEpisodesRef.current = next;
      return next;
    });
  }, []);

  const moveFromLater = useCallback((fromIndex, toIndex) => {
    setLaterEpisodes(previous => {
      const next = moveLaterEpisode(previous, fromIndex, toIndex);
      if (next !== previous) writeLaterEpisodes(next);
      laterEpisodesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => { savePlayer(player); }, [player, savePlayer]);
  useEffect(() => { savePlayer(playerRef.current, true); }, [player.currentEpisode?.id, savePlayer]);
  useEffect(() => {
    const save = () => savePlayer(playerRef.current, true);
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [savePlayer]);

  const setPlaybackFailure = useCallback(message => {
    setAudioError(message);
    setIsPlaying(false);
    setPlayer(previous => ({ ...previous, isPlaying: false }));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const { currentEpisode: episode, positionSeconds, durationSeconds, isPlaying: shouldPlay } = playerRef.current;
    if (!audio) return;
    if (!episode?.audioUrl) {
      if (shouldPlay) setPlaybackFailure('该节目没有可播放音频，请稍后重试');
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }
    audio.src = episode.audioUrl;
    audio.load();
    if (canResume(positionSeconds, durationSeconds)) {
      try { audio.currentTime = positionSeconds; } catch { /* metadata may not be ready */ }
    }
    if (!shouldPlay) {
      audio.pause();
      return;
    }
    const result = audio.play();
    result?.catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试'));
  }, [player.currentEpisode?.id, setPlaybackFailure]);

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
    applyRoute(parseHash(hash));
  }, [applyRoute, saveScrollPosition]);
  const openQueue = useCallback(() => {
    queueFocusRef.current = queueButtonRef.current;
    go(withQueueHash(window.location.hash || '#/', true));
  }, [go]);
  const closeQueue = useCallback(() => {
    const depth = Number(window.history.state?.nioDepth) || 0;
    if (parseHash(window.location.hash || '#/').queueOpen && depth > 0) {
      setQueueClosing(true);
      window.history.back();
      return;
    }
    setQueueClosing(true);
    go(closeQueueHash(window.location.hash || '#/'), { replace: true });
  }, [go]);
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
    applyRoute(parseHash(hash));
  }, [applyRoute]);
  const retryCatalog = useCallback(() => {
    refreshCatalog({ showLoading: true, force: true });
  }, [refreshCatalog]);

  const startPlayback = useCallback((episode, visibleQueue = null) => {
    if (!episode) return;
    setAudioError(null);
    if (!episode.audioUrl) {
      setPlaybackFailure('该节目没有可播放音频，请稍后重试');
      setPlayer(previous => {
        let next = previous;
        if (visibleQueue?.length) next = enqueueEpisodes(next, visibleQueue);
        next = selectEpisode(next, episode, next.queue);
        return { ...next, history: recordHistory(previous.history, episode), isPlaying: false };
      });
      return;
    }
    const sameEpisode = playerRef.current.currentEpisode?.id === episode.id;
    if (sameEpisode && audioRef.current) {
      try { audioRef.current.currentTime = 0; } catch { /* media may not be ready */ }
      const result = audioRef.current.play();
      result?.catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试'));
    }
    setPlayer(previous => {
      let next = previous;
      if (visibleQueue?.length) next = enqueueEpisodes(next, visibleQueue);
      next = selectEpisode(next, episode, next.queue);
      return { ...next, history: recordHistory(previous.history, episode), isPlaying: true };
    });
    setIsPlaying(true);
  }, [setPlaybackFailure]);

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
      result?.catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试'));
      setIsPlaying(true);
      setPlayer(previous => ({ ...previous, isPlaying: true }));
    }
  }, [isPlaying, player, savePlayer, setPlaybackFailure]);

  const handleEnded = useCallback(() => {
    const completedEpisode = playerRef.current.currentEpisode;
    if (completedEpisode) removeFromLater(completedEpisode.id);
    setPlayer(previous => {
      const next = advanceQueue(previous);
      if (next.currentEpisode && next.currentEpisode.id !== previous.currentEpisode?.id) return { ...next, history: recordHistory(previous.history, next.currentEpisode), isPlaying: true };
      return next;
    });
    const next = advanceQueue(playerRef.current);
    setIsPlaying(Boolean(next.currentEpisode && next.currentEpisode.id !== playerRef.current.currentEpisode?.id));
  }, [removeFromLater]);

  const openSearch = useCallback(() => go('#/search'), [go]);
  const openAlbum = useCallback(id => go(`#/album/${id}`), [go]);
  const playAll = useCallback(episodes => startPlayback(episodes[0], episodes), [startPlayback]);
  const playQueueEpisode = useCallback(episode => startPlayback(episode, playerRef.current.queue), [startPlayback]);
  const playLaterEpisode = useCallback(episode => startPlayback(episode, laterEpisodesRef.current), [startPlayback]);
  const playNextEpisode = useCallback(episode => setPlayer(previous => insertNext(previous, episode)), []);
  const removeQueueEpisode = useCallback(id => setPlayer(previous => removeFromQueue(previous, id)), []);
  const updatePosition = event => {
    const position = Number(event.currentTarget.value);
    if (!Number.isFinite(position)) return;
    const audio = audioRef.current;
    if (audio) {
      try { audio.currentTime = position; } catch { /* media may not be ready */ }
    }
    setPlayer(previous => ({ ...previous, positionSeconds: position }));
  };
  const currentAlbum = catalogState.catalog?.albums.find(album => album.id === route.albumId);
  const routeViewKey = screenRouteKey(route);
  const hasCatalog = Boolean(catalogState.catalog);

  return (
    <main className="app">
      <div className="app-content" inert={queuePresent ? true : undefined}>
        {!hasCatalog ? <div className="full-state">
          {catalogState.loading ? <><div className="loading-dot" /><p>正在准备 NIO Radio…</p></> : <><CircleAlert size={28} /><h1>目录暂时无法加载</h1><p>请检查网络后重试，已缓存的节目仍可继续播放。</p><button type="button" className="primary-button" onClick={retryCatalog}><RotateCcw size={17} />重新加载</button></>}
        </div> : <div key={routeViewKey} className="route-view" data-route-motion={routeMotion}>
          {route.screen === 'home' ? <HomeScreen catalog={catalogState.catalog} player={player} stale={catalogState.stale} refreshing={catalogState.loading} catalogError={catalogState.error} onRetry={retryCatalog} onPlay={startPlayback} onPlayAll={playAll} onSearch={openSearch} onOpenAlbums={openAlbums} /> : null}
          {route.screen === 'albums' ? <AlbumsScreen catalog={catalogState.catalog} onBack={goBack} onSearch={openSearch} onOpenAlbum={openAlbum} /> : null}
          {route.screen === 'search' ? <SearchScreen catalog={catalogState.catalog} searchQuery={route.searchQuery} onBack={goBack} onQueryChange={updateSearchQuery} onOpenAlbum={openAlbum} /> : null}
          {route.screen === 'album' && currentAlbum ? <AlbumScreen album={currentAlbum} onBack={goBack} onPlay={startPlayback} onAddLater={addToLater} /> : null}
          {route.screen === 'album' && !currentAlbum ? <div className="full-state"><h1>专辑不存在</h1><button type="button" className="secondary-button" onClick={() => go('#/')}>返回首页</button></div> : null}
        </div>}
      </div>
      <audio ref={audioRef} preload="metadata" onLoadedMetadata={event => { const duration = event.currentTarget?.duration || 0; setPlayer(previous => ({ ...previous, durationSeconds: duration || previous.durationSeconds })); }} onTimeUpdate={event => { const position = event.currentTarget?.currentTime || 0; setPlayer(previous => ({ ...previous, positionSeconds: position })); }} onPlay={() => { setIsPlaying(true); setAudioError(null); setPlayer(previous => ({ ...previous, isPlaying: true })); }} onPause={event => { if (event.currentTarget?.ended) return; setIsPlaying(false); setPlayer(previous => ({ ...previous, isPlaying: false })); }} onError={() => setPlaybackFailure('音频加载失败，请检查网络后重试')} onEnded={handleEnded} />
      {player.currentEpisode ? <MiniPlayer player={player} isPlaying={isPlaying} audioError={audioError} onToggle={togglePlayback} onRetry={() => { setAudioError(null); audioRef.current?.load(); audioRef.current?.play().catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试')); }} onOpenQueue={openQueue} queueButtonRef={queueButtonRef} onSeek={updatePosition} /> : null}
      {queuePresent ? <QueueSheet queue={player.queue} history={player.history} currentEpisodeId={player.currentEpisode?.id} laterEpisodes={laterEpisodes} activeTab={queueTab} setActiveTab={setQueueTab} isClosing={queueClosing} onExited={handleQueueExited} onClose={closeQueue} onPlay={playQueueEpisode} onPlayLater={playLaterEpisode} onPlayNext={playNextEpisode} onRemove={removeQueueEpisode} catalog={catalogState.catalog} onAddLater={addToLater} onRemoveLater={removeFromLater} onMoveLater={moveFromLater} /> : null}
    </main>
  );
}
