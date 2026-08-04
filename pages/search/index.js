const { sortAlbumsForDirectory } = require('../../utils/catalog');
const PAGE_SIZE = 100;

let store = null;

Page({
  data: {
    statusBarHeight: 20,
    query: '',
    debounced: '',
    source: [],
    albums: [],
    visibleAlbums: [],
    visibleCount: PAGE_SIZE,
    total: 0,
    loading: true,
    error: false,
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    } catch {}
    store = require('../../services/catalog-store').getStore();
    this.unsubscribe = store.subscribe(state => this.applyCatalog(state));
  },

  onShow() {
    if (store) store.refreshCatalog();
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
  },

  applyCatalog(state) {
    if (!state.catalog) {
      this.setData({ loading: state.loading, error: Boolean(state.error) });
      return;
    }
    this.setData({ source: state.catalog.albums, loading: false, error: false });
    this.applyFilter();
  },

  onInput(event) {
    this.setData({ query: event.detail.value });
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.setData({ debounced: this.data.query });
      this.applyFilter();
    }, 120);
  },

  onClear() {
    clearTimeout(this.debounceTimer);
    this.setData({ query: '', debounced: '' });
    this.applyFilter();
  },

  applyFilter() {
    const source = this.data.source || [];
    const value = (this.data.debounced || '').trim().toLowerCase();
    const base = sortAlbumsForDirectory(source);
    const filtered = value
      ? base.filter(a => `${a.name} ${a.description || ''} ${a.host || ''}`.toLowerCase().includes(value))
      : base;
    const albums = filtered.map(a => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目',
    }));
    this.setData({
      albums,
      total: albums.length,
      visibleCount: PAGE_SIZE,
      visibleAlbums: albums.slice(0, PAGE_SIZE),
    });
  },

  onReachBottom() {
    const next = Math.min(this.data.visibleCount + PAGE_SIZE, this.data.albums.length);
    if (next > this.data.visibleCount) {
      this.setData({ visibleCount: next, visibleAlbums: this.data.albums.slice(0, next) });
    }
  },

  onOpenAlbum(event) {
    wx.navigateTo({ url: `/pages/album/index?id=${event.detail.id}` });
  },
  onBack() { wx.navigateBack(); },
});
