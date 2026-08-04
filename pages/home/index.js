const { formatDuration, formatDate } = require('../../utils/format');
const { selectHomeEpisodes } = require('../../utils/catalog');

let catalogStore = null;
let unsubscribe = null;
let playerUnsubscribe = null;

Page({
  data: {
    scrolled: false,
    heading: '今日更新',
    count: 0,
    episodes: [],
    recommendation: null,
    stale: false,
    refreshing: false,
    catalogError: false,
    catalogLoading: true,
    player: null,
  },

  onLoad() {
    catalogStore = require('../../services/catalog-store').getStore();
    unsubscribe = catalogStore.subscribe(state => this.applyCatalog(state));
    playerUnsubscribe = require('../../services/player-store').subscribe(s => {
      this.setData({ player: s.player });
    });
  },

  onShow() {
    if (catalogStore) catalogStore.refreshCatalog();
  },

  onUnload() {
    if (unsubscribe) unsubscribe();
    if (playerUnsubscribe) playerUnsubscribe();
  },

  onPageScroll(event) {
    const scrolled = event.scrollTop > 180;
    if (scrolled !== this.data.scrolled) this.setData({ scrolled });
  },

  applyCatalog(state) {
    const catalog = state.catalog;
    if (!catalog) {
      this.setData({
        catalogLoading: state.loading,
        catalogError: Boolean(state.error && !state.catalog),
        stale: state.stale,
        refreshing: state.loading && Boolean(state.catalog),
        episodes: [],
        recommendation: null,
      });
      return;
    }
    const selection = selectHomeEpisodes(catalog.albums, new Date());
    const player = this.data.player || {};
    const episodes = selection.episodes.map(e => {
      let progressPercent = 0;
      if (player.currentEpisode && String(player.currentEpisode.id) === String(e.id) && player.durationSeconds > 0) {
        progressPercent = Math.round((player.positionSeconds / player.durationSeconds) * 100);
      }
      return {
        ...e,
        durationLabel: formatDuration(e.duration),
        dateLabel: e.onlineTime ? formatDate(e.onlineTime) : '',
        progressPercent,
      };
    });
    const first = episodes[0] || null;
    this.setData({
      catalogLoading: false,
      catalogError: Boolean(state.error),
      stale: state.stale,
      refreshing: state.loading,
      heading: selection.heading,
      count: selection.episodes.length,
      episodes,
      recommendation: first
        ? {
            id: first.id,
            title: first.title,
            albumName: first.albumName,
            albumPic: first.albumPic,
            durationLabel: first.durationLabel,
          }
        : null,
    });
  },

  onRetryCatalog() {
    catalogStore.refreshCatalog({ force: true, showLoading: true });
  },
  onOpenAlbums() { wx.navigateTo({ url: '/pages/albums/index' }); },
  onOpenSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
  onPlayAll() {
    if (this.data.episodes.length) {
      require('../../services/player-store').playAll(this.data.episodes);
    }
  },
  onPlayEpisode(event) {
    const episode = event.detail.episode;
    if (episode) require('../../services/player-store').playEpisode(episode, this.data.episodes);
  },
  onTogglePlayback() { require('../../services/player-store').togglePlayback(); },
  onSeek(event) { require('../../services/player-store').seek(event.detail.position); },
  onRetryAudio() { require('../../services/player-store').retryAudio(); },
  onOpenQueue() {
    wx.showToast({ title: '播放列表即将上线', icon: 'none' });
  },
});
