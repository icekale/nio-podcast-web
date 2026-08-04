export function parseHash(hash = globalThis.location?.hash || '#/') {
  const raw = String(hash || '#/').replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  const query = new URLSearchParams(raw.split('?')[1] || '');
  const queueOpen = query.get('queue') === '1';
  if (path === '/search') return { screen: 'search', albumId: null, queueOpen, searchQuery: query.get('q') || '' };
  if (path === '/albums') return { screen: 'albums', albumId: null, queueOpen };
  if (path === '/favorites') return { screen: 'favorites', albumId: null, queueOpen };
  const album = path.match(/^\/album\/(\d+)$/);
  if (album) return { screen: 'album', albumId: Number(album[1]), queueOpen };
  return { screen: 'home', albumId: null, queueOpen };
}

export function withQueueHash(hash, open = true) {
  const raw = String(hash || '#/').replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  const query = new URLSearchParams(queryString);
  if (open) query.set('queue', '1');
  else query.delete('queue');
  const serialized = query.toString();
  return `#${path}${serialized ? `?${serialized}` : ''}`;
}

export function closeQueueHash(hash) {
  return withQueueHash(hash, false);
}
