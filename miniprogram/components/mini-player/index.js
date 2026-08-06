const { formatClock } = require('../../utils/format');

Component({
  properties: {
    player: { type: Object, value: null },
  },
  data: { activeColor: '#00b9b5' },
  lifetimes: {
    attached() {
      this._applyTheme = () => {
        try {
          const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
          const theme = info.theme || 'light';
          this.setData({ activeColor: theme === 'dark' ? '#2bd0c6' : '#00b9b5' });
        } catch {
          this.setData({ activeColor: '#00b9b5' });
        }
      };
      this._applyTheme();
      if (wx.onThemeChange) wx.onThemeChange(this._applyTheme);
    },
    detached() {
      if (wx.offThemeChange && this._applyTheme) wx.offThemeChange(this._applyTheme);
    },
  },
  observers: {
    player(player) {
      if (!player || !player.currentEpisode) return;
      const duration = player.durationSeconds || (Number(player.currentEpisode.duration) || 0) / 1000;
      this.setData({
        elapsed: formatClock(player.positionSeconds),
        total: formatClock(duration),
        durationSeconds: duration,
        positionSeconds: Math.min(player.positionSeconds, duration || 0),
      });
    },
  },
  methods: {
    onToggle() { this.triggerEvent('toggle'); },
    onOpenQueue() { this.triggerEvent('openqueue'); },
    onSeek(event) { this.triggerEvent('seek', { position: Number(event.detail.value) }); },
    onRetry() { this.triggerEvent('retry'); },
  },
});
