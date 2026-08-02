export const LATER_PLAYBACK_STORAGE_KEY = 'nio_play_later_v1';

function normalizeEpisode(episode) {
  if (!episode || episode.id == null) return null;
  return { ...episode };
}

function uniqueEpisodes(episodes) {
  const seen = new Set();
  return (Array.isArray(episodes) ? episodes : []).map(normalizeEpisode).filter(episode => {
    const key = String(episode?.id);
    if (!episode || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function addLaterEpisode(items, episode) {
  const normalized = normalizeEpisode(episode);
  if (!normalized || items.some(item => String(item.id) === String(normalized.id))) {
    return { added: false, items };
  }
  return { added: true, items: [...items, normalized] };
}

export function removeLaterEpisode(items, episodeId) {
  return items.filter(item => String(item.id) !== String(episodeId));
}

export function moveLaterEpisode(items, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function readLaterEpisodes(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(LATER_PLAYBACK_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? uniqueEpisodes(parsed) : [];
  } catch {
    return [];
  }
}

export function writeLaterEpisodes(items, storage = globalThis.localStorage) {
  try {
    storage?.setItem(LATER_PLAYBACK_STORAGE_KEY, JSON.stringify(uniqueEpisodes(items)));
    return true;
  } catch {
    return false;
  }
}
