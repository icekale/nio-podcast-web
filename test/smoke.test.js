import { describe, expect, it } from 'vitest';

describe('project scaffold', () => {
  it('ships a non-empty album catalog', () => {
    const catalog = require('../data/albums.json');
    expect(Array.isArray(catalog.albums)).toBe(true);
    expect(catalog.albums.length).toBeGreaterThan(500);
  });
});
