export const FAVORITE_ALBUMS_STORAGE_KEY = 'nio_favorite_albums_v1';

export function readFavoriteAlbums(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(FAVORITE_ALBUMS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const ids = parsed
      .filter(item => item != null && item !== '' && Number.isFinite(Number(item)))
      .map(Number);
    return ids.filter((id, index) => ids.indexOf(id) === index);
  } catch {
    return [];
  }
}

export function toggleFavoriteAlbum(ids, albumId) {
  const id = Number(albumId);
  if (!Number.isFinite(id)) return { ids, favorited: false };
  if (ids.includes(id)) return { ids: ids.filter(item => item !== id), favorited: false };
  return { ids: [id, ...ids], favorited: true };
}

export function writeFavoriteAlbums(ids, storage = globalThis.localStorage) {
  try {
    storage?.setItem(FAVORITE_ALBUMS_STORAGE_KEY, JSON.stringify(ids.map(Number)));
    return true;
  } catch {
    return false;
  }
}
