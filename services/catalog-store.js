const { loadCatalog, readCatalogCache, writeCatalogCache } = require('../utils/catalog');
const { createStorage } = require('../utils/storage');
const { config } = require('../utils/api-config');

const COOLDOWN_MS = 5 * 60 * 1000;
const CACHE_FRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let storage = createStorage();
let state = { catalog: null, loading: true, error: null, stale: false };
let lastRefreshedAt = 0;
let inFlight = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch {} });
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

function requestCatalog(baseUrl) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}data/albums.json`,
      method: 'GET',
      timeout: FETCH_TIMEOUT_MS,
      success: res => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: async () => res.data }),
      fail: reject,
    });
  });
}

function initCatalogStore(options = {}) {
  storage = options.storage || createStorage();
  const requestImpl = options.requestImpl || (() => requestCatalog(options.baseUrl || config.catalogBase));
  const baseUrl = options.baseUrl || config.catalogBase;

  const cached = readCatalogCache(storage);
  if (cached) state = { catalog: cached, loading: false, error: null, stale: false };

  async function refreshCatalog({ force = false, showLoading = false } = {}) {
    if (inFlight) return inFlight;
    if (!force && Date.now() - lastRefreshedAt < COOLDOWN_MS) return null;
    if (showLoading) setState({ loading: true, error: null });
    lastRefreshedAt = Date.now();
    const request = (async () => {
      try {
        const fresh = await loadCatalog(requestImpl, baseUrl);
        writeCatalogCache(fresh.catalog, storage);
        setState({ catalog: fresh.catalog, loading: false, error: null, stale: fresh.stale });
        return fresh;
      } catch (error) {
        const fallback = readCatalogCache(storage);
        const currentCatalog = fallback || state.catalog;
        setState({
          catalog: currentCatalog,
          loading: false,
          error,
          stale: Boolean(currentCatalog),
        });
        return null;
      } finally {
        inFlight = null;
      }
    })();
    inFlight = request;
    return request;
  }

  if (!cached || Date.now() - cached.generatedAt >= CACHE_FRESH_MS) {
    refreshCatalog({ force: true });
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
    getState: () => state,
    refreshCatalog,
  };
}

let singleton = null;
function getStore() {
  if (!singleton) singleton = initCatalogStore();
  return singleton;
}

module.exports = { initCatalogStore, getStore };
