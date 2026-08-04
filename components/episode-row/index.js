Component({
  properties: {
    episode: { type: Object, value: null },
    active: { type: Boolean, value: false },
    progress: { type: Number, value: 0 },
    showManage: { type: Boolean, value: false },
  },
  methods: {
    onPlay() { this.triggerEvent('play', { episode: this.data.episode }); },
    onManage() { this.triggerEvent('manage', { episode: this.data.episode }); },
  },
});
