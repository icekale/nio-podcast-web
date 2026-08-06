export const PLAYER_STATE_VERSION = 2;
export const PLAYER_STORAGE_KEY = 'nio_player_state_v2';

function normalizeEpisode(episode) {
  if (!episode || episode.id == null) return null;
  return { ...episode };
}

const SERIALIZED_EPISODE_FIELDS = [
  'id',
  'title',
  'albumId',
  'albumName',
  'albumPic',
  'host',
  'duration',
  'onlineTime',
  'audioUrl',
];

function serializeEpisode(episode) {
  const normalized = normalizeEpisode(episode);
  if (!normalized) return null;
  const serialized = {};
  for (const field of SERIALIZED_EPISODE_FIELDS) {
    if (normalized[field] !== undefined) serialized[field] = normalized[field];
  }
  return serialized;
}

function episodeKey(episode) {
  return String(episode?.id);
}

function uniqueEpisodes(episodes) {
  const seen = new Set();
  return episodes.map(normalizeEpisode).filter(episode => {
    const key = episodeKey(episode);
    if (!episode || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createPlayerState() {
  return {
    version: PLAYER_STATE_VERSION,
    currentEpisode: null,
    queue: [],
    queueIndex: 0,
    positionSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    history: [],
    updatedAt: 0,
    error: null,
  };
}

export function enqueueEpisodes(state, episodes) {
  const queue = uniqueEpisodes(episodes);
  return {
    ...state,
    queue,
    queueIndex: 0,
    currentEpisode: queue[0] || null,
    positionSeconds: 0,
    durationSeconds: 0,
    error: null,
  };
}

export function selectEpisode(state, episode, queue = state.queue) {
  const selected = normalizeEpisode(episode);
  if (!selected) return state;
  const nextQueue = uniqueEpisodes([...queue, selected]);
  const index = nextQueue.findIndex(item => episodeKey(item) === episodeKey(selected));
  return {
    ...state,
    queue: nextQueue,
    queueIndex: index >= 0 ? index : 0,
    currentEpisode: selected,
    positionSeconds: 0,
    durationSeconds: 0,
    error: null,
  };
}

export function insertNext(state, episode) {
  const next = normalizeEpisode(episode);
  if (!next) return state;
  if (episodeKey(state.currentEpisode) === episodeKey(next)) return state;
  const currentId = episodeKey(state.currentEpisode);
  const queue = state.queue.filter(item => episodeKey(item) !== episodeKey(next));
  const currentIndex = queue.findIndex(item => episodeKey(item) === currentId);
  const insertAt = Math.min(Math.max(currentIndex, -1) + 1, queue.length);
  queue.splice(insertAt, 0, next);
  const queueIndex = queue.findIndex(item => episodeKey(item) === currentId);
  return { ...state, queue, queueIndex: queueIndex >= 0 ? queueIndex : 0 };
}

export function removeFromQueue(state, episodeId) {
  const id = String(episodeId);
  const index = state.queue.findIndex(item => episodeKey(item) === id);
  if (index < 0) return state;
  const queue = state.queue.filter(item => episodeKey(item) !== id);
  if (!queue.length) return {
    ...state,
    queue,
    queueIndex: 0,
    currentEpisode: null,
    positionSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    error: null,
  };
  if (index === state.queueIndex) {
    const queueIndex = Math.min(index, queue.length - 1);
    return { ...state, queue, queueIndex, currentEpisode: queue[queueIndex], positionSeconds: 0, durationSeconds: 0 };
  }
  return { ...state, queue, queueIndex: index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex };
}

export function advanceQueue(state) {
  if (state.queueIndex >= state.queue.length - 1) return { ...state, isPlaying: false };
  const queueIndex = state.queueIndex + 1;
  return { ...state, queueIndex, currentEpisode: state.queue[queueIndex], positionSeconds: 0, durationSeconds: 0, error: null };
}

export function recordHistory(history, episode) {
  const item = normalizeEpisode(episode);
  if (!item) return history;
  return [item, ...history.filter(previous => episodeKey(previous) !== episodeKey(item))].slice(0, 100);
}

export function canResume(positionSeconds, durationSeconds) {
  return Number.isFinite(positionSeconds)
    && Number.isFinite(durationSeconds)
    && positionSeconds > 10
    && durationSeconds - positionSeconds >= 30;
}

export function serializePlayerState(state) {
  return JSON.stringify({
    version: PLAYER_STATE_VERSION,
    currentEpisode: serializeEpisode(state.currentEpisode),
    queue: uniqueEpisodes(state.queue).map(serializeEpisode),
    queueIndex: Number.isInteger(state.queueIndex) ? state.queueIndex : 0,
    positionSeconds: Number(state.positionSeconds) || 0,
    durationSeconds: Number(state.durationSeconds) || 0,
    history: uniqueEpisodes(state.history).slice(0, 100).map(serializeEpisode),
    updatedAt: Date.now(),
  });
}

export function restorePlayerState(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.version !== PLAYER_STATE_VERSION || !Array.isArray(parsed.queue) || !Array.isArray(parsed.history)) {
      return createPlayerState();
    }
    const queue = uniqueEpisodes(parsed.queue);
    const queueIndex = Math.min(Math.max(Number(parsed.queueIndex) || 0, 0), Math.max(queue.length - 1, 0));
    const persistedCurrent = normalizeEpisode(parsed.currentEpisode);
    const currentInQueue = Boolean(persistedCurrent) && queue.some(item => episodeKey(item) === episodeKey(persistedCurrent));
    const currentEpisode = currentInQueue ? persistedCurrent : queue[queueIndex] || null;
    return {
      ...createPlayerState(),
      currentEpisode,
      queue,
      queueIndex,
      positionSeconds: Math.max(0, Number(parsed.positionSeconds) || 0),
      durationSeconds: Math.max(0, Number(parsed.durationSeconds) || 0),
      history: uniqueEpisodes(parsed.history).slice(0, 100),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return createPlayerState();
  }
}
