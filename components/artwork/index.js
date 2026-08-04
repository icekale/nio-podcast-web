Component({
  properties: {
    src: { type: String, value: '' },
    className: { type: String, value: '' },
  },
  data: { failed: false },
  methods: {
    onError() { this.setData({ failed: true }); },
  },
});
