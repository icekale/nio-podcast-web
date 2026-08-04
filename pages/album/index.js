const { getEpisodes } = require('../../utils/api');
const { formatDuration, formatDate } = require('../../utils/format');
const PAGE_SIZE = 30;

Page({
  data: {
    album: null,
    episodes: [],
    page: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: false,
    retryPage: 1,
    player: null,
    later: [],
    catalog: null,
    queueOpen: false,
    queueTab: 'queue',
  },

  onLoad(options) {
    this.albumId = Number(options.id);
    const store = require('../../services/catalog-store').getStore();
    const catalog = store.getState().catalog;
    const album = catalog && catalog.albums.find(a => Number(a.id) === this.albumId);
    if (album) {
      this.setData({
        album: {
          id: album.id,
          name: album.name,
          imageUrl: album.imageUrl,
          description: album.description,
          countLabel: `${album.episodeCount || album.count || 0} 集`,
        },
      });
    }
    this.setData({ catalog });
    this.playerUnsubscribe = require('../../services/player-store').subscribe(s => {
      this.setData({ player: s.player, later: s.later });
    });
    this.loadPage(1);
  },

  onUnload() {
    if (this.playerUnsubscribe) this.playerUnsubscribe();
  },

  async loadPage(pageNumber) {
    if (this.data.loading || this.data.loadingMore) return;
    this.setData(pageNumber === 1 ? { loading: true, error: false } : { loadingMore: true });
    try {
      const result = await getEpisodes(this.albumId, pageNumber, PAGE_SIZE);
      const mapped = result.episodes.map(e => ({
        ...e,
        durationLabel: formatDuration(e.duration),
        dateLabel: e.onlineTime ? formatDate(e.onlineTime) : '',
      }));
      this.setData({
        episodes: pageNumber === 1 ? mapped : this.data.episodes.concat(mapped),
        page: pageNumber,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        error: false,
      });
    } catch {
      this.setData({ loading: false, loadingMore: false, error: true, retryPage: pageNumber });
    }
  },

  onRetry() {
    this.loadPage(this.data.retryPage);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) {
      this.loadPage(this.data.page + 1);
    }
  },

  onLoadMore() {
    this.onReachBottom();
  },

  onPlayEpisode(event) {
    const episode = event.detail.episode;
    if (episode) require('../../services/player-store').playEpisode(episode, this.data.episodes);
  },

  onManage(event) {
    const episode = event.detail.episode;
    const result = require('../../services/player-store').addLater(episode);
    const text = !result.added
      ? '已在稍后播放'
      : result.persisted
        ? '已添加到稍后播放'
        : '已添加到稍后播放，但无法保存，刷新后可能丢失';
    wx.showToast({ title: text, icon: 'none' });
  },

  onTogglePlayback() { require('../../services/player-store').togglePlayback(); },
  onSeek(event) { require('../../services/player-store').seek(event.detail.position); },
  onRetryAudio() { require('../../services/player-store').retryAudio(); },
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

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/home/index' });
  },
});
