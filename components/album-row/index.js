Component({
  properties: {
    album: { type: Object, value: null },
  },
  methods: {
    onOpen() { this.triggerEvent('open', { id: this.data.album.id }); },
  },
});
