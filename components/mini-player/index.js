const { formatClock } = require('../../utils/format');

Component({
  properties: {
    player: { type: Object, value: null },
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
