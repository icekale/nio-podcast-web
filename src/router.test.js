import { describe, expect, it } from 'vitest';
import { closeQueueHash, parseHash, withQueueHash } from './router';
import { sameRoute } from './routeUtils';

describe('hash router', () => {
  it('parses home and album routes', () => {
    expect(parseHash('#/')).toEqual({ screen: 'home', albumId: null, episodeId: null, queueOpen: false });
    expect(parseHash('#/albums')).toEqual({ screen: 'albums', albumId: null, episodeId: null, queueOpen: false });
    expect(parseHash('#/album/23')).toEqual({ screen: 'album', albumId: 23, episodeId: null, queueOpen: false });
  });

  it('parses search and queue query state', () => {
    expect(parseHash('#/search?queue=1')).toEqual({ screen: 'search', albumId: null, episodeId: null, queueOpen: true, searchQuery: '' });
    expect(parseHash('#/?queue=1')).toEqual({ screen: 'home', albumId: null, episodeId: null, queueOpen: true });
  });

  it('parses an episode deep link on the album route', () => {
    expect(parseHash('#/album/23?ep=196763')).toEqual({ screen: 'album', albumId: 23, episodeId: 196763, queueOpen: false });
    expect(parseHash('#/album/23?queue=1&ep=196763')).toEqual({ screen: 'album', albumId: 23, episodeId: 196763, queueOpen: true });
  });

  it('parses and serializes the search query', () => {
    expect(parseHash('#/search?q=morning%20radio')).toEqual({
      screen: 'search', albumId: null, episodeId: null, queueOpen: false, searchQuery: 'morning radio',
    });
    expect(withQueueHash('#/search?q=morning%20radio', true)).toBe('#/search?q=morning+radio&queue=1');
    expect(closeQueueHash('#/search?q=morning+radio&queue=1')).toBe('#/search?q=morning+radio');
  });

  it('normalizes invalid hashes to home', () => {
    expect(parseHash('#/unknown')).toEqual({ screen: 'home', albumId: null, episodeId: null, queueOpen: false });
  });

  it('parses the favorites route', () => {
    expect(parseHash('#/favorites')).toEqual({ screen: 'favorites', albumId: null, episodeId: null, queueOpen: false });
  });

  it('treats different episode deep links as different routes', () => {
    expect(sameRoute(
      parseHash('#/album/23?ep=196763'),
      parseHash('#/album/23?ep=196764'),
    )).toBe(false);
  });

  it('opens and closes the queue without changing the underlying route', () => {
    expect(withQueueHash('#/album/23', true)).toBe('#/album/23?queue=1');
    expect(closeQueueHash('#/album/23?queue=1')).toBe('#/album/23');
    expect(withQueueHash('#/album/23?ep=196763', true)).toBe('#/album/23?ep=196763&queue=1');
    expect(closeQueueHash('#/album/23?ep=196763&queue=1')).toBe('#/album/23?ep=196763');
  });
});
