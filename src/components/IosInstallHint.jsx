import { useState } from 'react';
import { shouldShowIosInstall } from '../iosSupport';

const STORAGE_KEY = 'nio_ios_install_dismissed';

export function IosInstallHint() {
  const [visible, setVisible] = useState(() => shouldShowIosInstall({
    dismissed: Boolean(globalThis.localStorage?.getItem(STORAGE_KEY)),
  }));
  if (!visible) return null;
  return (
    <div className="update-toast" role="status">
      <span>点击底部分享，再选「添加到主屏幕」</span>
      <button
        type="button"
        onClick={() => {
          try { globalThis.localStorage?.setItem(STORAGE_KEY, '1'); } catch { /* optional */ }
          setVisible(false);
        }}
      >
        知道了
      </button>
    </div>
  );
}
