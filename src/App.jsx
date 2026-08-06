import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';
import { loadCatalog, normalizeCatalog } from './catalog';
import { parseHash, withQueueHash, closeQueueHash } from './router';
import {
  PLAYER_STORAGE_KEY,
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
import { readFavoriteAlbums, toggleFavoriteAlbum, writeFavoriteAlbums } from './favoriteAlbums';
import { routeMotionFor, sameRoute, screenRouteKey } from './routeUtils';
import { DesktopNav } from './components/DesktopNav';
import { MiniPlayer } from './components/MiniPlayer';
import { QueueSheet } from './components/QueueSheet';
import { useDesktopLayout } from './hooks/useDesktopLayout';
import { AlbumScreen } from './screens/AlbumScreen';
import { AlbumsScreen } from './screens/AlbumsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import './App.css';

const CATALOG_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

function readStoredPlayer() {
  try { return restorePlayerState(window.localStorage.getItem(PLAYER_STORAGE_KEY)); } catch { return createPlayerState(); }
}

export default function App({ initialCatalog = null }) {
  const desktopLayout = useDesktopLayout();
  const [installPrompt, setInstallPrompt] = useState(null);
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
  const [favoriteAlbums, setFavoriteAlbums] = useState(readFavoriteAlbums);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [queueTab, setQueueTab] = useState('queue');
  const audioRef = useRef(null);
  const playerRef = useRef(player);
  const laterEpisodesRef = useRef(laterEpisodes);
  const queueButtonRef = useRef(null);
  const lastSavedAt = useRef(0);
  const lastPositionUpdateAt = useRef(0);
  const resumeSeekAppliedRef = useRef(false);
  const scrollPositions = useRef(new Map());
  const routeRef = useRef(route);
  const queueFocusRef = useRef(null);
  const lastCatalogRefreshAt = useRef(0);
  const catalogRefreshPromise = useRef(null);
  playerRef.current = player;
  laterEpisodesRef.current = laterEpisodes;
  const [playerVisible, setPlayerVisible] = useState(() => Boolean(player.currentEpisode));
  const [playerClosing, setPlayerClosing] = useState(false);
  const lastEpisodeRef = useRef(player.currentEpisode);

  useEffect(() => { if (player.currentEpisode) lastEpisodeRef.current = player.currentEpisode; }, [player.currentEpisode]);
  useEffect(() => {
    if (player.currentEpisode) { setPlayerVisible(true); setPlayerClosing(false); return; }
    if (!playerVisible) return;
    if (!desktopLayout) { setPlayerVisible(false); return; }
    setPlayerClosing(true);
  }, [desktopLayout, player.currentEpisode, playerVisible]);
  const handlePlayerExited = useCallback(() => { setPlayerVisible(false); setPlayerClosing(false); }, []);
  useEffect(() => {
    if (!playerClosing) return undefined;
    const timer = window.setTimeout(handlePlayerExited, 220);
    return () => window.clearTimeout(timer);
  }, [playerClosing, handlePlayerExited]);

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

  useEffect(() => {
    const handlePrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const pending = installPrompt;
    if (!pending) return;
    await pending.prompt();
    const choice = await pending.userChoice;
    if (choice?.outcome === 'accepted') setInstallPrompt(null);
  }, [installPrompt]);

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
    if (trigger.isConnected) trigger.focus?.({ preventScroll: true });
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

  const toggleAlbumFavorite = useCallback(albumId => {
    setFavoriteAlbums(previous => {
      const next = toggleFavoriteAlbum(previous, albumId);
      writeFavoriteAlbums(next.ids);
      return next.ids;
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
    resumeSeekAppliedRef.current = false;
    audio.src = episode.audioUrl;
    audio.load();
    if (canResume(positionSeconds, durationSeconds)) {
      try {
        audio.currentTime = positionSeconds;
        resumeSeekAppliedRef.current = true;
      } catch { /* metadata may not be ready; re-applied on loadedmetadata */ }
    } else {
      resumeSeekAppliedRef.current = true;
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
  const openQueueFrom = useCallback(trigger => {
    queueFocusRef.current = trigger;
    go(withQueueHash(window.location.hash || '#/', true));
  }, [go]);
  const openQueue = useCallback(() => openQueueFrom(queueButtonRef.current), [openQueueFrom]);
  const openLater = useCallback(event => {
    setQueueTab('later');
    if (queuePresent) return;
    openQueueFrom(event.currentTarget);
  }, [openQueueFrom, queuePresent]);
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
        return { ...next, isPlaying: false };
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
    const previous = playerRef.current;
    const completedEpisode = previous.currentEpisode;
    if (completedEpisode) removeFromLater(completedEpisode.id);
    let next = previous;
    let cursor = previous.queueIndex + 1;
    while (cursor < previous.queue.length) {
      const candidate = previous.queue[cursor];
      if (candidate?.audioUrl) {
        next = {
          ...previous,
          queueIndex: cursor,
          currentEpisode: candidate,
          positionSeconds: 0,
          durationSeconds: 0,
          error: null,
        };
        break;
      }
      cursor += 1;
    }
    if (next === previous) next = { ...previous, isPlaying: false };
    const hasNext = Boolean(next.currentEpisode && next.currentEpisode.id !== previous.currentEpisode?.id);
    setPlayer({
      ...next,
      history: hasNext ? recordHistory(previous.history, next.currentEpisode) : previous.history,
      isPlaying: hasNext,
    });
    setIsPlaying(hasNext);
  }, [removeFromLater]);

  const resumePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playerRef.current.currentEpisode) return;
    const result = audio.play();
    result?.catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试'));
    setIsPlaying(true);
    setPlayer(previous => ({ ...previous, isPlaying: true }));
  }, [setPlaybackFailure]);

  const openSearch = useCallback(() => go('#/search'), [go]);
  const openFavorites = useCallback(() => go('#/favorites'), [go]);
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
      {desktopLayout ? (
        <DesktopNav
          route={route}
          laterActive={queuePresent && queueTab === 'later'}
          onHome={() => go('#/')}
          onSearch={openSearch}
          onLater={openLater}
          onFavorites={openFavorites}
          showInstall={Boolean(installPrompt)}
          onInstall={promptInstall}
        />
      ) : null}
      <div className="app-content" inert={queuePresent ? true : undefined}>
        {!hasCatalog ? <div className="full-state">
          {catalogState.loading ? <><div className="loading-dot" /><p>正在准备 NIO Radio…</p></> : <><CircleAlert size={28} /><h1>目录暂时无法加载</h1><p>请检查网络后重试，已缓存的节目仍可继续播放。</p><button type="button" className="primary-button" onClick={retryCatalog}><RotateCcw size={17} />重新加载</button></>}
        </div> : <div key={routeViewKey} className="route-view" data-route-motion={routeMotion}>
          {route.screen === 'home' ? <HomeScreen catalog={catalogState.catalog} player={player} stale={catalogState.stale} refreshing={catalogState.loading} catalogError={catalogState.error} onRetry={retryCatalog} onPlay={startPlayback} onPlayAll={playAll} onResume={resumePlayback} onSearch={openSearch} onOpenAlbums={openAlbums} /> : null}
          {route.screen === 'albums' ? <AlbumsScreen catalog={catalogState.catalog} onBack={goBack} onSearch={openSearch} onOpenAlbum={openAlbum} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} starAction={desktopLayout} /> : null}
          {route.screen === 'search' ? <SearchScreen catalog={catalogState.catalog} searchQuery={route.searchQuery} onBack={goBack} onQueryChange={updateSearchQuery} onOpenAlbum={openAlbum} pinnedFirst={desktopLayout} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} starAction={desktopLayout} /> : null}
          {route.screen === 'favorites' ? <FavoritesScreen catalog={catalogState.catalog} favoriteIds={favoriteAlbums} onToggleFavorite={toggleAlbumFavorite} onOpenAlbum={openAlbum} onBack={goBack} onBrowse={openSearch} starAction={desktopLayout} /> : null}
          {route.screen === 'album' && currentAlbum ? <AlbumScreen album={currentAlbum} onBack={goBack} onPlay={startPlayback} onAddLater={addToLater} /> : null}
          {route.screen === 'album' && !currentAlbum ? <div className="full-state"><h1>专辑不存在</h1><button type="button" className="secondary-button" onClick={() => go('#/')}>返回首页</button></div> : null}
        </div>}
      </div>
      <audio ref={audioRef} preload="metadata" onLoadedMetadata={event => { const duration = event.currentTarget?.duration || 0; const { positionSeconds } = playerRef.current; if (!resumeSeekAppliedRef.current && canResume(positionSeconds, duration)) { try { event.currentTarget.currentTime = positionSeconds; } catch { /* media may not be ready */ } resumeSeekAppliedRef.current = true; } setPlayer(previous => ({ ...previous, durationSeconds: duration || previous.durationSeconds })); }} onTimeUpdate={event => { const position = event.currentTarget?.currentTime || 0; const now = Date.now(); if (now - lastPositionUpdateAt.current < 1000) return; lastPositionUpdateAt.current = now; setPlayer(previous => ({ ...previous, positionSeconds: position })); }} onPlay={() => { setIsPlaying(true); setAudioError(null); setPlayer(previous => ({ ...previous, isPlaying: true })); }} onPause={event => { if (event.currentTarget?.ended) return; setIsPlaying(false); setPlayer(previous => ({ ...previous, isPlaying: false })); }} onError={() => setPlaybackFailure('音频加载失败，请检查网络后重试')} onEnded={handleEnded} />
      {playerVisible ? <MiniPlayer player={player.currentEpisode ? player : { ...player, currentEpisode: lastEpisodeRef.current }} isPlaying={isPlaying} audioError={audioError} onToggle={togglePlayback} onRetry={() => { setAudioError(null); audioRef.current?.load(); audioRef.current?.play().catch(() => setPlaybackFailure('音频暂时无法播放，请稍后重试')); }} onOpenQueue={openQueue} queueButtonRef={queueButtonRef} onSeek={updatePosition} isClosing={playerClosing} onExited={handlePlayerExited} /> : null}
      {queuePresent ? <QueueSheet queue={player.queue} history={player.history} currentEpisode={player.currentEpisode} currentEpisodeId={player.currentEpisode?.id} laterEpisodes={laterEpisodes} activeTab={queueTab} setActiveTab={setQueueTab} isClosing={queueClosing} onExited={handleQueueExited} onClose={closeQueue} onPlay={playQueueEpisode} onPlayLater={playLaterEpisode} onPlayNext={playNextEpisode} onRemove={removeQueueEpisode} catalog={catalogState.catalog} onAddLater={addToLater} onRemoveLater={removeFromLater} onMoveLater={moveFromLater} /> : null}
    </main>
  );
}
