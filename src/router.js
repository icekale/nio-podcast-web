function routePath(hash = '') {
  const raw = String(hash || '#/').replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  return path.startsWith('/') ? path : '/';
}

export function parseHash(hash = globalThis.location?.hash || '#/') {
  const raw = String(hash || '#/').replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  const query = new URLSearchParams(raw.split('?')[1] || '');
  const queueOpen = query.get('queue') === '1';
  if (path === '/search') return { screen: 'search', albumId: null, queueOpen };
  const album = path.match(/^\/album\/(\d+)$/);
  if (album) return { screen: 'album', albumId: Number(album[1]), queueOpen };
  return { screen: 'home', albumId: null, queueOpen };
}

export function withQueueHash(hash, open = true) {
  const base = `#${routePath(hash)}`;
  return open ? `${base}?queue=1` : base;
}

export function closeQueueHash(hash) {
  return withQueueHash(hash, false);
}
