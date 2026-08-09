import { Heart, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Artwork } from './Artwork';
import { formatClock } from '../format';

export function bubbleSecondsFromPointer(clientX, trackLeft, trackWidth, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const ratio = (clientX - trackLeft) / trackWidth;
  return Math.min(Math.max(Math.round(ratio * durationSeconds), 0), durationSeconds);
}

export function MiniPlayer({ player, isPlaying, audioError, favoriteIds = [], onToggleFavorite, onToggle, onAdjacent, onRetry, onOpenQueue, queueButtonRef, onSeek, isClosing = false, onExited }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  const queueSize = player.queue?.length || 0;
  const favorited = favoriteIds.includes(Number(player.currentEpisode?.albumId));
  const currentAlbumId = player.currentEpisode?.albumId;
  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        {currentAlbumId != null && onToggleFavorite ? (
          <button type="button" className={`player-control mini-favorite${favorited ? ' is-favorite' : ''}`} aria-label={favorited ? `取消收藏 ${player.currentEpisode.albumName || ''}` : `收藏 ${player.currentEpisode.albumName || ''}`} aria-pressed={favorited} onClick={() => onToggleFavorite(currentAlbumId)}>
            <Heart size={19} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        ) : null}
        <div className="mini-transport">
          <button type="button" className="player-control mini-skip" aria-label="上一首" disabled={queueSize < 2} onClick={() => onAdjacent?.(-1)}><SkipBack size={20} /></button>
          <button type="button" className="player-control mini-toggle" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
          <button type="button" className="player-control mini-skip" aria-label="下一首" disabled={queueSize < 2} onClick={() => onAdjacent?.(1)}><SkipForward size={20} /></button>
        </div>
        <div className="mini-progress-row"><span>{formatClock(player.positionSeconds)}</span><input aria-label="播放进度" type="range" min="0" max={duration || 0} step="1" value={Math.min(player.positionSeconds, duration || 0)} onChange={onSeek} /><span>{formatClock(duration)}</span></div>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}
