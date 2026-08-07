import { Check, ListMusic, Pause, Play, Share2 } from 'lucide-react';
import { Artwork } from './Artwork';
import { formatClock } from '../format';
import { formatRate } from '../playbackPrefs';

export function MiniPlayer({ player, isPlaying, audioError, onToggle, onRetry, onOpenQueue, queueButtonRef, onSeek, playbackRate = 1, onCycleRate, onShare, shareFeedback, isClosing = false, onExited }) {
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;
  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        <button type="button" className="player-control mini-toggle" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
        <div className="mini-progress-row"><span>{formatClock(player.positionSeconds)}</span><input aria-label="播放进度" type="range" min="0" max={duration || 0} step="1" value={Math.min(player.positionSeconds, duration || 0)} onChange={onSeek} /><span>{formatClock(duration)}</span><button type="button" className={`speed-pill${playbackRate !== 1 ? ' is-active' : ''}`} aria-label={`播放速度 ${formatRate(playbackRate)}`} onClick={onCycleRate}>{formatRate(playbackRate)}</button></div>
        <button type="button" className="player-control share-control" aria-label="分享当前节目" onClick={onShare}>{shareFeedback === 'copied' ? <Check size={19} /> : <Share2 size={19} />}</button>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}

