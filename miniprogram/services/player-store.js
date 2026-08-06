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
const POSITION_NOTIFY_MS = 1000;

let storage = createStorage();
let bgm = null;
let state = { player: createPlayerState(), later: [] };
const listeners = new Set();
let lastSavedAt = 0;
let lastPositionUpdateAt = 0;
let interruptedWhilePlaying = false;

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
  const persisted = writeLaterEpisodes(items, storage);
  notify();
  return persisted;
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
    const now = Date.now();
    if (now - lastPositionUpdateAt < POSITION_NOTIFY_MS) return;
    lastPositionUpdateAt = now;
    setPlayer({ ...state.player, positionSeconds: position });
  });

  // 捕获真实时长（秒），与 positionSeconds 单位一致；恢复播放依赖它。
  bgm.onCanplay(() => {
    const duration = typeof bgm.duration === 'number' && bgm.duration > 0 ? bgm.duration : 0;
    if (duration && duration !== state.player.durationSeconds) {
      setPlayer({ ...state.player, durationSeconds: duration });
    }
  });

  bgm.onEnded(() => {
    const previous = state.player;
    const completed = previous.currentEpisode;
    let later = state.later;
    if (completed) later = removeLaterEpisode(later, completed.id);
    let next = advanceQueue(previous);
    // 跳过没有可播放音频的节目，避免 UI 切换但音频仍在放上一集。
    while (next.currentEpisode && !next.currentEpisode.audioUrl && next.queueIndex < next.queue.length - 1) {
      next = advanceQueue(next);
    }
    const advanced = Boolean(next.currentEpisode && completed && next.currentEpisode.id !== completed.id);
    const canPlay = Boolean(next.currentEpisode && next.currentEpisode.audioUrl);
    const player = {
      ...next,
      history: advanced && canPlay ? recordHistory(previous.history, next.currentEpisode) : previous.history,
      isPlaying: advanced && canPlay,
      error: advanced && !canPlay ? '没有可继续播放的节目' : next.error,
    };
    state = { ...state, player, later };
    writeLaterEpisodes(later, storage);
    notify();
    persist(true);
    if (advanced && canPlay) loadEpisode(next.currentEpisode, true);
  });

  bgm.onError(() => {
    setPlayer({ ...state.player, isPlaying: false, error: '音频加载失败，请检查网络后重试' }, { forceSave: true });
  });
  bgm.onPlay(() => setPlayer({ ...state.player, isPlaying: true }));
  bgm.onPause(() => setPlayer({ ...state.player, isPlaying: false }));
  // 通知栏/锁屏里停止播放时同步 UI 状态。
  bgm.onStop(() => setPlayer({ ...state.player, isPlaying: false }));

  // 来电等音频中断后自动续播（仅前台播放时）。
  if (typeof wx !== 'undefined' && wx.onAudioInterruptionBegin) {
    wx.onAudioInterruptionBegin(() => { interruptedWhilePlaying = state.player.isPlaying; });
  }
  if (typeof wx !== 'undefined' && wx.onAudioInterruptionEnd) {
    wx.onAudioInterruptionEnd(() => {
      if (interruptedWhilePlaying && state.player.currentEpisode) {
        interruptedWhilePlaying = false;
        bgm.play();
      }
    });
  }

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
  return { added: true, persisted: setLater(result.items) };
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
  const previous = state.player;
  const removedCurrent = Boolean(previous.currentEpisode && String(previous.currentEpisode.id) === String(id));
  const next = removeFromQueue(previous, id);
  setPlayer(next, { forceSave: true });
  if (removedCurrent && next.currentEpisode) {
    // 移除的是当前播放项：重载下一集音频，避免 UI 与音频错位。
    loadEpisode(next.currentEpisode, previous.isPlaying);
  } else if (!next.currentEpisode) {
    bgm.stop();
  }
}

function retryAudio() {
  const current = state.player.currentEpisode;
  if (!current) return;
  setPlayer({ ...state.player, error: null, isPlaying: true }, { forceSave: true });
  loadEpisode(current, true);
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
  retryAudio,
};
