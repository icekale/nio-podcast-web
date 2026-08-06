function createStorage(backend) {
  const impl = backend || {
    getItem(key) {
      try { return wx.getStorageSync(key) || null; } catch { return null; }
    },
    setItem(key, value) {
      try { wx.setStorageSync(key, value); return true; } catch { return false; }
    },
  };
  return {
    getItem(key) {
      try { const value = impl.getItem(key); return value == null ? null : value; } catch { return null; }
    },
    setItem(key, value) {
      try { impl.setItem(key, value); return true; } catch { return false; }
    },
  };
}

module.exports = { createStorage };
