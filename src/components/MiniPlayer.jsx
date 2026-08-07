import { useEffect, useRef, useState } from 'react';
import { ListMusic, Pause, Play } from 'lucide-react';
import { Artwork } from './Artwork';
import { formatClock } from '../format';
import { formatRate, SPEED_OPTIONS } from '../playbackPrefs';

export function MiniPlayer({ player, isPlaying, audioError, onToggle, onRetry, onOpenQueue, queueButtonRef, onSeek, playbackRate = 1, onSelectRate, isClosing = false, onExited }) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const duration = player.durationSeconds || (Number(player.currentEpisode?.duration) || 0) / 1000;

  useEffect(() => {
    if (!speedOpen) return undefined;
    const handlePointerDown = event => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setSpeedOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setSpeedOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [speedOpen]);

  return (
    <section className={`mini-player${isClosing ? ' is-closing' : ''}`} aria-label="当前播放" onAnimationEnd={event => { if (isClosing && event.animationName === 'mini-player-out') onExited?.(); }}>
      <div className="mini-main">
        <Artwork src={player.currentEpisode.albumPic} alt="" className="mini-art" />
        <div className="mini-copy"><strong>{player.currentEpisode.title}</strong><span>{player.currentEpisode.albumName || 'NIO Radio'}</span></div>
        <button type="button" className="player-control mini-toggle" aria-label={isPlaying ? '暂停' : '播放'} onClick={onToggle}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
        <div className="mini-progress-row"><span>{formatClock(player.positionSeconds)}</span><input aria-label="播放进度" type="range" min="0" max={duration || 0} step="1" value={Math.min(player.positionSeconds, duration || 0)} onChange={onSeek} /><span>{formatClock(duration)}</span><span className="speed-trigger"><button ref={triggerRef} type="button" className={`player-control speed-pill${playbackRate !== 1 ? ' is-active' : ''}`} aria-label={`播放速度 ${formatRate(playbackRate)}`} aria-haspopup="menu" aria-expanded={speedOpen} onClick={() => setSpeedOpen(open => !open)}>{formatRate(playbackRate)}</button>{speedOpen ? <div ref={menuRef} className="speed-menu" role="menu">{SPEED_OPTIONS.map(rate => <button key={rate} type="button" role="menuitem" aria-pressed={playbackRate === rate} onClick={() => { onSelectRate(rate); setSpeedOpen(false); }}>{formatRate(rate)}</button>)}</div> : null}</span></div>
        <button ref={queueButtonRef} type="button" className="player-control queue-control" aria-label="打开播放列表" onClick={onOpenQueue}><ListMusic size={21} /></button>
      </div>
      {audioError ? <div className="player-error" role="alert"><span>{audioError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
    </section>
  );
}
