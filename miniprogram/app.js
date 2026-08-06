App({
  onLaunch() {
    require('./services/catalog-store').getStore();
    require('./services/player-store').initPlayerStore();
  },
});
