import { ChevronRight, Heart } from 'lucide-react';
import { memo, useEffect } from 'react';
import { Artwork } from './Artwork';
import { useVisibleAlbums } from '../hooks/useVisibleAlbums';

function FavoriteStarButton({ album, favorited, onToggle }) {
  return (
    <div className="album-action">
      <button type="button" className={`icon-button favorite-star${favorited ? ' is-favorite' : ''}`} aria-label={favorited ? `取消收藏 ${album.name}` : `收藏 ${album.name}`} aria-pressed={favorited} onClick={() => onToggle(album.id)}>
        <Heart size={16} aria-hidden="true" fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender, grid = false, favoriteIds = [], onToggleFavorite }) {
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  const favoriteSet = new Set(favoriteIds.map(Number));
  useEffect(() => { onRender?.(); }, [onRender]);
  return (
    <ul className={`album-results${grid ? ' is-grid' : ''}`}>
      {visibleAlbums.map(album => {
        const favorited = favoriteSet.has(Number(album.id));
        return (
          <li key={album.id} className="album-row">
            <button type="button" className="album-result" onClick={() => onOpenAlbum(album.id)}>
              <Artwork src={album.imageUrl} alt="" className="album-art" />
              <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
              {!grid && !onToggleFavorite ? <ChevronRight size={19} aria-hidden="true" /> : null}
            </button>
            {onToggleFavorite ? <FavoriteStarButton album={album} favorited={favorited} onToggle={onToggleFavorite} /> : null}
          </li>
        );
      })}
      {hasMore ? <li className="album-results-more"><button type="button" onClick={loadMore}>加载更多专辑</button></li> : null}
    </ul>
  );
});
