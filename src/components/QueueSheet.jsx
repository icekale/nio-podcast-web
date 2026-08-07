import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, CircleAlert, ListPlus, MoreHorizontal, Music2, RotateCcw, Share2, Timer, Trash2, X } from 'lucide-react';
import { getEpisodes } from '../api';
import { Artwork } from './Artwork';
import { EpisodeRow } from './EpisodeRow';
import { formatDuration } from '../format';
import { useVisibleAlbums } from '../hooks/useVisibleAlbums';
import { SLEEP_OPTIONS } from '../playbackPrefs';

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
    gestureRef.current = { startX: event.clientX, startY: event.clientY, mode: 'pending', element: event.currentTarget, pointerId: event.pointerId };
    if (event.pointerType !== 'mouse') {
      longPressRef.current = window.setTimeout(() => {
        const gesture = gestureRef.current;
        if (gesture?.mode === 'pending') {
          gesture.mode = 'drag';
          gesture.element?.setPointerCapture?.(gesture.pointerId);
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
        gesture.element?.setPointerCapture?.(gesture.pointerId);
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
    if (gesture.element?.hasPointerCapture?.(gesture.pointerId)) {
      gesture.element.releasePointerCapture?.(gesture.pointerId);
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
    <li style={{ '--i': Math.min(index, 8) }} className={`queue-row later-row${swiped ? ' is-swiped' : ''}${dragging ? ' is-dragging' : ''}${menuOpen ? ' is-menu-open' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { clearLongPress(); const gesture = gestureRef.current; if (gesture?.element?.hasPointerCapture?.(gesture.pointerId)) gesture.element.releasePointerCapture?.(gesture.pointerId); gestureRef.current = null; setDragging(false); }}>
      <button type="button" className="later-swipe-action" tabIndex={swiped ? 0 : -1} aria-hidden={!swiped} aria-label={`移除 ${episode.title}`} onClick={() => { setSwiped(false); onRemove(episode.id); }}>移除</button>
      <button type="button" className="queue-row-main" aria-label={episode.title} onClick={handleMainClick}><Artwork src={episode.albumPic} alt="" className="queue-art" /><span className="queue-copy"><strong>{episode.title}</strong><span>{episode.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(episode.duration)}</span></span></button>
      <div className="later-actions"><button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={`later-menu-${episode.id}`} onClick={() => onToggleMenu(!menuOpen)}><MoreHorizontal size={15} aria-hidden="true" /></button>{menuOpen ? <div id={`later-menu-${episode.id}`} className="row-action-menu" role="menu"><button type="button" role="menuitem" disabled={index === 0} onClick={() => { onMove(index, index - 1); onToggleMenu(false); }}><ChevronUp size={15} />上移</button><button type="button" role="menuitem" disabled={index === count - 1} onClick={() => { onMove(index, index + 1); onToggleMenu(false); }}><ChevronDown size={15} />下移</button><button type="button" role="menuitem" onClick={() => { onRemove(episode.id); onToggleMenu(false); }}><Trash2 size={16} />移除</button></div> : null}</div>
    </li>
  );
}

export const QueueSheet = memo(function QueueSheet({ queue, history, currentEpisodeId, laterEpisodes, activeTab, setActiveTab, isClosing, onExited, onClose, onPlay, onPlayLater, onPlayNext, onRemove, catalog, onAddLater, onRemoveLater, onMoveLater, sleepTimer, onSetSleepTimer, onShareEpisode }) {
  const [sleepOpen, setSleepOpen] = useState(false);
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
        <div className="sheet-header"><h2 id="queue-title">播放列表</h2><div className="header-actions"><span className="sleep-trigger"><button type="button" className={`icon-button${sleepTimer ? ' is-active' : ''}`} aria-label="睡眠定时" aria-expanded={sleepOpen} aria-haspopup="menu" onClick={() => setSleepOpen(open => !open)}><Timer size={20} /></button>{sleepOpen ? <div className="sleep-menu" role="menu">{SLEEP_OPTIONS.map(minutes => <button key={minutes} type="button" role="menuitem" aria-pressed={sleepTimer?.mode === 'minutes' && sleepTimer.minutes === minutes} onClick={() => { onSetSleepTimer(minutes); setSleepOpen(false); }}>{minutes} 分钟</button>)}<button type="button" role="menuitem" aria-pressed={sleepTimer?.mode === 'episode-end'} onClick={() => { onSetSleepTimer('episode-end'); setSleepOpen(false); }}>本集结束</button>{sleepTimer ? <button type="button" role="menuitem" onClick={() => { onSetSleepTimer(null); setSleepOpen(false); }}>关闭定时</button> : null}</div> : null}</span><button ref={closeRef} type="button" className="icon-button" aria-label="收起播放列表" onClick={onClose}><X size={21} /></button></div></div>
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
            return <li key={`${episode.id}-${index}`} style={{ '--i': Math.min(index, 8) }} className={`queue-row${active ? ' is-current' : ''}${actionsFor === episode.id ? ' is-menu-open' : ''}`}>
              <button type="button" className="queue-row-main" aria-label={activeTab === 'later' ? episode.title : undefined} onClick={() => (activeTab === 'later' ? onPlayLater(episode) : onPlay(episode))}><Artwork src={episode.albumPic} alt="" className="queue-art" /><span className="queue-copy"><strong>{episode.title}</strong><span>{episode.albumName || 'NIO Radio'} <span aria-hidden="true">·</span> {formatDuration(episode.duration)}</span></span>{active ? <span className="queue-playing" aria-label="正在播放"><Music2 size={18} /></span> : null}</button>
              {activeTab === 'queue' ? <div className="queue-actions"><button type="button" className="icon-button" aria-label={`管理 ${episode.title}`} aria-expanded={actionsFor === episode.id} aria-haspopup="menu" aria-controls={`queue-menu-${episode.id}`} onClick={() => setActionsFor(actionsFor === episode.id ? null : episode.id)}><MoreHorizontal size={20} /></button>{actionsFor === episode.id ? <div id={`queue-menu-${episode.id}`} className="row-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onPlayNext(episode); setActionsFor(null); }}><ListPlus size={16} />下一首播放</button><button type="button" role="menuitem" onClick={async () => { setActionsFor(null); const result = await onShareEpisode(episode); if (result === 'copied') { window.clearTimeout(noticeTimer.current); setNotice('已复制分享链接'); noticeTimer.current = window.setTimeout(() => setNotice(''), 2400); } }}><Share2 size={16} />分享</button><button type="button" role="menuitem" onClick={() => { onRemove(episode.id); setActionsFor(null); }}><Trash2 size={16} />移出列表</button></div> : null}</div> : null}
            </li>;
          })}</ul> : <div className="queue-empty"><Music2 size={28} /><p>{activeTab === 'queue' ? '播放列表是空的' : activeTab === 'history' ? '还没有听过的节目' : '稍后播放是空的'}</p><span>选择一个节目后，它会出现在这里</span></div>}
        </div>
      </section>
    </div>
  );
});
