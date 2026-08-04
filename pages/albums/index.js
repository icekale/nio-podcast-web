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
    player: null,
    later: [],
    catalog: null,
    queueOpen: false,
    queueTab: 'queue',
  },

  onLoad() {
    store = require('../../services/catalog-store').getStore();
    this.unsubscribe = store.subscribe(state => this.applyCatalog(state));
    this.playerUnsubscribe = require('../../services/player-store').subscribe(s => {
      this.setData({ player: s.player, later: s.later });
    });
  },

  onShow() {
    if (store) store.refreshCatalog();
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.playerUnsubscribe) this.playerUnsubscribe();
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
      catalog: state.catalog,
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
  onOpenQueue() { this.setData({ queueOpen: true, queueTab: 'queue' }); },
  onCloseQueue() { this.setData({ queueOpen: false }); },
  onPlayQueue(event) {
    require('../../services/player-store').playEpisode(event.detail.episode, this.data.player.queue);
  },
  onPlayNext(event) { require('../../services/player-store').playNext(event.detail.episode); },
  onRemoveQueue(event) { require('../../services/player-store').removeQueue(event.detail.id); },
  onAddLaterQueue(event) {
    const result = require('../../services/player-store').addLater(event.detail.episode);
    const text = !result.added
      ? '已在稍后播放'
      : result.persisted
        ? '已添加到稍后播放'
        : '已添加到稍后播放，但无法保存，刷新后可能丢失';
    wx.showToast({ title: text, icon: 'none' });
  },
  onRemoveLater(event) { require('../../services/player-store').removeLater(event.detail.id); },
  onMoveLater(event) { require('../../services/player-store').moveLater(event.detail.from, event.detail.to); },
  onTogglePlayback() { require('../../services/player-store').togglePlayback(); },
  onSeek(event) { require('../../services/player-store').seek(event.detail.position); },
  onRetryAudio() { require('../../services/player-store').retryAudio(); },
});
