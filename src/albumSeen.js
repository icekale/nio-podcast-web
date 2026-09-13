export const ALBUM_SEEN_STORAGE_KEY = 'nio_album_seen_v1';

// 订阅更新水位：用户上一次查看「专辑收藏」的时间。
// ponytail: 一个全局时间戳就够（进收藏页即视为看过）。若用户抱怨「打开就全清」，
// 再换成 { albumId: onlineTime } 映射，只改这个文件 + selectUpdatedAlbums。
export function readAlbumsSeenAt(storage = globalThis.localStorage) {
  try {
    const parsed = Number(storage?.getItem(ALBUM_SEEN_STORAGE_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeAlbumsSeenAt(timestamp = Date.now(), storage = globalThis.localStorage) {
  try {
    storage?.setItem(ALBUM_SEEN_STORAGE_KEY, String(Number(timestamp) || 0));
    return true;
  } catch {
    return false;
  }
}
