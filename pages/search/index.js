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
    player: null,
    later: [],
    catalog: null,
    queueOpen: false,
    queueTab: 'queue',
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    } catch {}
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
    this.setData({ source: state.catalog.albums, loading: false, error: false });
    this.setData({ catalog: state.catalog });
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
  onOpenQueue() { this.setData({ queueOpen: true, queueTab: 'queue' }); },
  onCloseQueue() { this.setData({ queueOpen: false }); },
  onPlayQueue(event) {
    const store = require('../../services/player-store');
    if (this.data.queueTab === 'later') store.playLater(event.detail.episode);
    else store.playEpisode(event.detail.episode, this.data.player.queue);
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
