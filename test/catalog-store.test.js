import { beforeEach, describe, expect, it, vi } from 'vitest';

function catalogPayload() {
  return { generatedAt: Date.now(), albums: [{ id: 1, name: '早间版', latestEpisode: { id: 10, onlineTime: Date.now() } }] };
}

function requestOk(data) {
  return async () => ({ ok: true, json: async () => data });
}

describe('catalog store', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it('loads and notifies subscribers', async () => {
    const storage = { getItem: () => null, setItem: () => true };
    const api = await import('../services/catalog-store');
    const store = api.initCatalogStore({
      storage,
      requestImpl: requestOk(catalogPayload()),
      baseUrl: 'https://nio.k4le.top/',
    });
    const seen = [];
    store.subscribe(s => seen.push(s));
    await store.refreshCatalog({ force: true });
    expect(seen.at(-1).catalog.albums.length).toBe(1);
    expect(seen.at(-1).loading).toBe(false);
    expect(seen.at(-1).stale).toBe(false);
  });

  it('falls back to the cached catalog on request failure', async () => {
    const payload = catalogPayload();
    const storage = {
      getItem: key => (key === 'nio_catalog_cache_v1' ? JSON.stringify(payload) : null),
      setItem: () => true,
    };
    const api = await import('../services/catalog-store');
    const store = api.initCatalogStore({
      storage,
      requestImpl: async () => { throw new Error('offline'); },
      baseUrl: 'https://nio.k4le.top/',
    });
    await store.refreshCatalog({ force: true });
    const s = store.getState();
    expect(s.catalog.albums.length).toBe(1);
    expect(s.stale).toBe(true);
  });
});
