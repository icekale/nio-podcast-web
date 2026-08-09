import { Download } from 'lucide-react';

export function DesktopNav({ route, laterActive, onHome, onSearch, onLater, onFavorites, showInstall, onInstall }) {
  return (
    <aside className="desktop-nav">
      <div className="desktop-nav-brand">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="30" height="30" />
        <span>NIO Radio</span>
      </div>
      <nav className="desktop-nav-links" aria-label="主导航">
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'home' ? 'page' : undefined} onClick={onHome}>今日推荐</button>
        <button type="button" className="desktop-nav-link" aria-current={(route.screen === 'search' || route.screen === 'albums') ? 'page' : undefined} onClick={onSearch}>搜索</button>
        <button type="button" className="desktop-nav-link" aria-current={laterActive ? 'page' : undefined} onClick={onLater}>稍后播放</button>
        <button type="button" className="desktop-nav-link" aria-current={route.screen === 'favorites' ? 'page' : undefined} onClick={onFavorites}>专辑收藏</button>
      </nav>
      {showInstall ? <button type="button" className="desktop-nav-install" onClick={onInstall}><Download size={17} aria-hidden="true" />安装应用</button> : null}
    </aside>
  );
}
