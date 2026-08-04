Component({
  properties: {
    kind: { type: String, value: 'loading' },
    title: { type: String, value: '' },
    message: { type: String, value: '' },
    actionText: { type: String, value: '' },
  },
  methods: {
    onAction() { this.triggerEvent('action'); },
  },
});
