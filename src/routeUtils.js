export function screenRouteKey(route) {
  return `${route.screen}:${route.albumId ?? ''}`;
}

export function sameRoute(previous, next) {
  return previous.screen === next.screen
    && previous.albumId === next.albumId
    && previous.episodeId === next.episodeId
    && previous.searchQuery === next.searchQuery
    && previous.queueOpen === next.queueOpen;
}

export function routeMotionFor(previous, next) {
  if (previous.screen === 'home' && next.screen === 'albums') return 'forward';
  if (previous.screen !== 'home' && next.screen === 'home') return 'back';
  if (previous.screen !== 'album' && next.screen === 'album') return 'forward';
  if (previous.screen === 'album' && next.screen !== 'album') return 'back';
  return 'none';
}

