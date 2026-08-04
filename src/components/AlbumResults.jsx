import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { Artwork } from './Artwork';
import { useVisibleAlbums } from '../hooks/useVisibleAlbums';

export const AlbumResults = memo(function AlbumResults({ albums, onOpenAlbum, onRender, grid = false }) {
  onRender?.();
  const { visibleAlbums, hasMore, loadMore } = useVisibleAlbums(albums);
  return (
    <ul className={`album-results${grid ? ' is-grid' : ''}`}>
      {visibleAlbums.map(album => (
        <li key={album.id}>
          <button type="button" className="album-result" onClick={() => onOpenAlbum(album.id)}>
            <Artwork src={album.imageUrl} alt="" className="album-art" />
            <span className="album-result-copy"><strong>{album.name}</strong><span>{album.latestEpisode?.title || album.description || '暂无节目'}</span></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </li>
      ))}
      {hasMore ? <li className="album-results-more"><button type="button" onClick={loadMore}>加载更多专辑</button></li> : null}
    </ul>
  );
});
