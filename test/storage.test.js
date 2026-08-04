import { describe, expect, it } from 'vitest';
import { createStorage } from '../utils/storage';

describe('storage adapter', () => {
  it('round-trips string values through an injected backend', () => {
    const backend = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); } };
    const storage = createStorage(backend);
    storage.setItem('k', '{"a":1}');
    expect(storage.getItem('k')).toBe('{"a":1}');
  });
  it('returns null on read failure', () => {
    const storage = createStorage({ getItem() { throw new Error('boom'); }, setItem() {} });
    expect(storage.getItem('k')).toBeNull();
  });
});
