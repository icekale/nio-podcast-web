import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {},
    onOfflineReady() {},
  })

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="status">
      <span>新版本已就绪</span>
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false)
          updateServiceWorker(true)
        }}
      >
        刷新
      </button>
    </div>
  )
}
