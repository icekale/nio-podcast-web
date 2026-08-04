Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: false },
    showSearch: { type: Boolean, value: true },
    scrolled: { type: Boolean, value: false },
    showContinue: { type: Boolean, value: false },
  },
  data: { statusBarHeight: 20 },
  lifetimes: {
    attached() {
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.setData({ statusBarHeight: info.statusBarHeight || 20 });
      } catch {}
    },
  },
  methods: {
    onBack() { this.triggerEvent('back'); },
    onContinue() { this.triggerEvent('continue'); },
    onSearch() { this.triggerEvent('search'); },
    onAlbums() { this.triggerEvent('albums'); },
  },
});
