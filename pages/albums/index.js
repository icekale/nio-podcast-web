const { sortAlbumsForDirectory } = require('../../utils/catalog');
const PAGE_SIZE = 100;

let store = null;

Page({
  data: {
    albums: [],
    visibleAlbums: [],
    visibleCount: PAGE_SIZE,
    total: 0,
    loading: true,
    error: false,
  },

  onLoad() {
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
    const ordered = sortAlbumsForDirectory(state.catalog.albums).map(a => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目',
    }));
    this.setData({
      albums: ordered,
      total: ordered.length,
      loading: false,
      error: false,
      visibleCount: PAGE_SIZE,
      visibleAlbums: ordered.slice(0, PAGE_SIZE),
    });
  },

  onReachBottom() {
    const next = Math.min(this.data.visibleCount + PAGE_SIZE, this.data.albums.length);
    if (next > this.data.visibleCount) {
      this.setData({ visibleCount: next, visibleAlbums: this.data.albums.slice(0, next) });
    }
  },

  onLoadMore() {
    this.onReachBottom();
  },

  onRetryCatalog() {
    store.refreshCatalog({ force: true, showLoading: true });
  },

  onOpenAlbum(event) {
    wx.navigateTo({ url: `/pages/album/index?id=${event.detail.id}` });
  },
  onBack() { wx.navigateBack(); },
  onOpenSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
});
