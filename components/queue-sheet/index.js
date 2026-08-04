const { getEpisodes } = require('../../utils/api');
const { formatDuration } = require('../../utils/format');
const PAGE_SIZE = 100;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    tab: { type: String, value: 'queue' },
    player: { type: Object, value: null },
    later: { type: Array, value: [] },
    catalog: { type: Object, value: null },
  },
  data: {
    items: [],
    pickerOpen: false,
    pickerAlbumId: null,
    pickerAlbumName: '',
    pickerEpisodes: [],
    pickerLoading: false,
    pickerError: false,
    pickerHasMore: false,
    actionsFor: null,
    laterActionsFor: null,
    swipedId: null,
    dragId: null,
    albumSource: [],
  },
  observers: {
    'tab, player, later'(tab, player, later) {
      this.setData({ items: this.itemsFor(tab, player, later) });
    },
    visible(v) {
      if (!v) {
        this.setData({ pickerOpen: false, actionsFor: null, laterActionsFor: null, swipedId: null, dragId: null });
      }
    },
    catalog(c) {
      if (!c) return;
      const albumSource = c.albums.map(a => ({
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl,
        subtitle: (a.latestEpisode && a.latestEpisode.title) || a.description || '暂无节目',
      }));
      this.setData({ albumSource });
    },
  },
  methods: {
    itemsFor(tab, player, later) {
      const p = player || {};
      if (tab === 'queue') {
        return (p.queue || []).map((e, i) => ({
          ...e,
          durationLabel: formatDuration(e.duration),
          index: i,
          active: p.currentEpisode && String(p.currentEpisode.id) === String(e.id),
        }));
      }
      if (tab === 'history') {
        return (p.history || []).map((e, i) => ({ ...e, durationLabel: formatDuration(e.duration), index: i }));
      }
      return (later || []).map((e, i) => ({ ...e, durationLabel: formatDuration(e.duration), index: i }));
    },
    onTab(event) {
      this.setData({ tab: event.currentTarget.dataset.tab, pickerOpen: false, actionsFor: null, laterActionsFor: null, swipedId: null });
    },
    onClose() { this.triggerEvent('close'); },
    onNoop() {},
    onPlay(event) {
      const id = event.currentTarget.dataset.id;
      const episode = this.data.items.find(e => String(e.id) === String(id));
      if (episode) this.triggerEvent('play', { episode });
    },
    onToggleActions(event) {
      const id = event.currentTarget.dataset.id;
      this.setData({ actionsFor: this.data.actionsFor === id ? null : id });
    },
    onPlayNext() {
      const episode = this.data.items.find(e => String(e.id) === String(this.data.actionsFor));
      if (episode) this.triggerEvent('playnext', { episode });
      this.setData({ actionsFor: null });
    },
    onRemoveQueue() {
      const id = this.data.actionsFor;
      if (id != null) this.triggerEvent('removequeue', { id });
      this.setData({ actionsFor: null });
    },
    onToggleLaterActions(event) {
      const id = event.currentTarget.dataset.id;
      this.setData({ laterActionsFor: this.data.laterActionsFor === id ? null : id, swipedId: null });
    },
    onMoveLater(event) {
      const { from, to } = event.currentTarget.dataset;
      this.triggerEvent('movelater', { from: Number(from), to: Number(to) });
      this.setData({ laterActionsFor: null });
    },
    onOpenPicker() { this.setData({ pickerOpen: true, pickerAlbumId: null, pickerAlbumName: '', pickerEpisodes: [], pickerError: false }); },
    onClosePicker() { this.setData({ pickerOpen: false }); },
    onSelectAlbum(event) {
      const id = event.detail.id;
      const album = this.data.albumSource.find(a => Number(a.id) === Number(id));
      this.setData({ pickerAlbumId: id, pickerAlbumName: album ? album.name : '', pickerLoading: true, pickerError: false, pickerEpisodes: [] });
      getEpisodes(id, 1, PAGE_SIZE).then(result => {
        const pickerEpisodes = result.episodes.map(e => ({ ...e, durationLabel: formatDuration(e.duration) }));
        this.setData({ pickerEpisodes, pickerLoading: false, pickerHasMore: result.hasMore });
      }).catch(() => {
        this.setData({ pickerLoading: false, pickerError: true });
      });
    },
    onAddLater(event) {
      const id = event.currentTarget.dataset.id;
      const episode = this.data.pickerEpisodes.find(e => String(e.id) === String(id));
      if (episode) this.triggerEvent('addlater', { episode });
    },
    onRemoveLater(event) {
      const id = event.currentTarget.dataset.id;
      this.triggerEvent('removelater', { id });
      this.setData({ swipedId: null });
    },
    onRowTouchStart(event) {
      const touch = event.touches[0];
      this._gesture = { id: event.currentTarget.dataset.id, x: touch.clientX, y: touch.clientY, moved: false };
    },
    onRowTouchMove(event) {
      const gesture = this._gesture;
      if (!gesture) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.x;
      if (!this.data.dragId && deltaX < -48) {
        this.setData({ swipedId: gesture.id, laterActionsFor: null });
      }
      if (this.data.dragId && String(this.data.dragId) === String(gesture.id) && !gesture.moved) {
        const deltaY = touch.clientY - gesture.y;
        const items = this.data.items;
        const index = items.findIndex(e => String(e.id) === String(gesture.id));
        if (deltaY < -64 && index > 0) {
          this.triggerEvent('movelater', { from: index, to: index - 1 });
          gesture.moved = true;
        } else if (deltaY > 64 && index < items.length - 1) {
          this.triggerEvent('movelater', { from: index, to: index + 1 });
          gesture.moved = true;
        }
      }
    },
    onRowTouchEnd() {
      this._gesture = null;
      this.setData({ dragId: null });
    },
    onRowLongPress(event) {
      this.setData({ dragId: event.currentTarget.dataset.id, swipedId: null });
    },
  },
});
