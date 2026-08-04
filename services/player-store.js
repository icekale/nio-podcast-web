const {
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
} = require('../utils/playerState');
const {
  addLaterEpisode,
  moveLaterEpisode,
  readLaterEpisodes,
  removeLaterEpisode,
  writeLaterEpisodes,
} = require('../utils/laterPlayback');
const { createStorage } = require('../utils/storage');

const SAVE_THROTTLE_MS = 5000;

let storage = createStorage();
let bgm = null;
let state = { player: createPlayerState(), later: [] };
const listeners = new Set();
let lastSavedAt = 0;

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch {} });
}

function persist(force = false) {
  const now = Date.now();
  if (!force && now - lastSavedAt < SAVE_THROTTLE_MS) return;
  lastSavedAt = now;
  storage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(state.player));
}

function setPlayer(next, { forceSave = false } = {}) {
  state = { ...state, player: next };
  notify();
  persist(forceSave);
}

function setLater(items) {
  state = { ...state, later: items };
  writeLaterEpisodes(items, storage);
  notify();
}

function loadEpisode(episode, shouldPlay) {
  if (!episode || !episode.audioUrl) return;
  bgm.src = episode.audioUrl;
  bgm.title = episode.title;
  bgm.epname = episode.albumName || 'NIO Radio';
  bgm.singer = episode.host || 'NIO Radio';
  bgm.coverImgUrl = episode.albumPic || '';
  const { positionSeconds, durationSeconds } = state.player;
  if (canResume(positionSeconds, durationSeconds)) {
    try { bgm.startTime = positionSeconds; } catch {}
  }
  if (shouldPlay) bgm.play();
}

function initPlayerStore(options = {}) {
  if (bgm) return state;
  storage = options.storage || createStorage();
  bgm = options.bgm || wx.getBackgroundAudioManager();
  state = {
    player: restorePlayerState(storage.getItem(PLAYER_STORAGE_KEY)),
    later: readLaterEpisodes(storage),
  };

  bgm.onTimeUpdate(() => {
    const position = typeof bgm.currentTime === 'number' ? bgm.currentTime : state.player.positionSeconds;
    setPlayer({ ...state.player, positionSeconds: position });
  });

  bgm.onEnded(() => {
    const previous = state.player;
    const completed = previous.currentEpisode;
    let later = state.later;
    if (completed) later = removeLaterEpisode(later, completed.id);
    const next = advanceQueue(previous);
    const hasNext = Boolean(next.currentEpisode && previous.currentEpisode && next.currentEpisode.id !== previous.currentEpisode.id);
    const player = {
      ...next,
      history: hasNext ? recordHistory(previous.history, next.currentEpisode) : previous.history,
      isPlaying: hasNext,
    };
    state = { ...state, player, later };
    writeLaterEpisodes(later, storage);
    notify();
    persist(true);
    if (hasNext) loadEpisode(next.currentEpisode, true);
  });

  bgm.onError(() => {
    setPlayer({ ...state.player, isPlaying: false, error: '音频加载失败，请检查网络后重试' }, { forceSave: true });
  });
  bgm.onPlay(() => setPlayer({ ...state.player, isPlaying: true }));
  bgm.onPause(() => setPlayer({ ...state.player, isPlaying: false }));

  const current = state.player.currentEpisode;
  if (current) loadEpisode(current, false);
  notify();
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function getState() {
  return state;
}

function playEpisode(episode, visibleQueue) {
  if (!episode) return;
  const previous = state.player;
  let next = previous;
  if (visibleQueue && visibleQueue.length) next = enqueueEpisodes(next, visibleQueue);
  next = selectEpisode(next, episode, next.queue);
  next = { ...next, history: recordHistory(previous.history, episode), error: null };
  if (!episode.audioUrl) {
    setPlayer({ ...next, isPlaying: false, error: '该节目没有可播放音频，请稍后重试' }, { forceSave: true });
    return;
  }
  setPlayer({ ...next, isPlaying: true }, { forceSave: true });
  loadEpisode(episode, true);
}

function playAll(episodes) {
  if (!episodes.length) return;
  playEpisode(episodes[0], episodes);
}

function togglePlayback() {
  if (!state.player.currentEpisode) return;
  if (state.player.isPlaying) {
    bgm.pause();
    setPlayer({ ...state.player, isPlaying: false }, { forceSave: true });
  } else {
    setPlayer({ ...state.player, isPlaying: true, error: null });
    bgm.play();
  }
}

function seek(position) {
  const value = Number(position);
  if (!Number.isFinite(value)) return;
  try { bgm.seek(value); } catch {}
  setPlayer({ ...state.player, positionSeconds: value });
}

function addLater(episode) {
  const result = addLaterEpisode(state.later, episode);
  if (!result.added) return { added: false, persisted: true };
  setLater(result.items);
  return { added: true, persisted: writeLaterEpisodes(result.items, storage) };
}

function removeLater(id) {
  setLater(removeLaterEpisode(state.later, id));
}

function moveLater(fromIndex, toIndex) {
  setLater(moveLaterEpisode(state.later, fromIndex, toIndex));
}

function playLater(episode) {
  playEpisode(episode, state.later);
}

function playNext(episode) {
  setPlayer(insertNext(state.player, episode));
}

function removeQueue(id) {
  setPlayer(removeFromQueue(state.player, id), { forceSave: true });
  if (!state.player.currentEpisode) bgm.stop();
}

module.exports = {
  initPlayerStore,
  subscribe,
  getState,
  playEpisode,
  playAll,
  togglePlayback,
  seek,
  addLater,
  removeLater,
  moveLater,
  playLater,
  playNext,
  removeQueue,
};
