import { useCallback, useRef, useState } from 'react';
import { ListMusic, SkipBack, SkipForward } from 'lucide-react';
import { Pause as PauseIcon, Play as PlayIcon } from 'lucide';
import { MorphIcon } from 'morphicons/react';
import { FavoriteIcon } from './FavoriteIcon';
import { Artwork } from './Artwork';
import { formatClock } from '../format';
import { bubbleSecondsFromPointer } from '../playerProgress';

export function MiniPlayer({ player, isPlaying, audioError, favoriteIds = [], onToggleFavorite, onToggle, onAdjacent, onRetry, onOpenQueue, queueButtonRef, onSeek, isClosing = false, onExited }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  // 与 App.playAdjacent 相同的跳过规则：无音频 URL 的节目不可跳转
  const hasPlayableNeighbor = direction => {
    const queue = player.queue || [];
    for (let index = (player.queueIndex ?? 0) + direction; index >= 0 && index < queue.length; index += direction) {
      if (queue[index]?.audioUrl) return true;
    }
    return false;
  };
  const currentAlbumId = Number(player.currentEpisode?.albumId);
  const favorited = favoriteIds.includes(currentAlbumId);
  const progressRef = useRef(null);
  const [bubbleSeconds, setBubbleSeconds] = useState(null);

  const positionSeconds = Math.min(player.positionSeconds, duration || 0);
  const progressPercent = duration > 0 ? (positionSeconds / duration) * 100 : 0;

  const updateBubbleFromPointer = useCallback(event => {
    const track = progressRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    setBubbleSeconds(bubbleSecondsFromPointer(event.clientX, rect.left, rect.width, duration));
  }, [duration]);

  const hideBubble = useCallback(() => setBubbleSeconds(null), []);

  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} darkSrc={player.currentEpisode.albumPicDark} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        {currentAlbumId > 0 && onToggleFavorite ? (
          <button type="button" className={`player-control mini-favorite${favorited ? ' is-favorite' : ''}`} aria-label={favorited ? `取消收藏 ${player.currentEpisode.albumName || ''}` : `收藏 ${player.currentEpisode.albumName || ''}`} aria-pressed={favorited} onClick={() => onToggleFavorite(currentAlbumId)}>
            <FavoriteIcon favorited={favorited} size={19} />
          </button>
        ) : null}
        <div className="mini-transport">
          <button type="button" className="player-control mini-skip" aria-label="上一首" disabled={!hasPlayableNeighbor(-1)} onClick={() => onAdjacent?.(-1)}><SkipBack size={20} /></button>
          <button type="button" className="player-control mini-toggle" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}><MorphIcon icon={isPlaying ? PauseIcon : PlayIcon} reducedMotion="user" size={20} fill="currentColor" aria-hidden="true" /></button>
          <button type="button" className="player-control mini-skip" aria-label="下一首" disabled={!hasPlayableNeighbor(1)} onClick={() => onAdjacent?.(1)}><SkipForward size={20} /></button>
        </div>
        <div
          ref={progressRef}
          className="mini-progress-row"
          onPointerMove={updateBubbleFromPointer}
          onPointerLeave={hideBubble}
        >
          <span>{formatClock(positionSeconds)}</span>
          <input
            aria-label="播放进度"
            type="range"
            min="0"
            max={duration || 0}
            step="1"
            value={positionSeconds}
            onChange={event => { onSeek(event); setBubbleSeconds(Number(event.target.value)); }}
            style={{ '--progress': `${progressPercent}%` }}
          />
          <span>{formatClock(duration)}</span>
          {bubbleSeconds != null ? (
            <span className="mini-progress-bubble" aria-hidden="true">{formatClock(bubbleSeconds)} / {formatClock(duration)}</span>
          ) : null}
        </div>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}
