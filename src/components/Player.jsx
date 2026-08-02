import { useState, useEffect, useRef, memo } from 'react';
import { formatClock } from '../utils';

const Player = memo(function Player({ episode, onClose }) {
  const aRef = useRef(null);
  const scrubbingRef = useRef(false);
  const [play, setPlay] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = aRef.current;
    if (!a || !episode) return;
    setPos(0); setDur(0); setPlay(false);
    a.src = episode.audioUrl;
    a.load();
    a.play().catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title, artist: episode.host || episode.albumName,
        album: episode.albumName,
        artwork: episode.albumPic ? [{ src: episode.albumPic, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
  }, [episode]);

  const toggle = () => { const a = aRef.current; if (!a) return; a.paused ? a.play().catch(()=>{}) : a.pause(); };

  const seek = e => {
    const a = aRef.current; if (!a || !dur) return;
    scrubbingRef.current = true;
    a.currentTime = Math.min(Number(e.target.value), dur);
    setPos(a.currentTime);
  };

  if (!episode) return null;

  return (
    <div className="player">
      <audio ref={aRef} preload="metadata"
        onTimeUpdate={() => { if (!scrubbingRef.current) setPos(aRef.current?.currentTime||0); }}
        onLoadedMetadata={() => setDur(aRef.current?.duration||0)}
        onPlay={() => setPlay(true)} onPause={() => setPlay(false)} onEnded={() => setPlay(false)} />
      <div className="player-row">
        {episode.albumPic && <img src={episode.albumPic} alt="" className="player-cover" />}
        <button type="button" className="player-info" onClick={onClose} aria-label="收起播放器">
          <span className="player-name">{episode.title}</span>
          <span className="player-album">{episode.albumName}</span>
        </button>
        <button type="button" className="player-play" onClick={toggle} aria-label={play ? '暂停' : '播放'} aria-pressed={play}>
          {play ? '⏸' : '▶'}
        </button>
      </div>
      <div className="player-bar-row">
        <span className="player-time">{formatClock(pos)}</span>
        <input type="range" min="0" max={dur||0} step="1" value={pos}
          onChange={seek}
          onPointerUp={()=>scrubbingRef.current=false}
          onKeyUp={()=>scrubbingRef.current=false}
          onBlur={()=>scrubbingRef.current=false}
          className="player-range" aria-label="播放进度" />
        <span className="player-time">{formatClock(dur)}</span>
      </div>
    </div>
  );
});

export default Player;
