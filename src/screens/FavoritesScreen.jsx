import { memo, useMemo } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { AlbumResults } from '../components/AlbumResults';

export const FavoritesScreen = memo(function FavoritesScreen({ catalog, favoriteIds, onToggleFavorite, onOpenAlbum, onBack, onBrowse }) {
  const favorites = useMemo(() => {
    const byId = new Map(catalog.albums.map(album => [Number(album.id), album]));
    return favoriteIds.map(Number).filter(id => byId.has(id)).map(id => byId.get(id));
  }, [catalog.albums, favoriteIds]);
  return (
    <div className="screen favorites-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">我的收藏</span>
        <span className="icon-button-spacer" />
      </header>
      <section className="search-results" aria-labelledby="favorites-title">
        <div className="section-heading-row"><h1 id="favorites-title">我的收藏</h1><span className="section-count">{favorites.length}</span></div>
        {favorites.length ? <AlbumResults albums={favorites} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} /> : (
          <div className="favorites-empty">
            <Heart size={32} aria-hidden="true" />
            <h2>还没有收藏专辑</h2>
            <p>在「全部专辑」里点击专辑标题右侧的 ☆ 即可收藏。</p>
            <button type="button" className="secondary-button" onClick={onBrowse}>去全部专辑看看</button>
          </div>
        )}
      </section>
    </div>
  );
});
