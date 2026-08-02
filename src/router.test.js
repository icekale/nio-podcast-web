import { describe, expect, it } from 'vitest';
import { closeQueueHash, parseHash, withQueueHash } from './router';

describe('hash router', () => {
  it('parses home and album routes', () => {
    expect(parseHash('#/')).toEqual({ screen: 'home', albumId: null, queueOpen: false });
    expect(parseHash('#/albums')).toEqual({ screen: 'albums', albumId: null, queueOpen: false });
    expect(parseHash('#/album/23')).toEqual({ screen: 'album', albumId: 23, queueOpen: false });
  });

  it('parses search and queue query state', () => {
    expect(parseHash('#/search?queue=1')).toEqual({ screen: 'search', albumId: null, queueOpen: true });
    expect(parseHash('#/?queue=1')).toEqual({ screen: 'home', albumId: null, queueOpen: true });
  });

  it('normalizes invalid hashes to home', () => {
    expect(parseHash('#/unknown')).toEqual({ screen: 'home', albumId: null, queueOpen: false });
  });

  it('opens and closes the queue without changing the underlying route', () => {
    expect(withQueueHash('#/album/23', true)).toBe('#/album/23?queue=1');
    expect(closeQueueHash('#/album/23?queue=1')).toBe('#/album/23');
  });
});
