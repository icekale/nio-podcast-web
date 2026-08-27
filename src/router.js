export function currentPath(location = globalThis.location) {
  const hash = String(location?.hash || '');
  if (hash.startsWith('#/')) return hash.slice(1) || '/';
  return `${location?.pathname || '/'}${location?.search || ''}` || '/';
}

export function parseHash(url = currentPath()) {
  const raw = String(url || '/').replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  const query = new URLSearchParams(raw.split('?')[1] || '');
  const queueOpen = query.get('queue') === '1';
  const episodeId = query.get('ep') ? Number(query.get('ep')) || null : null;
  if (path === '/search') return { screen: 'search', albumId: null, episodeId: null, queueOpen, searchQuery: query.get('q') || '' };
  if (path === '/albums') return { screen: 'albums', albumId: null, episodeId: null, queueOpen };
  if (path === '/favorites') return { screen: 'favorites', albumId: null, episodeId: null, queueOpen };
  const album = path.match(/^\/album\/(\d+)$/);
  if (album) return { screen: 'album', albumId: Number(album[1]), episodeId, queueOpen };
  return { screen: 'home', albumId: null, episodeId: null, queueOpen };
}

export function withQueueHash(url, open = true) {
  const raw = String(url || '/').replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  const query = new URLSearchParams(queryString);
  if (open) query.set('queue', '1');
  else query.delete('queue');
  const serialized = query.toString();
  return `${path}${serialized ? `?${serialized}` : ''}`;
}

export function closeQueueHash(url) {
  return withQueueHash(url, false);
}
