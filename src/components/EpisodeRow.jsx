import { memo, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Clock3, ListPlus, MoreHorizontal } from 'lucide-react';
import { Artwork } from './Artwork';
import { formatDate, formatDuration } from '../format';

export const EpisodeRow = memo(function EpisodeRow({ episode, onPlay, active = false, progress = 0, action, mainLabel }) {
  return (
    <li className={`episode-row${active ? ' is-active' : ''}`} data-episode-id={episode.id}>
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

export function LaterEpisodeAction({ episode, onAdd }) {
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
    setNotice(result.reason === 'limit'
      ? '稍后播放最多保存 50 条'
      : !result.added
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

