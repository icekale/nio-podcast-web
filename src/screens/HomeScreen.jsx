import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { List, Search } from 'lucide-react';
import { Pause, Play } from 'lucide';
import { MorphIcon } from 'morphicons/react';
import { selectHomeEpisodes } from '../catalog';
import { Artwork } from '../components/Artwork';
import { EpisodeRow } from '../components/EpisodeRow';
import { formatDuration } from '../format';

export const HomeScreen = memo(function HomeScreen({ catalog, daytimeEpisodes = null, player, stale, refreshing = false, catalogError = null, onRetry, onPlay, onPlayAll, onResume, onTogglePlayback, onSearch, onOpenAlbums }) {
  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const selection = useMemo(() => {
    const fallback = selectHomeEpisodes(catalog.albums, now);
    return daytimeEpisodes?.length ? { ...fallback, heading: '日间', episodes: daytimeEpisodes } : fallback;
  }, [catalog.albums, daytimeEpisodes, now]);
  const recommendation = selection.episodes[0];
  const playingRecommendation = Boolean(recommendation && player.currentEpisode?.id === recommendation.id);

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
      return Math.min((player.positionSeconds / player.durationSeconds) * 100, 100);
    }
    return 0;
  };

  return (
    <div className="screen home-screen">
      <header className={`top-bar${scrolled ? ' top-bar-scrolled' : ''}`}>
        <button type="button" className="icon-button" aria-label="全部专辑" onClick={onOpenAlbums}><List size={24} /></button>
        <span className="top-title">{scrolled ? '今日推荐' : 'NIO Radio'}</span>
        <div className="top-actions">
          {scrolled && player.currentEpisode ? <button type="button" className="continue-button" onClick={onResume}>▶ 继续播放</button> : null}
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
        <Artwork src={recommendation?.albumPic} darkSrc={recommendation?.albumPicDark} alt="" className="recommendation-art" />
        <button type="button" className="primary-button" disabled={!selection.episodes.length} onClick={() => (playingRecommendation ? onTogglePlayback() : onPlayAll(selection.episodes))}>
          {playingRecommendation
            ? player.isPlaying
              ? <><MorphIcon icon={Pause} reducedMotion="user" size={18} fill="currentColor" aria-hidden="true" /> 暂停</>
              : <><MorphIcon icon={Play} reducedMotion="user" size={18} fill="currentColor" aria-hidden="true" /> 继续播放</>
            : <><MorphIcon icon={Play} reducedMotion="user" size={18} fill="currentColor" aria-hidden="true" /> 全部播放</>}
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
});
